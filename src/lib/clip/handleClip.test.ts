import { describe, expect, it, vi } from "vitest";
import { findFirstUrl, handleClipRequest, type ClipDeps } from "./handleClip";
import { UrlImportError } from "@/lib/import/importFromUrl";
import { CLIP_SCRIPT_VERSION } from "./shortcutScript.generated";

const GERMAN_PARAGRAPH =
  "Die Regierung hat am Montag neue Pläne für den Ausbau der Bahn vorgestellt. Der Bund will in den nächsten zehn Jahren deutlich mehr Geld in die Infrastruktur investieren, und die Kantone sollen dabei mitreden können.";

function germanBody(paragraphs: number): string {
  /** 每段略有不同（正文清理会去掉重复段落） */
  return Array.from({ length: paragraphs }, (_, i) => `Absatz ${i + 1}: ${GERMAN_PARAGRAPH}`).join("\n\n");
}

function makeDeps(overrides: Partial<ClipDeps> = {}) {
  const calls: { fn: string; args: Record<string, unknown> }[] = [];
  const deps: ClipDeps = {
    rpc: vi.fn(async (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args });
      if (fn === "clip_resolve_token") return { data: "user-1", error: null };
      return {
        data: { kind: args.p_kind === "article" ? "article" : "inbox", id: "row-1" },
        error: null,
      };
    }),
    importFromUrl: vi.fn(async () => {
      throw new Error("should not be called");
    }),
    ...overrides,
  };
  return { deps, calls };
}

describe("handleClipRequest", () => {
  it("没有令牌 → 不调用数据库", async () => {
    const { deps, calls } = makeDeps();
    const r = await handleClipRequest(null, { url: "https://x.ch/a" }, deps);
    expect(r.ok).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it("令牌无效 → 不抓网页", async () => {
    const { deps } = makeDeps({
      rpc: vi.fn(async () => ({ data: null, error: null })),
    });
    const r = await handleClipRequest("t".repeat(40), { url: "https://x.ch/a" }, deps);
    expect(r.ok).toBe(false);
    expect(r.message).toContain("令牌无效");
    expect(deps.importFromUrl).not.toHaveBeenCalled();
  });

  it("Safari 页面提取到完整正文 → 存为文章", async () => {
    const { deps, calls } = makeDeps();
    const r = await handleClipRequest(
      "t".repeat(40),
      {
        source: "page",
        title: "Bund plant grossen Ausbau der Bahninfrastruktur",
        url: "https://www.example.ch/bahn",
        sourceName: "Example",
        rawText: germanBody(14),
        pageLanguage: "de-CH",
        signals: { isAccessibleForFree: false, paywallVisible: false },
        scriptVersion: CLIP_SCRIPT_VERSION,
      },
      deps,
    );
    expect(r.ok).toBe(true);
    expect(r.saved).toBe("article");
    expect(r.message).toMatch(/^已保存全文/);
    expect(r.message).not.toContain("新版");
    const ingest = calls.find((c) => c.fn === "clip_ingest")!;
    expect(ingest.args.p_kind).toBe("article");
    expect(ingest.args.p_language).toBe("de");
    expect(ingest.args.p_url).toBe("https://www.example.ch/bahn");
  });

  it("Safari 页面可见付费墙 → 放进收件箱，提示登录后再分享", async () => {
    const { deps, calls } = makeDeps();
    const r = await handleClipRequest(
      "t".repeat(40),
      {
        source: "page",
        title: "Bund plant grossen Ausbau der Bahninfrastruktur",
        url: "https://www.example.ch/bahn",
        rawText: germanBody(3),
        signals: { paywallVisible: true },
      },
      deps,
    );
    expect(r.saved).toBe("inbox");
    expect(r.status).toBe("partial");
    expect(r.message).toContain("没有存为文章");
    expect(r.message).toContain("登录");
    expect(calls.find((c) => c.fn === "clip_ingest")!.args.p_kind).toBe("inbox");
  });

  it("只有网址：服务器抓到付费文章开头 → 收件箱，提示改用 Safari", async () => {
    const { deps } = makeDeps({
      importFromUrl: vi.fn(async (url: string) => ({
        title: "Bund plant Ausbau",
        source_url: url,
        source_name: "Example",
        published_at_text: "",
        cleaned_text: germanBody(2),
        signals: { isAccessibleForFree: false },
      })),
    });
    const r = await handleClipRequest("t".repeat(40), { url: "https://www.example.ch/bahn" }, deps);
    expect(r.saved).toBe("inbox");
    expect(r.message).toContain("Safari");
  });

  it("只有网址：服务器抓取失败 → 收件箱保留链接", async () => {
    const { deps, calls } = makeDeps({
      importFromUrl: vi.fn(async () => {
        throw new UrlImportError("网站无法访问，或该网站可能阻止抓取。", "fetch_failed");
      }),
    });
    const r = await handleClipRequest(
      "t".repeat(40),
      { text: "Schau mal: https://www.example.ch/bahn?x=1." },
      deps,
    );
    expect(r.saved).toBe("inbox");
    expect(r.status).toBe("failed");
    const ingest = calls.find((c) => c.fn === "clip_ingest")!;
    expect(ingest.args.p_url).toBe("https://www.example.ch/bahn?x=1");
    expect(ingest.args.p_title).toBe("example.ch");
    expect(ingest.args.p_status).toBe("failed");
  });

  it("页面上没提取到正文 → 改由服务器按网址再试", async () => {
    const { deps } = makeDeps({
      importFromUrl: vi.fn(async (url: string) => ({
        title: "Bund plant Ausbau",
        source_url: url,
        source_name: "Example",
        published_at_text: "",
        cleaned_text: germanBody(8),
        signals: {},
      })),
    });
    const r = await handleClipRequest(
      "t".repeat(40),
      { source: "page", title: "Bund plant Ausbau", url: "https://www.example.ch/bahn", rawText: "" },
      deps,
    );
    expect(deps.importFromUrl).toHaveBeenCalled();
    expect(r.saved).toBe("article");
  });

  it("脚本版本过旧 → 附提示", async () => {
    const { deps } = makeDeps();
    const r = await handleClipRequest(
      "t".repeat(40),
      { source: "page", title: "Bund plant grossen Ausbau", url: "https://x.ch/a", rawText: germanBody(8), scriptVersion: "old" },
      deps,
    );
    expect(r.message).toContain("新版");
  });

  it("数据库未执行 013 → 明确提示", async () => {
    const { deps } = makeDeps({
      rpc: vi.fn(async () => ({ data: null, error: { code: "PGRST202", message: "Could not find the function" } })),
    });
    const r = await handleClipRequest("t".repeat(40), { url: "https://x.ch/a" }, deps);
    expect(r.ok).toBe(false);
    expect(r.message).toContain("013_iphone_clip.sql");
  });
});

describe("findFirstUrl", () => {
  it("去掉结尾标点和括号", () => {
    expect(findFirstUrl("Link (https://a.ch/b).")).toBe("https://a.ch/b");
    expect(findFirstUrl("kein link")).toBe("");
  });
});
