const APP_IMPORT_URL = "https://german-reading-coach.vercel.app/import";
const MENU_ID = "import-to-german-reading-coach";
const DRAFT_PREFIX = "importDraft:";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_ID,
    title: "导入到 German Reading Coach",
    contexts: ["page", "selection"],
  });
});

chrome.action.onClicked.addListener((tab) => {
  void importCurrentTab(tab);
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== MENU_ID || !tab) return;
  void importCurrentTab(tab);
});

async function importCurrentTab(tab) {
  if (!tab.id) return;

  const [result] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: collectVisibleArticle,
  });

  const payload = result?.result;
  if (!payload || typeof payload.rawText !== "string" || !payload.rawText.trim()) {
    await chrome.notifications?.create?.({
      type: "basic",
      iconUrl: "",
      title: "German Reading Coach",
      message: "未能读取当前页面正文，请改用手动复制粘贴。",
    });
    return;
  }

  const draftId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await chrome.storage.local.set({ [`${DRAFT_PREFIX}${draftId}`]: payload });
  await chrome.tabs.create({
    url: `${APP_IMPORT_URL}?chromeDraftId=${encodeURIComponent(draftId)}`,
  });
}

function collectVisibleArticle() {
  const textOf = (selector) =>
    document.querySelector(selector)?.getAttribute("content")?.trim() || "";
  const selectedText = window.getSelection?.().toString().trim() || "";
  const slugWords = getSlugWords(window.location.pathname);
  const title = chooseTitle(slugWords) || document.title.trim();
  const articleEl = chooseArticleElement(slugWords, title);

  const sourceName =
    textOf('meta[property="og:site_name"]') ||
    new URL(window.location.href).hostname.replace(/^www\./, "");
  const publishedAtText =
    textOf('meta[property="article:published_time"]') ||
    textOf('meta[name="date"]') ||
    document.querySelector("time")?.getAttribute("datetime")?.trim() ||
    document.querySelector("time")?.innerText?.trim() ||
    "";
  const extractedText = extractArticleText(articleEl, title);
  const candidateText =
    extractedText || articleEl?.innerText?.trim() || document.body.innerText.trim();
  const rawText = selectedText || cropTextFromTitle(candidateText, title);

  return {
    title,
    url: window.location.href,
    sourceName,
    publishedAtText,
    rawText,
  };

  function chooseArticleElement(words, headline) {
    const selectors = [
      "article",
      "main",
      "[role='main']",
      "[data-testid*='article' i]",
      "[data-testid*='story' i]",
      "[class*='article' i]",
      "[class*='story' i]",
    ];
    const candidates = new Set();
    for (const selector of selectors) {
      try {
        document.querySelectorAll(selector).forEach((el) => candidates.add(el));
      } catch {
        // Ignore unsupported selector features on older Chromium builds.
      }
    }
    candidates.add(document.body);

    let best = document.body;
    let bestScore = -Infinity;
    for (const el of candidates) {
      const text = el.innerText?.trim() || "";
      if (text.length < 300) continue;
      const paragraphs = [...el.querySelectorAll("p")]
        .map((p) => p.innerText.trim())
        .filter((p) => p.length > 40);
      const paragraphChars = paragraphs.reduce((sum, p) => sum + p.length, 0);
      const headingText = [...el.querySelectorAll("h1,h2")]
        .map((h) => h.innerText.trim())
        .join(" ");
      let score = Math.min(text.length, 12000) * 0.2 + paragraphChars;
      score += wordOverlapScore(headingText, words) * 900;
      if (headline && normalizeText(text).includes(normalizeText(headline))) {
        score += 1800;
      }
      if (/newsletter|abo|login|registrieren|meistgelesen/i.test(text.slice(0, 1200))) {
        score -= 600;
      }
      if (el === document.body) {
        score -= 2500;
      }
      if (score > bestScore) {
        best = el;
        bestScore = score;
      }
    }
    return best;
  }

  function chooseTitle(words) {
    const metaTitle =
      textOf('meta[property="og:title"]') ||
      textOf('meta[name="twitter:title"]') ||
      "";
    const visualTitle = collectVisibleTitleCandidates(words)[0]?.text || "";
    return visualTitle || metaTitle || "";
  }

  function collectVisibleTitleCandidates(words) {
    const selectors = [
      "h1",
      "h2",
      "[data-testid*='headline' i]",
      "[data-testid*='title' i]",
      "[class*='headline' i]",
      "[class*='title' i]",
    ];
    const elements = new Set();
    for (const selector of selectors) {
      try {
        document.querySelectorAll(selector).forEach((el) => elements.add(el));
      } catch {
        // Ignore unsupported selector features on older Chromium builds.
      }
    }
    document.body.querySelectorAll("*").forEach((el) => {
      const style = window.getComputedStyle(el);
      const fontSize = Number.parseFloat(style.fontSize || "0");
      const fontWeight = Number.parseInt(style.fontWeight || "400", 10) || 400;
      if (fontSize >= 22 || fontWeight >= 700) {
        elements.add(el);
      }
    });

    const candidates = [];
    for (const el of elements) {
      if (!isVisible(el)) continue;
      if (hasUnwantedAncestor(el, document.body)) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width < 120 || rect.height < 18) continue;
      if (rect.bottom < 0 || rect.top > window.innerHeight * 1.4) continue;

      const text = normalizeInlineText(el.innerText || "");
      if (!looksLikeHeadlineText(text)) continue;

      const style = window.getComputedStyle(el);
      const fontSize = Number.parseFloat(style.fontSize || "0");
      const fontWeight = Number.parseInt(style.fontWeight || "400", 10) || 400;
      const tag = el.tagName.toLowerCase();
      const top = Math.max(0, rect.top);
      const visualScore =
        fontSize * 12 +
        Math.min(fontWeight, 900) * 0.2 +
        Math.min(text.length, 180) * 0.8 -
        top * 0.05;
      const tagBonus = tag === "h1" ? 260 : tag === "h2" ? 120 : 0;
      const overlapBonus = wordOverlapScore(text, words) * 25;
      candidates.push({
        text,
        score: visualScore + tagBonus + overlapBonus,
      });
    }

    const bestByText = new Map();
    for (const candidate of candidates) {
      const key = normalizeText(candidate.text);
      const prev = bestByText.get(key);
      if (!prev || candidate.score > prev.score) {
        bestByText.set(key, candidate);
      }
    }
    return [...bestByText.values()].sort((a, b) => b.score - a.score);
  }

  function extractArticleText(root, headline) {
    if (!root) return "";
    const nodes = [...root.querySelectorAll("h1,p")];
    const lines = [];
    const seen = new Set();
    let collectedChars = 0;

    for (const node of nodes) {
      if (!isVisible(node)) continue;
      if (hasUnwantedAncestor(node, root)) continue;

      const text = normalizeInlineText(node.innerText || "");
      if (!text) continue;
      if (shouldStopAtText(text, collectedChars)) break;
      if (looksLikeUiText(text)) continue;
      if (node.tagName.toLowerCase() === "p" && !looksLikeArticleParagraph(text)) {
        continue;
      }

      const key = normalizeText(text);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      lines.push(text);
      collectedChars += text.length;
    }

    if (lines.length < 2 || collectedChars < 300) {
      return "";
    }
    const hasHeadline = lines.some((line) => {
      const lineNorm = normalizeText(line);
      const headlineNorm = normalizeText(headline);
      return lineNorm === headlineNorm || lineNorm.includes(headlineNorm);
    });
    return (hasHeadline ? lines : [headline, ...lines]).filter(Boolean).join("\n\n");
  }

  function cropTextFromTitle(text, headline) {
    const lines = text.split("\n");
    const headlineNorm = normalizeText(headline);
    if (!headlineNorm) return text.trim();

    for (let i = 0; i < lines.length; i++) {
      for (let span = 1; span <= 3 && i + span <= lines.length; span++) {
        const joined = lines.slice(i, i + span).join(" ");
        const joinedNorm = normalizeText(joined);
        if (joinedNorm.length < 12) {
          continue;
        }
        if (
          joinedNorm === headlineNorm ||
          joinedNorm.includes(headlineNorm) ||
          headlineNorm.includes(joinedNorm)
        ) {
          return lines.slice(i).join("\n").trim();
        }
      }
    }
    return text.trim();
  }

  function hasUnwantedAncestor(node, root) {
    const badPattern =
      /newsletter|related|recommend|teaser|advert|anzeige|banner|paywall|share|social|comment|kommentar|author|profile|byline|bio|sidebar|aside|footer/i;
    for (let el = node; el && el !== root.parentElement; el = el.parentElement) {
      if (el === root) return false;
      const tag = el.tagName?.toLowerCase();
      if (["nav", "aside", "footer", "form", "button"].includes(tag)) {
        return true;
      }
      const attrs = [
        el.id,
        el.className,
        el.getAttribute?.("role"),
        el.getAttribute?.("aria-label"),
        el.getAttribute?.("data-testid"),
        el.getAttribute?.("data-test"),
      ]
        .filter(Boolean)
        .join(" ");
      if (badPattern.test(String(attrs))) {
        return true;
      }
    }
    return false;
  }

  function shouldStopAtText(text, collectedChars) {
    if (collectedChars < 800) return false;
    return /^(fehler gefunden|jetzt melden|mehr zum thema|auch interessant|weitere artikel|weitere newsletter|newsletter|der morgen|\d+\s+kommentare?)/i.test(
      text,
    );
  }

  function looksLikeUiText(text) {
    if (/^(abo|einloggen|registrieren|teilen|drucken|speichern|newsletter|weitere newsletter)$/i.test(text)) {
      return true;
    }
    if (/^\d+\s*$/.test(text)) {
      return true;
    }
    if (/^@[\w.-]+$/i.test(text)) {
      return true;
    }
    return false;
  }

  function looksLikeArticleParagraph(text) {
    if (text.length >= 80) return true;
    if (text.length >= 35 && /[.!?»:]$/.test(text)) return true;
    return false;
  }

  function looksLikeHeadlineText(text) {
    if (text.length < 20 || text.length > 260) return false;
    if (!/[A-Za-zÄÖÜäöüß]/.test(text)) return false;
    if (/^(Startseite|Newsletter|Weitere Newsletter|Der Morgen|Abo|Podcast)$/i.test(text)) {
      return false;
    }
    if (/^\s*(Startseite|Home)\s*[|›>]/i.test(text)) {
      return false;
    }
    const separatorCount = (text.match(/[|›>]/g) || []).length;
    if (separatorCount >= 2 && text.length < 160) {
      return false;
    }
    return true;
  }

  function isVisible(el) {
    const style = window.getComputedStyle(el);
    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      style.opacity !== "0"
    );
  }

  function normalizeInlineText(text) {
    return text.replace(/\s+/g, " ").trim();
  }

  function getSlugWords(pathname) {
    const last = decodeURIComponent(pathname.split("/").filter(Boolean).pop() || "");
    return last
      .replace(/-\d+$/, "")
      .split(/[-_\s]+/)
      .map((word) => word.toLowerCase())
      .filter((word) => word.length >= 3 && !/^\d+$/.test(word));
  }

  function wordOverlapScore(text, words) {
    const normalized = normalizeText(text);
    return words.reduce(
      (score, word) => score + (normalized.includes(word.toLowerCase()) ? 1 : 0),
      0,
    );
  }

  function normalizeText(text) {
    return text
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
}
