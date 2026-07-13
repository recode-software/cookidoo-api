import { step } from "../builders/step.js";
import type { Annotation, Step } from "../types.js";
import { grammarPl, type Grammar } from "./grammar.js";
import {
  findIngredientAnnotations,
  type IngredientSource,
} from "./ingredients.js";
import { findTtsAnnotations } from "./tts.js";

export { findTtsAnnotations } from "./tts.js";
/**
 * @deprecated `MODE`/`name:"manual"` annotations render struck-through and
 * untappable on custom recipes. Use `findTtsAnnotations` (the default in
 * `parseStep`). Kept for callers that target the concrete named modes.
 */
export { findModeAnnotations, type FindModeOptions } from "./modes.js";
export { findIngredientAnnotations } from "./ingredients.js";
export type { IngredientSource } from "./ingredients.js";
export { timeToSeconds, parseSpeed, parseDurationToSeconds } from "./time.js";
export { grammarPl, grammars, type Grammar } from "./grammar.js";

export interface ParseStepOptions {
  includeIngredients?: boolean;
  grammar?: Grammar;
}

/**
 * Parse Polish (or custom-grammar) step text into a `Step`, combining
 * `TTS` operation annotations (the tappable time/temp/speed buttons) with
 * `INGREDIENT` annotations, sorted by position.
 */
export function parseStep(
  text: string,
  ingredients: IngredientSource[] = [],
  options: ParseStepOptions = {},
): Step {
  const grammar = options.grammar ?? grammarPl;
  const tts = findTtsAnnotations(text, grammar);
  const ings =
    options.includeIngredients === false
      ? []
      : findIngredientAnnotations(text, ingredients);
  const annotations: Annotation[] = [...tts, ...ings];
  return step(text, annotations);
}
