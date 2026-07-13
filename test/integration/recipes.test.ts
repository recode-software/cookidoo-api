import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  CookidooClient,
  ingredient,
  parseStep,
  step,
  tts,
  type Recipe,
} from "../../src/index.js";
import { safeDelete, sweepTestRecipes } from "../helpers/cleanup.js";
import { hasIntegrationEnv, integrationEnv, testRecipeName } from "../helpers/env.js";

const runIntegration = hasIntegrationEnv();

describe.skipIf(!runIntegration)("RecipesApi integration", () => {
  let client: CookidooClient;
  const created: string[] = [];

  beforeAll(async () => {
    const env = integrationEnv()!;
    client = new CookidooClient({
      email: env.email,
      password: env.password,
      country: env.country,
      language: env.language,
    });
    await client.login();
    await sweepTestRecipes(client);
  });

  afterEach(async () => {
    while (created.length > 0) {
      const id = created.pop();
      await safeDelete(client, id ?? null);
    }
  });

  afterAll(async () => {
    await sweepTestRecipes(client);
  });

  it("creates a blank recipe and returns a new ULID recipeId", async () => {
    const recipe = await client.recipes.create(testRecipeName("create"));
    created.push(recipe.recipeId);
    expect(recipe.recipeId).toMatch(/^01[0-9A-HJKMNP-TV-Z]+$/);
    expect(recipe.recipeContent.name).toBeTypeOf("string");
  });

  it(
    "full cycle: create → patch meta → patch instructions → GET verifies TTS annotations",
    async () => {
      const name = testRecipeName("full-cycle");

      const initial = await client.recipes.create(name);
      created.push(initial.recipeId);

      await client.recipes.patchMeta(initial.recipeId, {
        name,
        ingredients: [
          { type: "INGREDIENT", text: "50 g jabłka" },
          { type: "INGREDIENT", text: "5 g masła ekstra" },
        ],
        yield: { value: 1, unitText: "portion" },
        prepTime: 1800,
        totalTime: 1800,
      });

      const stepText =
        "Do naczynia włóż jabłko, praż 10 min/100°C/obr. 1. Przełóż.";
      const parsed = parseStep(stepText, [
        { display: "50 g jabłka", stem: "jabłk", amount: 50, unit: "g" },
      ]);
      const ttsStep = step("Podgrzej 15 min/90°C/obr. wsteczne 1.", [
        tts({ offset: 9, length: 26, time: 900, temperature: 90, speed: "1", direction: "CCW" }),
      ]);
      const simpleStep = step("Podawaj z jabłkiem.", [
        ingredient.simple({
          offset: 10,
          length: 8,
          description: "50 g jabłka",
        }),
      ]);

      await client.recipes.patchInstructions(initial.recipeId, [
        parsed,
        ttsStep,
        simpleStep,
      ]);

      const fetched: Recipe = await client.recipes.get(initial.recipeId);
      expect(fetched.recipeContent.name).toBe(name);
      expect(fetched.recipeContent.instructions).toHaveLength(3);
      const firstStep = fetched.recipeContent.instructions[0];
      expect(firstStep?.type).toBe("STEP");
      const hasTts = firstStep?.annotations?.some((a) => a.type === "TTS");
      expect(hasTts).toBe(true);
    },
    60_000,
  );
});
