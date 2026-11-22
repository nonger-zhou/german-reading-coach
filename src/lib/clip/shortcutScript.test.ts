import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  buildFromDisk,
  OUTPUT_PATH,
} from "../../../scripts/build-clip-shortcut-script.mjs";
import { CLIP_SCRIPT_VERSION, CLIP_SHORTCUT_SCRIPT } from "./shortcutScript.generated";

describe("iPhone 快捷指令脚本", () => {
  it("生成文件与 Chrome 插件 background.js 保持一致（改插件后须运行 npm run clip:script）", () => {
    const { moduleSource } = buildFromDisk();
    expect(readFileSync(OUTPUT_PATH, "utf8")).toBe(moduleSource);
  });

  it("脚本语法正确，并调用 completion() 返回结果", () => {
    expect(() => new Function("completion", CLIP_SHORTCUT_SCRIPT)).not.toThrow();
    expect(CLIP_SHORTCUT_SCRIPT).toContain("function collectVisibleArticle()");
    expect(CLIP_SHORTCUT_SCRIPT).toContain("function collectClipSignals()");
    expect(CLIP_SHORTCUT_SCRIPT).toContain("completion(JSON.stringify(result))");
    expect(CLIP_SHORTCUT_SCRIPT).toContain(`"${CLIP_SCRIPT_VERSION}"`);
  });
});
