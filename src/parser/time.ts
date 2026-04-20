import { grammarPl, type Grammar } from "./grammar.js";

export function timeToSeconds(
  value: string,
  unit: string,
  timeUnits: Grammar["timeUnits"] = grammarPl.timeUnits,
): number {
  const normalized = value.replace(",", ".");
  const unitKey = unit.replace(/\.$/, "").toLowerCase();
  const multiplier = timeUnits[unitKey];
  if (multiplier === undefined) {
    throw new Error(`Unknown time unit: ${unit}`);
  }
  return Math.round(parseFloat(normalized) * multiplier);
}

export function firstTimePart(raw: string): string {
  const match = /^(\d+)/.exec(raw);
  return match ? (match[1] as string) : raw;
}

export interface SpeedParse {
  speed: string;
  direction: "CW" | "CCW";
}

export function parseSpeed(
  raw: string,
  reverseWordPattern: string = grammarPl.reverseWord,
): SpeedParse {
  let direction: "CW" | "CCW" = "CW";
  const text = raw.trim();
  if (new RegExp(reverseWordPattern, "i").test(text)) direction = "CCW";
  const m = /(\d+(?:[,.]\d+)?)/.exec(text);
  if (!m) return { speed: "1", direction };
  const raw2 = (m[1] as string).replace(",", ".");
  const num = parseFloat(raw2);
  return {
    speed: Number.isInteger(num) ? String(num) : raw2,
    direction,
  };
}
