import type { Annotation, Step } from "../types.js";

export function step(text: string, annotations: Annotation[] = []): Step {
  const out: Step = { type: "STEP", text };
  if (annotations.length > 0) {
    out.annotations = [...annotations].sort(
      (a, b) => a.position.offset - b.position.offset,
    );
  }
  return out;
}
