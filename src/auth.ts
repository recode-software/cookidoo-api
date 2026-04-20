import { CookidooAuthError } from "./errors.js";

const CLIENT_ID = "kupferwerk-client-nwot";
const CLIENT_SECRET = "Ls50ON1woySqs1dCdJge";
const BASIC_AUTH =
  "Basic " +
  Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");

export interface TokenSet {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

interface RawTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  token_type?: string;
}

function toTokenSet(raw: RawTokenResponse): TokenSet {
  const ttl = typeof raw.expires_in === "number" ? raw.expires_in : 3600;
  return {
    accessToken: raw.access_token,
    refreshToken: raw.refresh_token,
    expiresAt: Date.now() + ttl * 1000 - 30_000,
  };
}

export function tokenUrl(baseUrl: string): string {
  return `${baseUrl}/ciam/auth/token`;
}

async function postToken(
  url: string,
  body: URLSearchParams,
  fetchImpl: typeof fetch,
): Promise<TokenSet> {
  const res = await fetchImpl(url, {
    method: "POST",
    headers: {
      Authorization: BASIC_AUTH,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
  });

  const text = await res.text();
  const parsed = safeJson(text);

  if (!res.ok) {
    throw new CookidooAuthError({
      status: res.status,
      body: parsed ?? text,
      url,
      method: "POST",
    });
  }

  return toTokenSet(parsed as RawTokenResponse);
}

export function loginWithPassword(
  baseUrl: string,
  email: string,
  password: string,
  fetchImpl: typeof fetch = fetch,
): Promise<TokenSet> {
  const body = new URLSearchParams({
    grant_type: "password",
    username: email,
    password,
  });
  return postToken(tokenUrl(baseUrl), body, fetchImpl);
}

export function refreshToken(
  baseUrl: string,
  token: string,
  fetchImpl: typeof fetch = fetch,
): Promise<TokenSet> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: token,
  });
  return postToken(tokenUrl(baseUrl), body, fetchImpl);
}

function safeJson(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
