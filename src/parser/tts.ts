import type { TtsAnnotation } from "../types.js";
import { grammarPl, type Grammar } from "./grammar.js";
import { parseDurationToSeconds, parseSpeed } from "./time.js";

interface BuiltRegexes {
  full: RegExp;
  timeSpeed: RegExp;
}

function buildRegexes(g: Grammar): BuiltRegexes {
  const t = g.timeUnitsPattern;
  const sp = g.speedLabel;
  const rev = g.reverseWord;
  // A duration head of one or two `<number><unit>` tokens ("5 min 30 s").
  const durTok = `\\d+(?:[-–]\\d+)?\\s*(?:${t})`;
  const duration = `(${durTok}(?:\\s+${durTok})?)`;
  const speed = `((?:${rev}\\s*)?\\d+(?:[,.]\\d+)?(?:\\s*${rev})?)`;
  return {
    full: new RegExp(
      `${duration}\\s*\\/\\s*(?:(\\d+)\\s*°\\s*C|(Varoma))\\s*\\/\\s*${sp}\\s*${speed}`,
      "gi",
    ),
    timeSpeed: new RegExp(`${duration}\\s*\\/\\s*${sp}\\s*${speed}`, "gi"),
  };
}

/**
 * Find Time/Temperature/Speed operation runs in step text and emit `TTS`
 * annotations — the correct, tappable encoding for a generic
 * "time/temp/speed" (or "time/speed") operation.
 *
 * A `Varoma` temperature is matched (so the speed/time button still renders)
 * but no `temperature` field is emitted, since the exact Varoma encoding for
 * custom recipes is unverified. Steaming/Varoma as a dedicated mode is out of
 * scope here.
 */
export function findTtsAnnotations(
  text: string,
  grammar: Grammar = grammarPl,
): TtsAnnotation[] {
  const out: TtsAnnotation[] = [];
  const { full, timeSpeed } = buildRegexes(grammar);

  for (const m of text.matchAll(full)) {
    const start = m.index ?? 0;
    const length = m[0].length;
    const durationRaw = m[1] as string;
    const tempStr = m[2];
    const speedRaw = m[4] as string;
    const { speed, direction } = parseSpeed(speedRaw, grammar.reverseWord);
    const data: TtsAnnotation["data"] = {
      time: parseDurationToSeconds(durationRaw, grammar),
      speed,
    };
    if (tempStr) data.temperature = { value: tempStr, unit: "C" };
    if (direction === "CCW") data.direction = "CCW";
    out.push({ type: "TTS", data, position: { offset: start, length } });
  }

  for (const m of text.matchAll(timeSpeed)) {
    const start = m.index ?? 0;
    const end = start + m[0].length;
    const overlaps = out.some(
      (a) =>
        !(end <= a.position.offset ||
          start >= a.position.offset + a.position.length),
    );
    if (overlaps) continue;
    const durationRaw = m[1] as string;
    const speedRaw = m[2] as string;
    const { speed, direction } = parseSpeed(speedRaw, grammar.reverseWord);
    const data: TtsAnnotation["data"] = {
      time: parseDurationToSeconds(durationRaw, grammar),
      speed,
    };
    if (direction === "CCW") data.direction = "CCW";
    out.push({ type: "TTS", data, position: { offset: start, length: end - start } });
  }

  out.sort((a, b) => a.position.offset - b.position.offset);
  return out;
}
