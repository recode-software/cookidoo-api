import { describe, expect, it } from "vitest";
import { ingredient, mode, step } from "../../src/index.js";

describe("mode builder", () => {
  it("browning sets Gentle power and stringifies temp", () => {
    const ann = mode.browning({
      offset: 96,
      length: 19,
      time: 600,
      temperature: 140,
    });
    expect(ann).toEqual({
      type: "MODE",
      name: "browning",
      data: {
        time: 600,
        temperature: { value: "140", unit: "C" },
        power: "Gentle",
      },
      position: { offset: 96, length: 19 },
    });
  });

  it("manual without temperature omits it", () => {
    const ann = mode.manual({
      offset: 0,
      length: 10,
      time: 20,
      speed: "5",
      direction: "CW",
    });
    expect(ann.data.temperature).toBeUndefined();
    expect(ann.data.speed).toBe("5");
  });

  it("steaming sets Varoma accessory and omits temperature", () => {
    const ann = mode.steaming({
      offset: 0,
      length: 20,
      time: 900,
      speed: "1",
    });
    expect(ann.data.accessory).toBe("Varoma");
    expect(ann.data.temperature).toBeUndefined();
    expect(ann.data.direction).toBe("CW");
  });

  it("riceCooker emits empty data", () => {
    const ann = mode.riceCooker({ offset: 0, length: 5 });
    expect(ann.data).toEqual({});
  });
});

describe("ingredient builder", () => {
  it("simple form uses string description with notes:[]", () => {
    const ann = ingredient.simple({
      offset: 47,
      length: 6,
      description: "50 g jabłka",
    });
    expect(ann).toEqual({
      type: "INGREDIENT",
      data: { description: "50 g jabłka", notes: [] },
      position: { offset: 47, length: 6 },
    });
  });

  it("structured form pins VOLUME at start of description text", () => {
    const ann = ingredient.structured({
      offset: 47,
      length: 6,
      amount: 50,
      unit: "g",
      description: "50 g jabłka",
    });
    expect(ann.type).toBe("INGREDIENT");
    const desc = ann.data.description as {
      text: string;
      annotations: Array<{ position: { offset: number; length: number } }>;
    };
    expect(desc.text).toBe("50 g jabłka");
    expect(desc.annotations[0]?.position).toEqual({ offset: 0, length: 4 });
  });

  it("missed:true emits MISSED_INGREDIENT", () => {
    const ann = ingredient.simple({
      offset: 0,
      length: 4,
      description: "x",
      missed: true,
    });
    expect(ann.type).toBe("MISSED_INGREDIENT");
  });
});

describe("step builder", () => {
  it("sorts annotations by offset", () => {
    const s = step("abc", [
      mode.manual({ offset: 10, length: 1, time: 10 }),
      ingredient.simple({ offset: 2, length: 1, description: "x" }),
    ]);
    expect(s.annotations?.map((a) => a.position.offset)).toEqual([2, 10]);
  });

  it("omits empty annotations array", () => {
    const s = step("abc");
    expect(s.annotations).toBeUndefined();
  });
});
