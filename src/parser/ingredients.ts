import type { IngredientAnnotation, VolumeAnnotation } from "../types.js";

export interface IngredientSource {
  display: string;
  stem: string;
  amount: number;
  unit: string;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function nameAfterFirstSpace(display: string): string {
  const parts = display.split(" ");
  if (parts.length <= 2) return display;
  return parts.slice(2).join(" ");
}

export function findIngredientAnnotations(
  text: string,
  ingredients: IngredientSource[],
): IngredientAnnotation[] {
  const out: IngredientAnnotation[] = [];
  const used: Array<[number, number]> = [];

  for (const ing of ingredients) {
    const pattern = new RegExp(`\\b${escapeRegex(ing.stem)}\\w*`, "iu");
    const match = pattern.exec(text);
    if (!match) continue;
    const start = match.index;
    const end = start + match[0].length;
    if (used.some(([s, e]) => !(end <= s || start >= e))) continue;

    const volumeText = `${trimNumber(ing.amount)} ${ing.unit}`;
    const descriptionText = `${volumeText} ${nameAfterFirstSpace(ing.display)}`;
    const volume: VolumeAnnotation = {
      type: "VOLUME",
      data: {
        amount: ing.amount,
        amountMax: ing.amount,
        unit: ing.unit,
        unitText: ing.unit,
      },
      position: { offset: 0, length: volumeText.length },
    };

    out.push({
      type: "INGREDIENT",
      data: {
        description: {
          text: descriptionText,
          annotations: [volume],
        },
        notes: [],
      },
      position: { offset: start, length: end - start },
    });
    used.push([start, end]);
  }

  return out;
}

function trimNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : String(n);
}
