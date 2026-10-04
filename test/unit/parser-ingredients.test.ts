import { describe, expect, it } from "vitest";
import { findIngredientAnnotations, parseStep } from "../../src/parser/index.js";

describe("findIngredientAnnotations", () => {
  it("matches stem 'jabłk' in text and builds structured VOLUME", () => {
    const text = "Do naczynia włóż jabłko, dodaj masło.";
    const [ann] = findIngredientAnnotations(text, [
      { display: "50 g jabłka", stem: "jabłk", amount: 50, unit: "g" },
    ]);
    expect(ann?.type).toBe("INGREDIENT");
    expect(ann?.position.offset).toBe(text.indexOf("jabłk"));
    expect(ann?.position.length).toBe("jabłko".length);

    const desc = ann?.data.description as {
      text: string;
      annotations: Array<{ data: { amount: number; unit: string } }>;
    };
    expect(desc.annotations[0]?.data).toEqual({
      amount: 50,
      amountMax: 50,
      unit: "g",
      unitText: "g",
    });
  });

  it("matches stems that start with a non-ASCII letter (ś, ł, ż…)", () => {
    const text = "Dodaj śmietanę i żurawinę.";
    const anns = findIngredientAnnotations(text, [
      { display: "60 g śmietany", stem: "śmietan", amount: 60, unit: "g" },
      { display: "20 g żurawiny", stem: "żurawin", amount: 20, unit: "g" },
    ]);
    expect(anns).toHaveLength(2);
    expect(anns[0]?.position.offset).toBe(text.indexOf("śmietan"));
    expect(anns[1]?.position.offset).toBe(text.indexOf("żurawin"));
  });

  it("covers the whole inflected word when it ends with a non-ASCII letter", () => {
    const text = "Dodaj mąkę.";
    const [ann] = findIngredientAnnotations(text, [
      { display: "270 g mąki", stem: "mąk", amount: 270, unit: "g" },
    ]);
    expect(ann?.position.length).toBe("mąkę".length);
  });

  it("does not match a stem in the middle of a word", () => {
    const anns = findIngredientAnnotations("Dodaj kamąkę.", [
      { display: "270 g mąki", stem: "mąk", amount: 270, unit: "g" },
    ]);
    expect(anns).toHaveLength(0);
  });

  it("skips overlapping subsequent matches (same stem)", () => {
    const text = "jabłko i jabłka";
    const anns = findIngredientAnnotations(text, [
      { display: "50 g jabłka", stem: "jabłk", amount: 50, unit: "g" },
    ]);
    expect(anns).toHaveLength(1);
    expect(anns[0]?.position.offset).toBe(0);
  });

  it("returns no annotations when stem not present", () => {
    const anns = findIngredientAnnotations("pustki", [
      { display: "50 g jabłka", stem: "jabłk", amount: 50, unit: "g" },
    ]);
    expect(anns).toEqual([]);
  });
});

describe("parseStep", () => {
  it("combines TTS ops + ingredients into a sorted Step", () => {
    const text =
      "Do naczynia włóż jabłko, praż 10 min/100°C/obr. 1. Przełóż.";
    const s = parseStep(text, [
      { display: "50 g jabłka", stem: "jabłk", amount: 50, unit: "g" },
    ]);
    expect(s.type).toBe("STEP");
    expect(s.annotations).toBeDefined();
    const types = s.annotations!.map((a) => a.type);
    expect(types).toContain("INGREDIENT");
    expect(types).toContain("TTS");
    const offsets = s.annotations!.map((a) => a.position.offset);
    expect(offsets).toEqual([...offsets].sort((x, y) => x - y));
  });

  it("respects includeIngredients=false", () => {
    const s = parseStep(
      "praż 10 min/100°C/obr. 1 jabłko",
      [{ display: "50 g jabłka", stem: "jabłk", amount: 50, unit: "g" }],
      { includeIngredients: false },
    );
    expect(s.annotations!.every((a) => a.type === "TTS")).toBe(true);
  });
});
