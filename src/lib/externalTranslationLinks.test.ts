import { afterEach, describe, expect, it, vi } from "vitest";
import { copyTextAndOpenExternalSite } from "./externalTranslationLinks";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("copyTextAndOpenExternalSite", () => {
  it("opens the site before writing the clipboard", async () => {
    const order: string[] = [];
    vi.stubGlobal("window", {
      open: () => {
        order.push("open");
        return null;
      },
    });
    vi.stubGlobal("navigator", {
      clipboard: {
        writeText: async () => {
          order.push("copy");
        },
      },
    });

    const result = await copyTextAndOpenExternalSite(
      "prompt",
      "https://chatgpt.com/",
    );
    expect(order).toEqual(["open", "copy"]);
    expect(result.ok).toBe(true);
    expect(result.message).toContain("已复制");
    expect(result.message).toContain("已打开");
  });

  it("still copies when no site should open", async () => {
    const open = vi.fn();
    vi.stubGlobal("window", { open });
    vi.stubGlobal("navigator", {
      clipboard: { writeText: async () => undefined },
    });
    const result = await copyTextAndOpenExternalSite("prompt", null);
    expect(open).not.toHaveBeenCalled();
    expect(result.ok).toBe(true);
    expect(result.message).toContain("已复制");
  });

  it("reports a clipboard failure after the site was opened", async () => {
    vi.stubGlobal("window", { open: () => null });
    vi.stubGlobal("navigator", {
      clipboard: {
        writeText: async () => {
          throw new Error("denied");
        },
      },
    });
    const result = await copyTextAndOpenExternalSite(
      "prompt",
      "https://chatgpt.com/",
    );
    expect(result.ok).toBe(false);
    expect(result.message).toContain("网站已打开");
    expect(result.message).toContain("复制失败");
  });

  it("reports a clipboard failure when nothing was opened", async () => {
    vi.stubGlobal("navigator", {
      clipboard: {
        writeText: async () => {
          throw new Error("denied");
        },
      },
    });
    const result = await copyTextAndOpenExternalSite("prompt", null);
    expect(result.ok).toBe(false);
    expect(result.message).toBe("复制失败，请检查浏览器剪贴板权限。");
  });
});
