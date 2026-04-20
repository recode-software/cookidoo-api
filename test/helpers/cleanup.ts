import type { CookidooClient } from "../../src/index.js";
import { TEST_PREFIX } from "./env.js";

export async function sweepTestRecipes(client: CookidooClient): Promise<number> {
  let removed = 0;
  const list = await client.recipes.list();
  for (const summary of list) {
    const name = typeof summary.name === "string" ? summary.name : "";
    if (!name.startsWith(TEST_PREFIX)) continue;
    try {
      await client.recipes.delete(summary.recipeId);
      removed += 1;
    } catch {
      // best-effort cleanup
    }
  }
  return removed;
}

export async function safeDelete(
  client: CookidooClient,
  id: string | null,
): Promise<void> {
  if (!id) return;
  try {
    await client.recipes.delete(id);
  } catch {
    // swallow — afterAll sweep handles leftovers
  }
}
