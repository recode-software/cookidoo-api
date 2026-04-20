import type { CookidooClient } from "./client.js";
import { CookidooRateLimitError } from "./errors.js";
import {
  DEFAULT_COPY_RETRY_DELAYS_MS,
  type CopyFromPublicInput,
  type CopyRetryOptions,
  type MetaPatch,
  type Recipe,
  type RecipeSummary,
  type Step,
} from "./types.js";

export class RecipesApi {
  constructor(private readonly client: CookidooClient) {}

  private basePath(): string {
    return `/created-recipes/${this.client.language}`;
  }

  private recipePath(id: string): string {
    return `${this.basePath()}/${encodeURIComponent(id)}`;
  }

  private publicRecipeUrl(publicId: string): string {
    return `https://cookidoo.${this.client.country}/created-recipes/public/recipes/${this.client.language}/${publicId}`;
  }

  async list(): Promise<RecipeSummary[]> {
    const res = await this.client.request<RecipeSummary[] | { data?: RecipeSummary[] }>({
      method: "GET",
      path: this.basePath(),
    });
    if (Array.isArray(res)) return res;
    return res?.data ?? [];
  }

  get(id: string): Promise<Recipe> {
    return this.client.request<Recipe>({
      method: "GET",
      path: this.recipePath(id),
    });
  }

  async copyFromPublic(input: CopyFromPublicInput): Promise<Recipe> {
    const send = () =>
      this.client.request<Recipe>({
        method: "POST",
        path: this.basePath(),
        body: {
          recipeUrl: this.publicRecipeUrl(input.publicId),
          servingSize: input.servingSize ?? 1,
        },
      });

    if (input.retry === false) return send();

    const retry: CopyRetryOptions = input.retry ?? {};
    const delays = retry.delaysMs ?? DEFAULT_COPY_RETRY_DELAYS_MS;

    let attempt = 0;
    for (;;) {
      try {
        return await send();
      } catch (err) {
        if (!(err instanceof CookidooRateLimitError) || attempt >= delays.length) {
          throw err;
        }
        const delayMs = Math.max(
          err.retryAfterMs ?? 0,
          delays[attempt] ?? 0,
        );
        retry.onRateLimit?.({
          attempt: attempt + 1,
          delayMs,
          retryAfterMs: err.retryAfterMs,
        });
        await sleep(delayMs);
        attempt += 1;
      }
    }
  }

  patchMeta(id: string, patch: MetaPatch): Promise<Recipe> {
    return this.client.request<Recipe>({
      method: "PATCH",
      path: this.recipePath(id),
      body: patch,
    });
  }

  patchInstructions(id: string, instructions: Step[]): Promise<Recipe> {
    return this.client.request<Recipe>({
      method: "PATCH",
      path: this.recipePath(id),
      body: { instructions },
    });
  }

  async delete(id: string): Promise<void> {
    await this.client.request<void>({
      method: "DELETE",
      path: this.recipePath(id),
    });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
