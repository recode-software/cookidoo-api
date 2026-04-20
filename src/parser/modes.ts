import type { ModeAnnotation } from "../types.js";
import { grammarPl, type Grammar } from "./grammar.js";
import { firstTimePart, parseSpeed, timeToSeconds } from "./time.js";

interface BuiltRegexes {
  full: RegExp;
  timeSpeed: RegExp;
  browning: RegExp;
}

function buildRegexes(g: Grammar): BuiltRegexes {
  const t = g.timeUnitsPattern;
  const sp = g.speedLabel;
  const rev = g.reverseWord;
  return {
    full: new RegExp(
      `(\\d+(?:[-–]\\d+)?)\\s*(${t})\\s*\\/\\s*(?:(\\d+)\\s*°\\s*C|(Varoma))\\s*\\/\\s*${sp}\\s*((?:${rev}\\s*)?\\d+(?:[,.]\\d+)?(?:\\s*${rev})?)`,
      "gi",
    ),
    timeSpeed: new RegExp(
      `(\\d+(?:[-–]\\d+)?)\\s*(${t})\\s*\\/\\s*${sp}\\s*((?:${rev}\\s*)?\\d+(?:[,.]\\d+)?(?:\\s*${rev})?)`,
      "gi",
    ),
    browning: new RegExp(g.browningTrigger, "i"),
  };
}

function clampBrowningTemp(raw: number): number {
  if (raw >= 140 && raw <= 160) return raw;
  return 140;
}

export interface FindModeOptions {
  /**
   * Emit `MODE` annotations with `name: "manual"`.
   * Default `false` — the Cookidoo UI flags `manual` as unsupported on
   * custom recipes (struck-through, untappable). Set `true` only if you
   * are generating data for contexts other than a custom recipe.
   */
  emitManual?: boolean;
}

export function findModeAnnotations(
  text: string,
  grammar: Grammar = grammarPl,
  options: FindModeOptions = {},
): ModeAnnotation[] {
  const emitManual = options.emitManual ?? false;
  const out: ModeAnnotation[] = [];
  const { full, timeSpeed, browning } = buildRegexes(grammar);

  for (const m of text.matchAll(full)) {
    const start = m.index ?? 0;
    const end = start + m[0].length;
    const timeRaw = m[1] as string;
    const unit = m[2] as string;
    const tempStr = m[3];
    const varoma = m[4];
    const speedRaw = m[5] as string;
    const timeVal = timeToSeconds(firstTimePart(timeRaw), unit, grammar.timeUnits);
    const { speed, direction } = parseSpeed(speedRaw, grammar.reverseWord);
    const contextBefore = text.slice(Math.max(0, start - 20), start);

    if (varoma !== undefined) {
      out.push({
        type: "MODE",
        name: "steaming",
        data: {
          time: timeVal,
          speed,
          direction,
          accessory: "Varoma",
        },
        position: { offset: start, length: end - start },
      });
    } else if (browning.test(contextBefore) && tempStr) {
      const tempC = clampBrowningTemp(parseInt(tempStr, 10));
      out.push({
        type: "MODE",
        name: "browning",
        data: {
          time: timeVal,
          temperature: { value: String(tempC), unit: "C" },
          power: "Gentle",
        },
        position: { offset: start, length: end - start },
      });
    } else if (tempStr && emitManual) {
      out.push({
        type: "MODE",
        name: "manual",
        data: {
          time: timeVal,
          speed,
          direction,
          temperature: { value: tempStr, unit: "C" },
        },
        position: { offset: start, length: end - start },
      });
    }
  }

  if (emitManual) {
    for (const m of text.matchAll(timeSpeed)) {
      const start = m.index ?? 0;
      const end = start + m[0].length;
      const overlaps = out.some(
        (a) =>
          !(end <= a.position.offset ||
            start >= a.position.offset + a.position.length),
      );
      if (overlaps) continue;
      const timeRaw = m[1] as string;
      const unit = m[2] as string;
      const speedRaw = m[3] as string;
      const timeVal = timeToSeconds(firstTimePart(timeRaw), unit, grammar.timeUnits);
      const { speed, direction } = parseSpeed(speedRaw, grammar.reverseWord);
      out.push({
        type: "MODE",
        name: "manual",
        data: { time: timeVal, speed, direction },
        position: { offset: start, length: end - start },
      });
    }
  }

  out.sort((a, b) => a.position.offset - b.position.offset);
  return out;
}
