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

/** Build a client with login short-circuited (cookie session assumed valid). */
function loggedInClient(fetch: typeof fetch, country = "pl", language = "pl"): CookidooClient {
  const client = new CookidooClient({
    email: "u@e.com",
    password: "pw",
    country,
    language,
    fetch,
  });
  (client as unknown as { loggedIn: boolean }).loggedIn = true;
  return client;
}

describe("RecipesApi", () => {
  let client: CookidooClient;
  let calls: Call[];

  beforeEach(() => {
    const q = makeFetchQueue([
      { status: 200, json: { recipeId: "R1", recipeContent: { name: "x", ingredients: [], instructions: [] } } },
    ]);
    calls = q.calls;
    client = loggedInClient(q.fetch);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("copyFromPublic uses created-recipes URL (not /recipe/)", async () => {
    await client.recipes.copyFromPublic({ publicId: "01KABC", servingSize: 1 });
    const apiCall = calls[0];
    expect(apiCall?.url).toBe("https://cookidoo.pl/created-recipes/pl");
    const body = JSON.parse(String(apiCall?.init.body));
    expect(body.recipeUrl).toBe(
      "https://cookidoo.pl/created-recipes/public/recipes/pl/01KABC",
    );
    expect(body.servingSize).toBe(1);
  });

  it("uses full-view Accept header and cookie auth (no Authorization)", async () => {
    await client.recipes.copyFromPublic({ publicId: "x" });
    const headers = calls[0]?.init.headers as Record<string, string>;
    expect(headers["Accept"]).toBe(FULL_VIEW_ACCEPT);
    expect(headers["Authorization"]).toBeUndefined();
    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("create posts { recipeName } then GETs the full recipe", async () => {
    const q = makeFetchQueue([
      { status: 200, json: { recipeId: "R9" } },
      { status: 200, json: { recipeId: "R9", recipeContent: { name: "n", ingredients: [], instructions: [] } } },
    ]);
    const c = loggedInClient(q.fetch);
    const recipe = await c.recipes.create("Nowy przepis");
    expect(q.calls[0]?.init.method).toBe("POST");
    expect(q.calls[0]?.url).toBe("https://cookidoo.pl/created-recipes/pl");
    expect(JSON.parse(String(q.calls[0]?.init.body))).toEqual({ recipeName: "Nowy przepis" });
    expect(q.calls[1]?.url).toBe("https://cookidoo.pl/created-recipes/pl/R9");
    expect(recipe.recipeId).toBe("R9");
  });

  it("patchInstructions wraps payload under { instructions }", async () => {
    const q = makeFetchQueue([
      { status: 200, json: { recipeId: "R1", recipeContent: { name: "x", ingredients: [], instructions: [] } } },
    ]);
    const c = loggedInClient(q.fetch);
    await c.recipes.patchInstructions("R1", [{ type: "STEP", text: "a" }]);
    const call = q.calls[0];
    expect(call?.init.method).toBe("PATCH");
    expect(call?.url).toBe("https://cookidoo.pl/created-recipes/pl/R1");
    const body = JSON.parse(String(call?.init.body));
    expect(body).toEqual({ instructions: [{ type: "STEP", text: "a" }] });
  });

  it("delete sends DELETE to recipe path", async () => {
    const q = makeFetchQueue([{ status: 204 }]);
    const c = loggedInClient(q.fetch);
    await c.recipes.delete("R1");
    expect(q.calls[0]?.init.method).toBe("DELETE");
    expect(q.calls[0]?.url).toBe("https://cookidoo.pl/created-recipes/pl/R1");
  });

  it("copyFromPublic throws CookidooRateLimitError on 429 when retry:false", async () => {
    const q = makeFetchQueue([
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
    const c = loggedInClient(q.fetch);
    await expect(
      c.recipes.copyFromPublic({ publicId: "X", retry: false }),
    ).rejects.toBeInstanceOf(CookidooRateLimitError);
  });

  it("copyFromPublic auto-retries on 429 with delaysMs", async () => {
    vi.useFakeTimers();
    const q = makeFetchQueue([
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
    const c = loggedInClient(q.fetch);
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
