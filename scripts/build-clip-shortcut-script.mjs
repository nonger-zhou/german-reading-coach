/**
 * 生成 iPhone 快捷指令里「在网页上运行 JavaScript」要用的脚本。
 *
 * 做法：从 Chrome 插件 background.js 中原样取出 collectVisibleArticle()（与电脑插件同一套提取逻辑），
 * 再拼上 browser-extension/ios-shortcut/collect-clip-signals.js 里的 collectClipSignals()（完整性线索），
 * 写入 src/lib/clip/shortcutScript.generated.ts。
 *
 * 用法：改了 background.js 或 collect-clip-signals.js 后运行
 *   npm run clip:script
 * 单元测试会检查生成文件是否最新；忘了运行时 `npm test`（以及 Vercel 构建）会失败并提示。
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as acorn from "acorn";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const BACKGROUND_PATH = path.join(ROOT, "browser-extension/chrome-mv3/background.js");
export const SIGNALS_PATH = path.join(ROOT, "browser-extension/ios-shortcut/collect-clip-signals.js");
export const OUTPUT_PATH = path.join(ROOT, "src/lib/clip/shortcutScript.generated.ts");

/** 从源码中取出顶层函数声明的完整源码 */
export function extractTopLevelFunction(source, name) {
  const ast = acorn.parse(source, { ecmaVersion: "latest", sourceType: "script" });
  const node = ast.body.find(
    (n) => n.type === "FunctionDeclaration" && n.id && n.id.name === name,
  );
  if (!node) {
    throw new Error(`找不到顶层函数 ${name}()`);
  }
  return source.slice(node.start, node.end);
}

/** 返回 { script, version }；version 为脚本内容的短哈希，用于提示快捷指令里的脚本是否过旧 */
export function buildClipShortcutScript(backgroundSource, signalsSource) {
  const collectVisibleArticle = extractTopLevelFunction(backgroundSource, "collectVisibleArticle");
  const collectClipSignals = extractTopLevelFunction(signalsSource, "collectClipSignals");
  const body = [
    "(function () {",
    "  var result;",
    "  try {",
    "    result = collectVisibleArticle();",
    "  } catch (e) {",
    "    result = { title: document.title || \"\", url: window.location.href, rawText: \"\", extractError: String(e && e.message || e) };",
    "  }",
    "  try {",
    "    result.signals = collectClipSignals();",
    "  } catch (e) {",
    "    result.signals = null;",
    "  }",
    "  result.source = \"page\";",
    "  result.scriptVersion = \"__VERSION__\";",
    "  completion(JSON.stringify(result));",
    "",
    "  // ---- 以下来自 browser-extension/chrome-mv3/background.js（与电脑插件相同） ----",
    collectVisibleArticle,
    "",
    "  // ---- 以下来自 browser-extension/ios-shortcut/collect-clip-signals.js ----",
    collectClipSignals,
    "})();",
    "",
  ].join("\n");
  const version = createHash("sha256").update(body).digest("hex").slice(0, 10);
  const header =
    "// 读报学外语 · iPhone 快捷指令提取脚本（自动生成，请勿手改；更新请回到 App 的「iPhone 保存」页重新复制）\n";
  return { script: header + body.replace("__VERSION__", version), version };
}

export function renderGeneratedModule({ script, version }) {
  return [
    "// 本文件由 scripts/build-clip-shortcut-script.mjs 自动生成，请勿手改。",
    "// 改了 Chrome 插件 background.js 或 collect-clip-signals.js 后运行：npm run clip:script",
    "",
    `export const CLIP_SCRIPT_VERSION = ${JSON.stringify(version)};`,
    "",
    `export const CLIP_SHORTCUT_SCRIPT = ${JSON.stringify(script)};`,
    "",
  ].join("\n");
}

export function buildFromDisk() {
  const built = buildClipShortcutScript(
    readFileSync(BACKGROUND_PATH, "utf8"),
    readFileSync(SIGNALS_PATH, "utf8"),
  );
  return { ...built, moduleSource: renderGeneratedModule(built) };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const { moduleSource, version } = buildFromDisk();
  writeFileSync(OUTPUT_PATH, moduleSource);
  console.log(`已生成 ${path.relative(ROOT, OUTPUT_PATH)}（脚本版本 ${version}）`);
}
