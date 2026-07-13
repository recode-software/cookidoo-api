import type { CookieJar } from "tough-cookie";
import { CookidooAuthError, CookidooError } from "./errors.js";

/**
 * CIAM login service that accepts the credential POST during the
 * browser-style OAuth2/PKCE flow.
 */
export const CIAM_LOGIN_SRV_URL =
  "https://ciam.prod.cookidoo.vorwerk-digital.com/login-srv/login";

/** Cookies the OAuth2 proxy sets once a session is authenticated. */
export const REQUIRED_AUTH_COOKIES = ["_oauth2_proxy", "v-authenticated"] as const;

function loginPageUrl(baseUrl: string, language: string): string {
  const redirect = `%2Ffoundation%2F${language}%2Ffor-you`;
  return `${baseUrl}/profile/${language}/login?redirectAfterLogin=${redirect}`;
}

/**
 * Extract the `requestId` hidden field from the CIAM login page HTML.
 * The field position (before/after the value attribute) varies, so we try
 * both orderings.
 */
export function extractRequestId(html: string): string {
  const match =
    /<input[^>]*name=["']requestId["'][^>]*value=["']([^"']+)["']/i.exec(html) ??
    /<input[^>]*value=["']([0-9a-f-]{36})["'][^>]*name=["']requestId["']/i.exec(
      html,
    );
  if (!match) {
    throw new CookidooError({
      message:
        "Login flow failed: could not extract requestId from the login page.",
      status: 0,
      body: html.slice(0, 500),
      url: "login-page",
      method: "GET",
    });
  }
  return match[1] as string;
}

export interface BrowserLoginParams {
  baseUrl: string;
  language: string;
  email: string;
  password: string;
  /** A cookie-persisting fetch (e.g. from `fetch-cookie`). */
  fetch: typeof fetch;
  /** The jar backing `fetch`, inspected to confirm auth cookies were set. */
  jar: CookieJar;
}

/**
 * Perform the browser-based OAuth2 login, mirroring the Cookidoo web app:
 *
 * 1. GET `cookidoo.{tld}/profile/{lang}/login` — follows the redirect chain
 *    through OAuth2/PKCE to the CIAM login page.
 * 2. Extract `requestId` from the login form.
 * 3. POST credentials to the CIAM login service, following callback redirects.
 * 4. Confirm the session cookie jar now holds the auth cookies.
 *
 * On success the shared cookie jar authenticates every subsequent API call —
 * there is no bearer token to manage.
 */
export async function browserLogin(params: BrowserLoginParams): Promise<void> {
  const { baseUrl, language, email, password, fetch: f, jar } = params;

  const pageRes = await f(loginPageUrl(baseUrl, language));
  if (!pageRes.ok) {
    throw new CookidooAuthError({
      status: pageRes.status,
      body: `could not reach login page`,
      url: loginPageUrl(baseUrl, language),
      method: "GET",
    });
  }
  const requestId = extractRequestId(await pageRes.text());

  const body = new URLSearchParams({ requestId, username: email, password });
  await f(CIAM_LOGIN_SRV_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const cookies = await jar.getCookies(baseUrl);
  const names = new Set(cookies.map((c) => c.key));
  if (!REQUIRED_AUTH_COOKIES.every((name) => names.has(name))) {
    throw new CookidooAuthError({
      status: 401,
      body: "authentication cookies were not set — check email and password",
      url: CIAM_LOGIN_SRV_URL,
      method: "POST",
    });
  }
}
