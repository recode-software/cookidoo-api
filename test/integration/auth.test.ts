import { describe, expect, it } from "vitest";
import { CookidooClient } from "../../src/index.js";
import { hasIntegrationEnv, integrationEnv } from "../helpers/env.js";

describe.skipIf(!hasIntegrationEnv())("auth integration", () => {
  it("login + list custom recipes smoke test", async () => {
    const env = integrationEnv()!;
    const client = new CookidooClient({
      email: env.email,
      password: env.password,
      country: env.country,
      language: env.language,
    });
    await client.login();
    const tokens = client.getTokens();
    expect(tokens?.accessToken.length ?? 0).toBeGreaterThan(0);
    const list = await client.recipes.list();
    expect(Array.isArray(list)).toBe(true);
  });
});
