import { describe, expect, it } from "vitest";
import { findTtsAnnotations, parseDurationToSeconds } from "../../src/parser/index.js";

describe("parseDurationToSeconds", () => {
  it("sums compound min + s", () => {
    expect(parseDurationToSeconds("5 min 30 s")).toBe(330);
  });
  it("handles single units", () => {
    expect(parseDurationToSeconds("16 min")).toBe(960);
    expect(parseDurationToSeconds("7 s")).toBe(7);
  });
  it("takes the first bound of a range", () => {
    expect(parseDurationToSeconds("4-6 min")).toBe(240);
  });
});

describe("findTtsAnnotations", () => {
  it("time/speed only → TTS with speed + time, no temperature/direction", () => {
    const text = "posiekaj 5 s/obr. 6.";
    const [ann] = findTtsAnnotations(text);
    expect(ann?.type).toBe("TTS");
    expect(ann?.data).toEqual({ time: 5, speed: "6" });
    const frag = text.slice(ann!.position.offset, ann!.position.offset + ann!.position.length);
    expect(frag).toBe("5 s/obr. 6");
  });

  it("time/temp/speed → TTS with temperature", () => {
    const [ann] = findTtsAnnotations("podsmaż 3 min/120°C/obr. 1.");
    expect(ann?.data).toEqual({
      time: 180,
      speed: "1",
      temperature: { value: "120", unit: "C" },
    });
  });

  it("compound time is summed to seconds", () => {
    const [ann] = findTtsAnnotations("redukuj 5 min 30 s/120°C/obr. 1.");
    expect(ann?.data.time).toBe(330);
  });

  it("reverse rotation → direction CCW", () => {
    const [ann] = findTtsAnnotations("wymieszaj 10 s/obr. wsteczne 1.");
    expect(ann?.data.direction).toBe("CCW");
    expect(ann?.data.speed).toBe("1");
  });

  it("clockwise omits direction", () => {
    const [ann] = findTtsAnnotations("gotuj 16 min/90°C/obr. 1.");
    expect(ann?.data.direction).toBeUndefined();
  });

  it("Varoma matches but emits no temperature field", () => {
    const [ann] = findTtsAnnotations("gotuj 15 min/Varoma/obr. 1.");
    expect(ann?.type).toBe("TTS");
    expect(ann?.data.temperature).toBeUndefined();
    expect(ann?.data).toMatchObject({ time: 900, speed: "1" });
  });

  it("decimal speed is preserved", () => {
    const [ann] = findTtsAnnotations("ubij 3 min/obr. 3,5.");
    expect(ann?.data.speed).toBe("3.5");
    expect(ann?.data.time).toBe(180);
  });

  it("returns multiple ops sorted by offset without overlap double-count", () => {
    const text = "posiekaj 5 s/obr. 6, potem gotuj 16 min/90°C/obr. 1.";
    const anns = findTtsAnnotations(text);
    expect(anns).toHaveLength(2);
    const offsets = anns.map((a) => a.position.offset);
    expect(offsets).toEqual([...offsets].sort((x, y) => x - y));
  });
});
