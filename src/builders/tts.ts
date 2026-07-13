import type { Direction, Position, TtsAnnotation } from "../types.js";

interface Base extends Position {}

/**
 * Build a `TTS` (Time / Temperature / Speed) annotation — the tappable
 * operation button for a generic "time/temp/speed" run.
 *
 * `direction` is emitted only when `"CCW"` (reverse); `temperature` only when
 * provided. A numeric temperature is stringified; pass a string to preserve
 * values like `"Varoma"`.
 */
export function tts(
  args: Base & {
    time?: number;
    speed?: string;
    temperature?: number | string;
    direction?: Direction;
    temperatureUnit?: "C" | "F";
  },
): TtsAnnotation {
  const data: TtsAnnotation["data"] = {};
  if (args.time !== undefined) data.time = args.time;
  if (args.speed !== undefined) data.speed = args.speed;
  if (args.temperature !== undefined) {
    data.temperature = {
      value: String(args.temperature),
      unit: args.temperatureUnit ?? "C",
    };
  }
  // Clockwise is the default and is represented by omitting `direction`.
  if (args.direction === "CCW") data.direction = "CCW";
  return {
    type: "TTS",
    data,
    position: { offset: args.offset, length: args.length },
  };
}
