import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CookidooClient,
  CookidooRateLimitError,
  FULL_VIEW_ACCEPT,
} from "../../src/index.js";

interface Call {
  url: string;
  init: RequestInit;
}

function makeFetchQueue(responses: Array<Partial<Response> & { json?: unknown }>): {
  fetch: typeof fetch;
  calls: Call[];
} {
  const calls: Call[] = [];
  let i = 0;
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init: init ?? {} });
    const spec = responses[i++] ?? { status: 200, json: {} };
    const status = spec.status ?? 200;
    const hasBody = status !== 204 && status !== 205 && status !== 304;
    const body = hasBody && spec.json !== undefined
      ? JSON.stringify(spec.json)
      : null;
    return new Response(body, {
      status,
      headers: { "Content-Type": "application/json" },
    });
  });
  return { fetch: fn as unknown as typeof fetch, calls };
}

function authResponse() {
  return {
    status: 200,
    json: {
      access_token: "AT",
      refresh_token: "RT",
      expires_in: 3600,
    },
  };
}

describe("RecipesApi", () => {
  let client: CookidooClient;
  let calls: Call[];

  beforeEach(() => {
    const q = makeFetchQueue([
      authResponse(),
      { status: 200, json: { recipeId: "R1", recipeContent: { name: "x", ingredients: [], instructions: [] } } },
    ]);
    calls = q.calls;
    client = new CookidooClient({
      email: "u@e.com",
      password: "pw",
      country: "pl",
      language: "pl",
      fetch: q.fetch,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("copyFromPublic uses created-recipes URL (not /recipe/)", async () => {
    await client.recipes.copyFromPublic({ publicId: "01KABC", servingSize: 1 });
    const apiCall = calls[1];
    expect(apiCall?.url).toBe(
      "https://pl.tmmobile.vorwerk-digital.com/created-recipes/pl",
    );
    const body = JSON.parse(String(apiCall?.init.body));
    expect(body.recipeUrl).toBe(
      "https://cookidoo.pl/created-recipes/public/recipes/pl/01KABC",
    );
    expect(body.servingSize).toBe(1);
  });

  it("uses full-view Accept header and Bearer token", async () => {
    await client.recipes.copyFromPublic({ publicId: "x" });
    const headers = calls[1]?.init.headers as Record<string, string>;
    expect(headers["Accept"]).toBe(FULL_VIEW_ACCEPT);
    expect(headers["Authorization"]).toBe("Bearer AT");
    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("patchInstructions wraps payload under { instructions }", async () => {
    const q = makeFetchQueue([
      authResponse(),
      { status: 200, json: { recipeId: "R1", recipeContent: { name: "x", ingredients: [], instructions: [] } } },
    ]);
    const c = new CookidooClient({
      email: "u",
      password: "p",
      country: "pl",
      fetch: q.fetch,
    });
    await c.recipes.patchInstructions("R1", [
      { type: "STEP", text: "a" },
    ]);
    const call = q.calls[1];
    expect(call?.init.method).toBe("PATCH");
    expect(call?.url).toBe(
      "https://pl.tmmobile.vorwerk-digital.com/created-recipes/pl/R1",
    );
    const body = JSON.parse(String(call?.init.body));
    expect(body).toEqual({ instructions: [{ type: "STEP", text: "a" }] });
  });

  it("delete sends DELETE to recipe path", async () => {
    const q = makeFetchQueue([authResponse(), { status: 204 }]);
    const c = new CookidooClient({
      email: "u",
      password: "p",
      country: "pl",
      fetch: q.fetch,
    });
    await c.recipes.delete("R1");
    expect(q.calls[1]?.init.method).toBe("DELETE");
    expect(q.calls[1]?.url).toBe(
      "https://pl.tmmobile.vorwerk-digital.com/created-recipes/pl/R1",
    );
  });

  it("copyFromPublic throws CookidooRateLimitError on 429 when retry:false", async () => {
    const q = makeFetchQueue([
      authResponse(),
      {
        status: 429,
        json: {
          statusCode: 429,
          error: "Too Many Requests",
          code: "importFailed",
          message: "rate limited",
        },
      },
    ]);
    const c = new CookidooClient({
      email: "u",
      password: "p",
      country: "pl",
      fetch: q.fetch,
    });
    await expect(
      c.recipes.copyFromPublic({ publicId: "X", retry: false }),
    ).rejects.toBeInstanceOf(CookidooRateLimitError);
  });

  it("copyFromPublic auto-retries on 429 with delaysMs", async () => {
    vi.useFakeTimers();
    const q = makeFetchQueue([
      authResponse(),
      {
        status: 429,
        json: { statusCode: 429, code: "importFailed", message: "nope" },
      },
      {
        status: 200,
        json: {
          recipeId: "R2",
          recipeContent: { name: "ok", ingredients: [], instructions: [] },
        },
      },
    ]);
    const c = new CookidooClient({
      email: "u",
      password: "p",
      country: "pl",
      fetch: q.fetch,
    });
    const onRateLimit = vi.fn();
    const promise = c.recipes.copyFromPublic({
      publicId: "X",
      retry: { delaysMs: [10], onRateLimit },
    });
    await vi.advanceTimersByTimeAsync(10);
    const recipe = await promise;
    expect(recipe.recipeId).toBe("R2");
    expect(onRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ attempt: 1, delayMs: 10 }),
    );
    vi.useRealTimers();
  });
});
