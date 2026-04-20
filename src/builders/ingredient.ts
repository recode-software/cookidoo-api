import type {
  IngredientAnnotation,
  Position,
  VolumeAnnotation,
} from "../types.js";

interface Base extends Position {}

export const ingredient = {
  simple(
    args: Base & {
      description: string;
      notes?: string[];
      missed?: boolean;
    },
  ): IngredientAnnotation {
    return {
      type: args.missed ? "MISSED_INGREDIENT" : "INGREDIENT",
      data: {
        description: args.description,
        notes: args.notes ?? [],
      },
      position: { offset: args.offset, length: args.length },
    };
  },

  structured(
    args: Base & {
      description: string;
      amount: number;
      amountMax?: number;
      unit: string;
      unitText?: string;
      notes?: string[];
      missed?: boolean;
    },
  ): IngredientAnnotation {
    const unitText = args.unitText ?? args.unit;
    const volumeText = `${formatAmount(args.amount, args.amountMax)} ${args.unit}`;
    const volumeIdx = args.description.indexOf(volumeText);
    const volumePos: Position = volumeIdx >= 0
      ? { offset: volumeIdx, length: volumeText.length }
      : { offset: 0, length: volumeText.length };

    const volume: VolumeAnnotation = {
      type: "VOLUME",
      data: {
        amount: args.amount,
        amountMax: args.amountMax ?? args.amount,
        unit: args.unit,
        unitText,
      },
      position: volumePos,
    };

    return {
      type: args.missed ? "MISSED_INGREDIENT" : "INGREDIENT",
      data: {
        description: {
          text: args.description,
          annotations: [volume],
        },
        notes: args.notes ?? [],
      },
      position: { offset: args.offset, length: args.length },
    };
  },
};

function formatAmount(amount: number, amountMax?: number): string {
  const a = trim(amount);
  if (amountMax === undefined || amountMax === amount) return a;
  return `${a}-${trim(amountMax)}`;
}

function trim(n: number): string {
  return Number.isInteger(n) ? n.toString() : String(n);
}
