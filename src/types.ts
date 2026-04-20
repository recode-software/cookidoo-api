export type CountryCode = string;
export type LanguageCode = string;

export interface Position {
  offset: number;
  length: number;
}

export type ModeName =
  | "manual"
  | "dough"
  | "blend"
  | "turbo"
  | "warm_up"
  | "rice_cooker"
  | "steaming"
  | "browning";

export type Direction = "CW" | "CCW";

export interface Temperature {
  value: string;
  unit: "C" | "F";
}

export interface ModeData {
  time?: number;
  speed?: string;
  direction?: Direction;
  temperature?: Temperature;
  power?: "Gentle";
  pulseCount?: number;
  pulseCountMax?: number;
  accessory?: "Varoma";
}

export interface ModeAnnotation {
  type: "MODE";
  name: ModeName;
  data: ModeData;
  position: Position;
}

export interface VolumeAnnotation {
  type: "VOLUME";
  data: {
    amount: number;
    amountMax: number;
    unit: string;
    unitText: string;
  };
  position: Position;
}

export type IngredientDescription =
  | string
  | { text: string; annotations: VolumeAnnotation[] };

export interface IngredientAnnotation {
  type: "INGREDIENT" | "MISSED_INGREDIENT";
  data: {
    description: IngredientDescription;
    notes: string[];
  };
  position: Position;
}

export type Annotation = ModeAnnotation | IngredientAnnotation;

export interface Step {
  type: "STEP";
  text: string;
  annotations?: Annotation[];
  missedUsages?: unknown[];
}

export interface Ingredient {
  type: "INGREDIENT";
  text: string;
}

export interface RecipeYield {
  value: number;
  unitText: string;
}

export interface RecipeContent {
  name: string;
  image?: string;
  ingredients: Ingredient[];
  instructions: Step[];
  tools?: string[];
  yield?: RecipeYield;
  prepTime?: number;
  totalTime?: number;
  descriptiveAssets?: unknown[];
  isImageCopyrightOwned?: boolean;
  hints?: unknown[];
}

export interface Recipe {
  recipeId: string;
  authorId?: string;
  parentRecipeId?: string;
  status?: "ACTIVE" | string;
  workStatus?: "PRIVATE" | "PUBLIC";
  createdAt?: string;
  modifiedAt?: string;
  recipeContent: RecipeContent;
}

export interface RecipeSummary {
  recipeId: string;
  name: string;
  modifiedAt?: string;
  createdAt?: string;
  [key: string]: unknown;
}

export interface MetaPatch {
  name?: string;
  ingredients?: Ingredient[];
  yield?: RecipeYield;
  prepTime?: number;
  totalTime?: number;
}

export interface CopyFromPublicInput {
  publicId: string;
  servingSize?: number;
  retry?: CopyRetryOptions | false;
}

export interface CopyRetryOptions {
  /** Wait delays in milliseconds for each retry after a 429. */
  delaysMs?: number[];
  /** Called before each retry wait. Useful for logging in CLI tools. */
  onRateLimit?: (info: {
    attempt: number;
    delayMs: number;
    retryAfterMs: number | null;
  }) => void;
}

/**
 * Default backoff for the copy-from-public rate limit (code: "importFailed").
 * Per docs §5: no Retry-After header; 30 → 60 → 90 → 120 s clears reliably.
 */
export const DEFAULT_COPY_RETRY_DELAYS_MS: number[] = [
  30_000, 60_000, 90_000, 120_000,
];
