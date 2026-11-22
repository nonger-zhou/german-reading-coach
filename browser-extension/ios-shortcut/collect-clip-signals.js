/**
 * iPhone 快捷指令用：在当前网页上收集「正文是否完整」的线索。
 *
 * 与 Chrome 插件的 collectVisibleArticle() 一起被 scripts/build-clip-shortcut-script.mjs
 * 打包进快捷指令脚本（src/lib/clip/shortcutScript.generated.ts）。
 * 只读页面、不改页面；返回值由服务端 src/lib/clip/completeness.ts 判断。
 *
 * 注意：本函数必须自包含（不能引用外部变量），因为它会被原样拼进快捷指令脚本。
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- 由生成脚本按名字取出
function collectClipSignals() {
  const signals = {
    /** 网页结构化数据声明的「是否免费阅读」：true / false / null（未声明） */
    isAccessibleForFree: null,
    /** 网页结构化数据声明的正文词数（没有则 null） */
    declaredWordCount: null,
    /** <meta property="article:content_tier">：free / locked / metered */
    contentTier: "",
    /** 页面上能看到付费墙 / 登录墙提示框 */
    paywallVisible: false,
    /** 正文里有「Weiterlesen / Mehr anzeigen / Read more」这类展开按钮 */
    collapsedMoreButton: false,
  };

  try {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    const queue = [];
    scripts.forEach((s) => {
      try {
        queue.push(JSON.parse(s.textContent || ""));
      } catch {
        // 个别网站的 JSON-LD 不规范，忽略
      }
    });
    let guard = 0;
    while (queue.length && guard < 400) {
      guard += 1;
      const item = queue.shift();
      if (!item || typeof item !== "object") continue;
      if (Array.isArray(item)) {
        item.forEach((x) => queue.push(x));
        continue;
      }
      if ("isAccessibleForFree" in item && signals.isAccessibleForFree === null) {
        const v = item.isAccessibleForFree;
        if (v === false || String(v).toLowerCase() === "false") signals.isAccessibleForFree = false;
        else if (v === true || String(v).toLowerCase() === "true") signals.isAccessibleForFree = true;
      }
      if (signals.declaredWordCount === null && item.wordCount != null) {
        const n = Number.parseInt(String(item.wordCount), 10);
        if (Number.isFinite(n) && n > 0) signals.declaredWordCount = n;
      }
      if (item["@graph"]) queue.push(item["@graph"]);
      if (item.mainEntity) queue.push(item.mainEntity);
      if (item.hasPart) queue.push(item.hasPart);
    }
  } catch {
    // 忽略
  }

  try {
    const tier = document
      .querySelector('meta[property="article:content_tier"]')
      ?.getAttribute("content");
    signals.contentTier = (tier || "").trim().toLowerCase();
  } catch {
    // 忽略
  }

  const wallText =
    /abonn|abo\b|abo-|abo |weiterlesen mit|jetzt lesen|registrier|anmelden|einloggen|subscribe|subscription|sign in|log in|already a subscriber|bereits abonnent/i;
  try {
    const selectors = [
      "[class*='paywall' i]",
      "[id*='paywall' i]",
      "[class*='regwall' i]",
      "[class*='piano' i]",
      "[id*='piano' i]",
      "[class*='abo-wall' i]",
      "[class*='subscription-wall' i]",
      "[data-testid*='paywall' i]",
    ];
    for (const selector of selectors) {
      let nodes = [];
      try {
        nodes = [...document.querySelectorAll(selector)];
      } catch {
        continue;
      }
      for (const el of nodes) {
        const style = window.getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
          continue;
        }
        const rect = el.getBoundingClientRect();
        if (rect.height < 40 || rect.width < 120) continue;
        const text = (el.innerText || "").slice(0, 1500);
        if (wallText.test(text)) {
          signals.paywallVisible = true;
          break;
        }
      }
      if (signals.paywallVisible) break;
    }
  } catch {
    // 忽略
  }

  try {
    const moreText =
      /^(weiterlesen|artikel weiterlesen|mehr anzeigen|ganzen artikel lesen|read more|continue reading|show more|show full article)$/i;
    const buttons = document.querySelectorAll("button, [role='button']");
    for (const el of buttons) {
      const text = (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim();
      if (!text || text.length > 40 || !moreText.test(text)) continue;
      const style = window.getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") continue;
      const rect = el.getBoundingClientRect();
      if (rect.width < 20 || rect.height < 10) continue;
      signals.collapsedMoreButton = true;
      break;
    }
  } catch {
    // 忽略
  }

  return signals;
}
