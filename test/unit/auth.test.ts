import { describe, expect, it, vi } from "vitest";
import { loginWithPassword, refreshToken } from "../../src/auth.js";
import { CookidooAuthError } from "../../src/errors.js";

function mockFetch(response: Partial<Response>): typeof fetch {
  return vi.fn().mockResolvedValue(
    new Response(response.body as BodyInit, {
      status: response.status ?? 200,
      headers: { "Content-Type": "application/json" },
    }),
  ) as unknown as typeof fetch;
}

describe("loginWithPassword", () => {
  it("POSTs form body to /ciam/auth/token with Basic header", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: "at",
          refresh_token: "rt",
          expires_in: 3600,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const tokens = await loginWithPassword(
      "https://pl.tmmobile.vorwerk-digital.com",
      "u@e.com",
      "pw",
      fetchMock as unknown as typeof fetch,
    );
    expect(tokens.accessToken).toBe("at");
    expect(tokens.refreshToken).toBe("rt");
    expect(tokens.expiresAt).toBeGreaterThan(Date.now());

    const [url, init] = fetchMock.mock.calls[0] as [
      string,
      { method: string; headers: Record<string, string>; body: string },
    ];
    expect(url).toBe(
      "https://pl.tmmobile.vorwerk-digital.com/ciam/auth/token",
    );
    expect(init.method).toBe("POST");
    expect(init.headers["Authorization"]).toMatch(/^Basic /);
    expect(init.headers["Content-Type"]).toBe(
      "application/x-www-form-urlencoded",
    );
    const params = new URLSearchParams(init.body);
    expect(params.get("grant_type")).toBe("password");
    expect(params.get("username")).toBe("u@e.com");
    expect(params.get("password")).toBe("pw");
  });

  it("throws CookidooAuthError on non-2xx", async () => {
    const fetchMock = mockFetch({
      status: 401,
      body: JSON.stringify({ error: "invalid_grant" }),
    });
    await expect(
      loginWithPassword(
        "https://pl.tmmobile.vorwerk-digital.com",
        "u",
        "p",
        fetchMock,
      ),
    ).rejects.toBeInstanceOf(CookidooAuthError);
  });
});

describe("refreshToken", () => {
  it("sends grant_type=refresh_token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: "new",
          refresh_token: "newrt",
          expires_in: 3600,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    await refreshToken(
      "https://pl.tmmobile.vorwerk-digital.com",
      "old",
      fetchMock as unknown as typeof fetch,
    );
    const [, init] = fetchMock.mock.calls[0] as [
      string,
      { body: string },
    ];
    const params = new URLSearchParams(init.body);
    expect(params.get("grant_type")).toBe("refresh_token");
    expect(params.get("refresh_token")).toBe("old");
  });
});
