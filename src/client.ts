import makeFetchCookie from "fetch-cookie";
import { CookieJar } from "tough-cookie";
import { browserLogin } from "./auth.js";
import { CookidooError, CookidooRateLimitError } from "./errors.js";
import { RecipesApi } from "./recipes.js";
import type { CountryCode, LanguageCode } from "./types.js";

export const FULL_VIEW_ACCEPT =
  "application/vnd.vorwerk.customer-recipe.full+json";

export interface CookidooClientOptions {
  email: string;
  password: string;
  /**
   * Country/TLD segment of the Cookidoo host, e.g. `pl` → `https://cookidoo.pl`.
   * Note some markets use multi-label TLDs (e.g. `co.uk`); pass `baseUrl`
   * directly to override host derivation.
   */
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
  private readonly jar: CookieJar;
  private readonly fetchImpl: typeof fetch;
  private loggedIn = false;
  private loginInFlight: Promise<void> | null = null;

  constructor(opts: CookidooClientOptions) {
    this.country = opts.country;
    this.language = opts.language ?? opts.country;
    this.baseUrl = opts.baseUrl ?? `https://cookidoo.${opts.country}`;
    this.email = opts.email;
    this.password = opts.password;
    this.jar = new CookieJar();
    // Wrap the base fetch so the cookie jar is applied on every request and
    // populated across the OAuth redirect chain.
    this.fetchImpl = makeFetchCookie(
      opts.fetch ?? fetch,
      this.jar,
    ) as unknown as typeof fetch;
    this.recipes = new RecipesApi(this);
  }

  async login(): Promise<void> {
    await this.ensureLogin();
  }

  isLoggedIn(): boolean {
    return this.loggedIn;
  }

  async request<T = unknown>(opts: RequestOptions): Promise<T> {
    await this.ensureLogin();
    let res = await this.performRequest(opts);

    if (res.status === 401) {
      // Session cookie likely expired — re-authenticate once and retry.
      this.loggedIn = false;
      await this.ensureLogin();
      res = await this.performRequest(opts);
    }

    return parseResponse<T>(res, opts);
  }

  private async ensureLogin(): Promise<void> {
    if (this.loggedIn) return;
    if (!this.loginInFlight) {
      this.loginInFlight = browserLogin({
        baseUrl: this.baseUrl,
        language: this.language,
        email: this.email,
        password: this.password,
        fetch: this.fetchImpl,
        jar: this.jar,
      })
        .then(() => {
          this.loggedIn = true;
        })
        .finally(() => {
          this.loginInFlight = null;
        });
    }
    await this.loginInFlight;
  }

  private async performRequest(opts: RequestOptions): Promise<Response> {
    const url = this.buildUrl(opts.path, opts.query);
    const headers: Record<string, string> = {
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
