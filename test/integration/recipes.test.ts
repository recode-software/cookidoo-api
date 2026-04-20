import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  CookidooClient,
  ingredient,
  mode,
  parseStep,
  step,
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

  it("copies a public recipe and returns a new ULID recipeId", async () => {
    const env = integrationEnv()!;
    const recipe = await client.recipes.copyFromPublic({
      publicId: env.publicRecipeId,
      servingSize: 1,
    });
    created.push(recipe.recipeId);
    expect(recipe.recipeId).toMatch(/^01[0-9A-HJKMNP-TV-Z]+$/);
    expect(recipe.recipeContent.name).toBeTypeOf("string");
  });

  it(
    "full cycle: copy → patch meta → patch instructions → GET verifies annotations",
    async () => {
      const env = integrationEnv()!;
      const name = testRecipeName("full-cycle");

      const initial = await client.recipes.copyFromPublic({
        publicId: env.publicRecipeId,
        servingSize: 1,
      });
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
      const steamStep = step("Gotuj 15 min/Varoma/obr. 1.", [
        mode.steaming({ offset: 6, length: 20, time: 900, speed: "1" }),
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
        steamStep,
        simpleStep,
      ]);

      const fetched: Recipe = await client.recipes.get(initial.recipeId);
      expect(fetched.recipeContent.name).toBe(name);
      expect(fetched.recipeContent.instructions).toHaveLength(3);
      const firstStep = fetched.recipeContent.instructions[0];
      expect(firstStep?.type).toBe("STEP");
      expect(firstStep?.annotations?.length ?? 0).toBeGreaterThan(0);
      const hasBrowning = firstStep?.annotations?.some(
        (a) => a.type === "MODE" && a.name === "browning",
      );
      expect(hasBrowning).toBe(true);
    },
    60_000,
  );
});
