import { describe, expect, it } from "vitest";
import {
  findModeAnnotations,
  type Grammar,
} from "../../src/parser/index.js";

describe("findModeAnnotations", () => {
  it("praż … 100°C/obr. 1 → browning clamped to 140", () => {
    const text =
      "Do naczynia włóż jabłko, praż 10 min/100°C/obr. 1. Przełóż.";
    const [ann] = findModeAnnotations(text);
    expect(ann?.name).toBe("browning");
    expect(ann?.data.temperature).toEqual({ value: "140", unit: "C" });
    expect(ann?.data.power).toBe("Gentle");
    expect(ann?.data.time).toBe(600);
  });

  it("time/temp/obr without praż is dropped by default (manual unsupported on custom recipes)", () => {
    const text = "wymieszaj 20 min/60°C/obr. 2.";
    expect(findModeAnnotations(text)).toEqual([]);
  });

  it("time/temp/obr emits manual when emitManual:true", () => {
    const text = "wymieszaj 20 min/60°C/obr. 2.";
    const [ann] = findModeAnnotations(text, undefined, { emitManual: true });
    expect(ann?.name).toBe("manual");
    expect(ann?.data.temperature).toEqual({ value: "60", unit: "C" });
    expect(ann?.data.speed).toBe("2");
  });

  it("Varoma → steaming WITHOUT temperature field", () => {
    const text = "gotuj 15 min/Varoma/obr. 1.";
    const [ann] = findModeAnnotations(text);
    expect(ann?.name).toBe("steaming");
    expect(ann?.data.accessory).toBe("Varoma");
    expect(ann?.data.temperature).toBeUndefined();
  });

  it("wsteczne → CCW direction (on Varoma branch, not manual)", () => {
    const text = "gotuj 12 min/Varoma/obr. 1 wsteczne.";
    const [ann] = findModeAnnotations(text);
    expect(ann?.name).toBe("steaming");
    expect(ann?.data.direction).toBe("CCW");
  });

  it("time/speed only is dropped by default (would have been manual)", () => {
    const text = "ubij 3 min/obr. 3,5.";
    expect(findModeAnnotations(text)).toEqual([]);
  });

  it("time/speed only emits manual when emitManual:true", () => {
    const text = "ubij 3 min/obr. 3,5.";
    const [ann] = findModeAnnotations(text, undefined, { emitManual: true });
    expect(ann?.name).toBe("manual");
    expect(ann?.data.temperature).toBeUndefined();
    expect(ann?.data.speed).toBe("3.5");
    expect(ann?.data.time).toBe(180);
  });

  it("returns annotations sorted by offset", () => {
    const text = "praż 10 min/100°C/obr. 1; potem gotuj 20 min/Varoma/obr. 2.";
    const anns = findModeAnnotations(text);
    const offsets = anns.map((a) => a.position.offset);
    expect(offsets).toEqual([...offsets].sort((x, y) => x - y));
    expect(anns.map((a) => a.name)).toEqual(["browning", "steaming"]);
  });
});

describe("custom grammar", () => {
  const grammarDe: Grammar = {
    name: "de",
    timeUnits: { s: 1, sek: 1, min: 60, h: 3600, std: 3600 },
    timeUnitsPattern: "min|sek\\.?|std\\.?|s|h",
    speedLabel: "Stufe",
    reverseWord: "linkslauf|rückwärts",
    browningTrigger: "anbr(a|ä)t",
  };

  it("parses a German-style fragment (emitManual for non-custom contexts)", () => {
    const text = "Rühren 20 s/60°C/Stufe 2.";
    const [ann] = findModeAnnotations(text, grammarDe, { emitManual: true });
    expect(ann?.name).toBe("manual");
    expect(ann?.data.time).toBe(20);
    expect(ann?.data.speed).toBe("2");
    expect(ann?.data.temperature).toEqual({ value: "60", unit: "C" });
  });

  it("default grammar (PL) does NOT match Stufe", () => {
    const text = "Rühren 20 s/60°C/Stufe 2.";
    expect(findModeAnnotations(text)).toEqual([]);
  });
});
