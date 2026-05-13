import { describe, expect, it } from "vitest";
import { validateGrammarLabel } from "./labelValidation";

describe("validateGrammarLabel", () => {
  it("corrects 'habe ... gefehlt' to Konjunktiv I and adds fixed expression", () => {
    const result = validateGrammarLabel(
      {
        name_de: "Konjunktiv II in der indirekten Rede",
        name_zh: "虚拟式 II 的间接引语",
        explanation_zh: "这里的 habe 是 Konjunktiv II。",
        explanation_de_simple: "Das ist Konjunktiv II.",
      },
      {
        sentence:
          "Es habe Maisano an akademischen Qualifikationen und Führungserfahrung gefehlt.",
        selectedText: "Es habe ... gefehlt",
      },
    );

    expect(result.name_de).toContain("Konjunktiv I");
    expect(result.name_zh).toContain("Konjunktiv I");
    expect(result.name_de).not.toContain("Konjunktiv II");
    expect(result.explanation_zh).toContain("habe");
    expect(result.explanation_zh).toContain("不是 Konjunktiv II");
    expect(result.fixed_expression).toBe("jemandem fehlt es an etwas");
    expect(result.common_misunderstanding_zh).toContain("habe");
    expect(result.common_misunderstanding_zh).toContain("hätte");
  });

  it("keeps Konjunktiv-II-Ersatzform possibility in indirect speech", () => {
    const result = validateGrammarLabel(
      {
        name_de: "Indirekte Rede",
        name_zh: "间接引语",
        explanation_zh: "转述内容。",
        explanation_de_simple: "Indirekte Rede.",
      },
      {
        sentence: "Laut Bericht hätten diese Faktoren zu Problemen geführt.",
        selectedText: "hätten ... geführt",
      },
    );

    expect(result.name_de).toContain("Konjunktiv-II-Ersatzform");
  });

  it("keeps typical Konjunktiv II in hypothetical wenn-clause", () => {
    const result = validateGrammarLabel(
      {
        name_de: "Unbekannt",
        name_zh: "未知",
        explanation_zh: "待补充",
        explanation_de_simple: "Noch offen.",
      },
      {
        sentence: "Wenn ich Zeit hätte, würde ich mehr lesen.",
        selectedText: "Wenn ich Zeit hätte",
      },
    );

    expect(result.name_de).toContain("Konjunktiv II");
    expect(result.name_zh).toContain("Konjunktiv II");
  });
});
