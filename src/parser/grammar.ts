export interface Grammar {
  /** Short locale tag, e.g. "pl", "de". For diagnostics. */
  readonly name: string;
  /** Map of time-unit abbreviation → seconds. Keys are lowercased, dot-stripped. */
  readonly timeUnits: Record<string, number>;
  /**
   * Regex-alternation fragment matching any time-unit abbreviation, longest-first.
   * Example PL: `"min|sek\\.?|s|h"`.
   */
  readonly timeUnitsPattern: string;
  /**
   * Regex fragment matching the "speed" indicator word in step text.
   * Example PL: `"obr\\.?"` (from "obroty"). Example DE: `"Stufe"`.
   */
  readonly speedLabel: string;
  /**
   * Regex fragment matching the reverse-direction marker (CCW).
   * Example PL: `"wsteczn\\w*"`. Example DE: `"linkslauf|rückwärts"`.
   */
  readonly reverseWord: string;
  /**
   * Regex fragment detected in the ~20 characters before a `time/temp/speed`
   * run to upgrade it from `manual` to `browning`.
   * Example PL: `"pra[zż]"` (praż / praz). Example DE: `"anbr(a|ä)t"`.
   */
  readonly browningTrigger: string;
}

export const grammarPl: Grammar = {
  name: "pl",
  timeUnits: { s: 1, sek: 1, min: 60, h: 3600 },
  timeUnitsPattern: "min|sek\\.?|s|h",
  speedLabel: "obr\\.?",
  reverseWord: "wsteczn\\w*",
  browningTrigger: "pra[zż]",
};

export const grammars = {
  pl: grammarPl,
} as const;
