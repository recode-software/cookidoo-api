import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";

export const TEST_PREFIX = "__test__";
export const DEFAULT_PUBLIC_RECIPE_ID = "01KB04WSJP4SHNBKJK4H4FT0PZ";

let loaded = false;

function loadOnce(): void {
  if (loaded) return;
  loaded = true;
  const candidates = [
    resolve(process.cwd(), ".env"),
    resolve(process.cwd(), "..", ".env"),
  ];
  for (const p of candidates) {
    if (existsSync(p)) {
      loadEnv({ path: p });
      return;
    }
  }
}

export interface IntegrationEnv {
  email: string;
  password: string;
  country: string;
  language: string;
  publicRecipeId: string;
}

export function integrationEnv(): IntegrationEnv | null {
  loadOnce();
  const email = process.env.COOKIDOO_EMAIL;
  const password = process.env.COOKIDOO_PASSWORD;
  if (!email || !password) return null;
  return {
    email,
    password,
    country: process.env.COOKIDOO_COUNTRY ?? "pl",
    language: process.env.COOKIDOO_LANGUAGE ?? "pl",
    publicRecipeId:
      process.env.COOKIDOO_TEST_PUBLIC_RECIPE_ID ?? DEFAULT_PUBLIC_RECIPE_ID,
  };
}

export function hasIntegrationEnv(): boolean {
  return integrationEnv() !== null;
}

export function testRecipeName(caseName: string): string {
  return `${TEST_PREFIX} ${Date.now()} ${caseName}`;
}
