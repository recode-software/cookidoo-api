import { describe, expect, it, vi } from "vitest";
import { CookieJar } from "tough-cookie";
import {
  browserLogin,
  CIAM_LOGIN_SRV_URL,
  extractRequestId,
} from "../../src/auth.js";
import { CookidooError, CookidooAuthError } from "../../src/errors.js";

const REQUEST_ID = "2f9d8729-4b73-429c-81f0-c25debf11584";
const LOGIN_HTML = `<form action="/x"><input type="hidden" name="requestId" value="${REQUEST_ID}"></form>`;

function html(body: string, status = 200): Response {
  return new Response(body, { status, headers: { "Content-Type": "text/html" } });
}

async function authedJar(): Promise<CookieJar> {
  const jar = new CookieJar();
  await jar.setCookie("_oauth2_proxy=abc; Path=/", "https://cookidoo.pl");
  await jar.setCookie("v-authenticated=1; Path=/", "https://cookidoo.pl");
  return jar;
}

describe("extractRequestId", () => {
  it("reads the hidden requestId field", () => {
    expect(extractRequestId(LOGIN_HTML)).toBe(REQUEST_ID);
  });

  it("reads value-before-name ordering", () => {
    const reordered = `<input value="${REQUEST_ID}" name="requestId">`;
    expect(extractRequestId(reordered)).toBe(REQUEST_ID);
  });

  it("throws when absent", () => {
    expect(() => extractRequestId("<form></form>")).toThrow(CookidooError);
  });
});

describe("browserLogin", () => {
  it("GETs the login page then POSTs requestId + credentials to CIAM", async () => {
    const jar = await authedJar();
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const f = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return calls.length === 1 ? html(LOGIN_HTML) : new Response("", { status: 200 });
    }) as unknown as typeof fetch;

    await browserLogin({
      baseUrl: "https://cookidoo.pl",
      language: "pl",
      email: "u@e.com",
      password: "pw",
      fetch: f,
      jar,
    });

    expect(calls[0]?.url).toBe(
      "https://cookidoo.pl/profile/pl/login?redirectAfterLogin=%2Ffoundation%2Fpl%2Ffor-you",
    );
    expect(calls[1]?.url).toBe(CIAM_LOGIN_SRV_URL);
    expect(calls[1]?.init?.method).toBe("POST");
    const params = new URLSearchParams(String(calls[1]?.init?.body));
    expect(params.get("requestId")).toBe(REQUEST_ID);
    expect(params.get("username")).toBe("u@e.com");
    expect(params.get("password")).toBe("pw");
  });

  it("throws CookidooAuthError when auth cookies were not set", async () => {
    const jar = new CookieJar(); // empty — login did not authenticate
    const f = vi.fn(async (url: RequestInfo | URL) =>
      String(url).includes("/profile/") ? html(LOGIN_HTML) : new Response("", { status: 200 }),
    ) as unknown as typeof fetch;

    await expect(
      browserLogin({
        baseUrl: "https://cookidoo.pl",
        language: "pl",
        email: "u@e.com",
        password: "bad",
        fetch: f,
        jar,
      }),
    ).rejects.toBeInstanceOf(CookidooAuthError);
  });

  it("throws CookidooAuthError when the login page is unreachable", async () => {
    const jar = await authedJar();
    const f = vi.fn(async () => html("nope", 503)) as unknown as typeof fetch;
    await expect(
      browserLogin({
        baseUrl: "https://cookidoo.pl",
        language: "pl",
        email: "u@e.com",
        password: "pw",
        fetch: f,
        jar,
      }),
    ).rejects.toBeInstanceOf(CookidooAuthError);
  });
});
