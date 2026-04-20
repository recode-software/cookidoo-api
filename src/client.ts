import { loginWithPassword, refreshToken, type TokenSet } from "./auth.js";
import { CookidooError, CookidooRateLimitError } from "./errors.js";
import { RecipesApi } from "./recipes.js";
import type { CountryCode, LanguageCode } from "./types.js";

export const FULL_VIEW_ACCEPT =
  "application/vnd.vorwerk.customer-recipe.full+json";

export interface CookidooClientOptions {
  email: string;
  password: string;
  country: CountryCode;
  language?: LanguageCode;
  baseUrl?: string;
  fetch?: typeof fetch;
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE" | "PUT";
  path: string;
  query?: Record<string, string | number | undefined>;
  body?: unknown;
  accept?: string;
  headers?: Record<string, string>;
}

export class CookidooClient {
  readonly country: CountryCode;
  readonly language: LanguageCode;
  readonly baseUrl: string;
  readonly recipes: RecipesApi;

  private readonly email: string;
  private readonly password: string;
  private readonly fetchImpl: typeof fetch;
  private tokens: TokenSet | null = null;
  private loginInFlight: Promise<TokenSet> | null = null;

  constructor(opts: CookidooClientOptions) {
    this.country = opts.country;
    this.language = opts.language ?? opts.country;
    this.baseUrl =
      opts.baseUrl ?? `https://${opts.country}.tmmobile.vorwerk-digital.com`;
    this.email = opts.email;
    this.password = opts.password;
    this.fetchImpl = opts.fetch ?? fetch;
    this.recipes = new RecipesApi(this);
  }

  async login(): Promise<void> {
    await this.ensureToken();
  }

  setTokens(tokens: TokenSet): void {
    this.tokens = tokens;
  }

  getTokens(): TokenSet | null {
    return this.tokens;
  }

  async request<T = unknown>(opts: RequestOptions): Promise<T> {
    const token = await this.ensureToken();
    const res = await this.performRequest(opts, token.accessToken);

    if (res.status === 401 && this.tokens) {
      try {
        const refreshed = await refreshToken(
          this.baseUrl,
          this.tokens.refreshToken,
          this.fetchImpl,
        );
        this.tokens = refreshed;
      } catch {
        this.tokens = null;
        const fresh = await this.ensureToken();
        const retry = await this.performRequest(opts, fresh.accessToken);
        return parseResponse<T>(retry, opts);
      }
      const retry = await this.performRequest(opts, this.tokens.accessToken);
      return parseResponse<T>(retry, opts);
    }

    return parseResponse<T>(res, opts);
  }

  private async ensureToken(): Promise<TokenSet> {
    if (this.tokens && this.tokens.expiresAt > Date.now()) {
      return this.tokens;
    }
    if (!this.loginInFlight) {
      this.loginInFlight = loginWithPassword(
        this.baseUrl,
        this.email,
        this.password,
        this.fetchImpl,
      ).finally(() => {
        this.loginInFlight = null;
      });
    }
    this.tokens = await this.loginInFlight;
    return this.tokens;
  }

  private async performRequest(
    opts: RequestOptions,
    accessToken: string,
  ): Promise<Response> {
    const url = this.buildUrl(opts.path, opts.query);
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      Accept: opts.accept ?? FULL_VIEW_ACCEPT,
      ...opts.headers,
    };
    const init: RequestInit = {
      method: opts.method ?? "GET",
      headers,
    };
    if (opts.body !== undefined) {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(opts.body);
    }
    return this.fetchImpl(url, init);
  }

  private buildUrl(path: string, query?: RequestOptions["query"]): string {
    const url = new URL(
      path.startsWith("http") ? path : `${this.baseUrl}${path}`,
    );
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined) url.searchParams.set(k, String(v));
      }
    }
    return url.toString();
  }
}

async function parseResponse<T>(
  res: Response,
  opts: RequestOptions,
): Promise<T> {
  const text = await res.text();
  const parsed = text ? safeJson(text) : undefined;

  if (!res.ok) {
    if (res.status === 429) {
      throw new CookidooRateLimitError({
        status: res.status,
        body: parsed ?? text,
        url: opts.path,
        method: opts.method ?? "GET",
        retryAfterMs: parseRetryAfter(res.headers.get("retry-after")),
      });
    }
    throw new CookidooError({
      message: `${opts.method ?? "GET"} ${opts.path} failed [${res.status}]`,
      status: res.status,
      body: parsed ?? text,
      url: opts.path,
      method: opts.method ?? "GET",
    });
  }

  return (parsed ?? (undefined as unknown)) as T;
}

function parseRetryAfter(header: string | null): number | null {
  if (!header) return null;
  const asInt = parseInt(header, 10);
  if (!Number.isNaN(asInt)) return asInt * 1000;
  const dateMs = Date.parse(header);
  if (!Number.isNaN(dateMs)) return Math.max(0, dateMs - Date.now());
  return null;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
