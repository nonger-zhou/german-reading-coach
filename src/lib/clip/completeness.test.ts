import { describe, expect, it } from "vitest";
import { assessCompleteness, countWords, normalizeClipSignals } from "./completeness";

function words(n: number, word = "Wort"): string {
  /** 每 12 个词一句，接近真实正文 */
  const out: string[] = [];
  for (let i = 0; i < n; i++) out.push(i % 12 === 11 ? `${word}.` : word);
  return out.join(" ");
}

describe("assessCompleteness", () => {
  it("没有正文 → failed", () => {
    const r = assessCompleteness({ text: "Kurz.", via: "page" });
    expect(r.status).toBe("failed");
    expect(r.reasons[0].code).toBe("no_body");
  });

  it("普通长文、没有任何线索 → full", () => {
    const r = assessCompleteness({ text: words(600), via: "page", signals: {} });
    expect(r.status).toBe("full");
    expect(r.reasons).toEqual([]);
  });

  it("页面上可见付费墙 → partial", () => {
    const r = assessCompleteness({
      text: words(600),
      via: "page",
      signals: { paywallVisible: true },
    });
    expect(r.status).toBe("partial");
    expect(r.reasons.map((x) => x.code)).toContain("paywall_visible");
  });

  it("服务器抓取付费文章（isAccessibleForFree=false）→ partial", () => {
    const r = assessCompleteness({
      text: words(250),
      via: "server",
      signals: { isAccessibleForFree: false },
    });
    expect(r.status).toBe("partial");
    expect(r.reasons[0].code).toBe("paywall_declared");
  });

  it("手机页面上已登录读到全文：声明付费但正文够长 → full", () => {
    const r = assessCompleteness({
      text: words(900),
      via: "page",
      signals: { isAccessibleForFree: false },
    });
    expect(r.status).toBe("full");
  });

  it("声明词数与提取词数接近时，付费声明不再判为不完整", () => {
    const r = assessCompleteness({
      text: words(880),
      via: "server",
      signals: { isAccessibleForFree: false, declaredWordCount: 900 },
    });
    expect(r.status).toBe("full");
  });

  it("声明 1200 词、只提取到 400 词 → partial", () => {
    const r = assessCompleteness({
      text: words(400),
      via: "page",
      signals: { declaredWordCount: 1200 },
    });
    expect(r.status).toBe("partial");
    expect(r.reasons.map((x) => x.code)).toContain("word_count_mismatch");
  });

  it("正文结尾是订阅提示（德语）→ partial", () => {
    const text = `${words(300)}\n\nJetzt abonnieren und weiterlesen. Bereits Abonnent? Anmelden.`;
    const r = assessCompleteness({ text, via: "page" });
    expect(r.status).toBe("partial");
    expect(r.reasons.map((x) => x.code)).toContain("paywall_text");
  });

  it("正文结尾是订阅提示（英语）→ partial", () => {
    const text = `${words(300, "word")}\n\nSubscribe to continue reading. Already a subscriber? Sign in.`;
    expect(assessCompleteness({ text, via: "page" }).status).toBe("partial");
  });

  it("正文中间提到 Abo 不算截断", () => {
    const text = `Die Zeitung hat ihr Abo-Modell geändert, sagt der Verlag. ${words(500)}`;
    expect(assessCompleteness({ text, via: "page" }).status).toBe("full");
  });

  it("正文偏短 → partial（too_short）", () => {
    const r = assessCompleteness({ text: words(60), via: "page" });
    expect(r.status).toBe("partial");
    expect(r.reasons[0].code).toBe("too_short");
  });

  it("页面有「Weiterlesen」按钮 → partial", () => {
    const r = assessCompleteness({
      text: words(500),
      via: "page",
      signals: { collapsedMoreButton: true },
    });
    expect(r.reasons.map((x) => x.code)).toContain("collapsed_more");
  });

  it("服务器抓取：有付费墙模块且正文偏短 → partial；正文够长 → full", () => {
    expect(
      assessCompleteness({ text: words(200), via: "server", signals: { paywallMarkup: true } }).status,
    ).toBe("partial");
    expect(
      assessCompleteness({ text: words(800), via: "server", signals: { paywallMarkup: true } }).status,
    ).toBe("full");
  });
});

describe("countWords / normalizeClipSignals", () => {
  it("德语词含变音", () => {
    expect(countWords("Über die Brücke geht's weiter, 2026.")).toBe(6);
  });

  it("过滤不可信输入", () => {
    expect(normalizeClipSignals(null)).toBeNull();
    expect(
      normalizeClipSignals({ isAccessibleForFree: "false", declaredWordCount: "900", paywallVisible: true }),
    ).toEqual({
      isAccessibleForFree: null,
      declaredWordCount: 900,
      contentTier: null,
      paywallVisible: true,
      collapsedMoreButton: null,
    });
  });
});
