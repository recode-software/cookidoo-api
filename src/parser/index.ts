import { step } from "../builders/step.js";
import type { Annotation, Step } from "../types.js";
import { grammarPl, type Grammar } from "./grammar.js";
import {
  findIngredientAnnotations,
  type IngredientSource,
} from "./ingredients.js";
import { findModeAnnotations } from "./modes.js";

export { findModeAnnotations, type FindModeOptions } from "./modes.js";
export { findIngredientAnnotations } from "./ingredients.js";
export type { IngredientSource } from "./ingredients.js";
export { timeToSeconds, parseSpeed } from "./time.js";
export { grammarPl, grammars, type Grammar } from "./grammar.js";

export interface ParseStepOptions {
  includeIngredients?: boolean;
  grammar?: Grammar;
  /**
   * Emit `MODE` annotations with `name: "manual"`. Default `false` —
   * `manual` is silently unsupported on custom recipes.
   */
  emitManual?: boolean;
}

export function parseStep(
  text: string,
  ingredients: IngredientSource[] = [],
  options: ParseStepOptions = {},
): Step {
  const grammar = options.grammar ?? grammarPl;
  const modes = findModeAnnotations(text, grammar, {
    emitManual: options.emitManual ?? false,
  });
  const ings =
    options.includeIngredients === false
      ? []
      : findIngredientAnnotations(text, ingredients);
  const annotations: Annotation[] = [...modes, ...ings];
  return step(text, annotations);
}
