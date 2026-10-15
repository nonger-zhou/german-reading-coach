import { describe, expect, it } from "vitest";
import type { AnalyzedVocabularyItem } from "./types";
import { locateSurfaceInText, repairVocabularySurfaceForms } from "./repairSurfaceForms";

function item(surface: string, lemma = surface): AnalyzedVocabularyItem {
  return {
    surface_form: surface,
    lemma,
    normalized_key: lemma.toLowerCase(),
    part_of_speech: "noun",
    grammatical_gender: "n",
    level_estimate: "B2",
    zh_meaning: "",
    simple_de_explanation: "",
    example_sentence: "",
    reason_for_selection: "",
  };
}

const DE =
  "Die Polizei spricht von einem schweren Verbrechen. Die Rüstungsindustrie profitiert. Man hält an der Tradition fest, an alten Traditionen.";

describe("repairVocabularySurfaceForms", () => {
  it("drops an article the AI added to a German noun", () => {
    expect(locateSurfaceInText(DE, "das Verbrechen")).toBe("Verbrechen");
    expect(locateSurfaceInText(DE, "die Rüstungsindustrie")).toBe("Rüstungsindustrie");
    expect(locateSurfaceInText(DE, "die Tradition")).toBe("Tradition");
  });

  it("allows a short inflection suffix as a whole word", () => {
    expect(locateSurfaceInText("Viele alte Traditionen bleiben.", "die Tradition")).toBe("Traditionen");
    expect(locateSurfaceInText("Starmer conceded defeat.", "to concede")).toBe("conceded");
  });

  it("does not match inside a longer word or unrelated text", () => {
    expect(locateSurfaceInText("Der Traditionsverein spielt.", "die Tradition")).toBeNull();
    expect(locateSurfaceInText(DE, "das Fahrrad")).toBeNull();
  });

  it("leaves exact matches untouched and repairs the rest", () => {
    const out = repairVocabularySurfaceForms(
      [item("Polizei"), item("das Verbrechen"), item("die Tradition"), item("das Fahrrad")],
      DE,
    );
    expect(out.map((v) => v.surface_form)).toEqual(["Polizei", "Verbrechen", "Tradition", "das Fahrrad"]);
  });

  it("falls back to the lemma when the surface is wrong", () => {
    const out = repairVocabularySurfaceForms([item("Verbrechens", "das Verbrechen")], DE);
    expect(out[0]!.surface_form).toBe("Verbrechen");
  });
});
