/**
 * 将用户从网页粘贴的杂乱文本做轻量清理，供导入文章使用。
 * 规则偏保守，避免误删正文。
 *
 * 手动粘贴模式仅有纯文本：不做正文小标题（Zwischenüberschrift）猜测，仅以「空行」分段、
 * 段内合并软换行。未来 URL 抓取或浏览器插件导入时，可再用 HTML（h2/h3、p、time 等）识别结构。
 */

const AD_KEYWORDS = [
  "Werbung",
  "Anzeige",
  "Sponsored",
  "Mehr erfahren",
  "Zum Angebot",
  "Galaxus",
  "Newsletter",
  "Lesen Sie auch",
  "Empfohlen",
  "Teilen",
  "Kommentar schreiben",
  "Copyright",
  "Alle Rechte vorbehalten",
] as const;

const MAX_KEYWORD_LINE_LEN = 100;
const MIN_CHARS_BEFORE_TAIL_TRUNCATE = 550;

function lineMatchesAdKeyword(trimmedLine: string): boolean {
  if (trimmedLine.length > MAX_KEYWORD_LINE_LEN) {
    return false;
  }
  const lower = trimmedLine.toLowerCase();
  return AD_KEYWORDS.some((k) => lower.includes(k.toLowerCase()));
}

function lineMatchesPhotoCredit(trimmedLine: string): boolean {
  if (/^(Foto|Bild)\s*:/i.test(trimmedLine)) {
    return true;
  }
  if (trimmedLine.length > 100) {
    return false;
  }
  if (/\bGetty\b/i.test(trimmedLine)) {
    return true;
  }
  if (/\bKeystone\b/i.test(trimmedLine)) {
    return true;
  }
  return false;
}

/** 短行且无拉丁/德语字母，视为噪声 */
function lineIsShortNoise(trimmedLine: string): boolean {
  if (trimmedLine.length === 0 || trimmedLine.length >= 4) {
    return false;
  }
  return !/[a-zA-ZäöüÄÖÜß]/.test(trimmedLine);
}

/** 面包屑、纯 Abo、疑似评论数等独立短数字行 */
function lineMatchesBreadcrumbOrUiNoise(trimmedLine: string): boolean {
  if (trimmedLine.length === 0) {
    return false;
  }
  if (trimmedLine.length <= 140) {
    const bc = (trimmedLine.match(/[›»]/g) || []).length;
    if (bc >= 2) {
      return true;
    }
    if (/^\s*[^›»]{0,40}\s*›\s*.+›/.test(trimmedLine)) {
      return true;
    }
    const gt = (trimmedLine.match(/>/g) || []).length;
    if (gt >= 2 && trimmedLine.length < 100) {
      return true;
    }
  }
  if (/^\s*Abo\s*$/i.test(trimmedLine)) {
    return true;
  }
  if (/^\s*Abo\b.{0,140}$/i.test(trimmedLine)) {
    return true;
  }
  if (/^\s*(Einloggen|Registrieren|Weitere Newsletter|Der Morgen)\s*$/i.test(trimmedLine)) {
    return true;
  }
  if (/^\s*@[\w.-]+\s*$/i.test(trimmedLine)) {
    return true;
  }
  if (/^\s*\d{1,3}\s*$/.test(trimmedLine)) {
    return true;
  }
  return false;
}

function lineMatchesTerminalSection(trimmedLine: string): boolean {
  if (/^(Fehler gefunden|Jetzt melden|Mehr zum Thema|Auch interessant|Weitere Artikel|Weitere Newsletter|Newsletter|Kommentare?)\b/i.test(trimmedLine)) {
    return true;
  }
  if (/^\d{1,5}\s+Kommentare?\b/i.test(trimmedLine)) {
    return true;
  }
  return false;
}

function looksLikeAllCapsSectionHeading(trimmedLine: string): boolean {
  if (trimmedLine.length < 16 || trimmedLine.length > 120) {
    return false;
  }
  const letters = trimmedLine.match(/[A-Za-zÄÖÜäöüß]/g) ?? [];
  if (letters.length < 10) {
    return false;
  }
  const upper = trimmedLine.match(/[A-ZÄÖÜ]/g) ?? [];
  return upper.length / letters.length > 0.8;
}

function lookaheadHasTailNoise(lines: string[], index: number): boolean {
  const next = lines
    .slice(index + 1, index + 10)
    .map((line) => line.trim())
    .filter(Boolean);
  if (next.some((line) => lineMatchesTerminalSection(line))) {
    return true;
  }
  const relatedSignals = next.filter((line) =>
    /^(Abo\b|Newsletter\b|Einloggen\b|Mehr Infos\b|@[\w.-]+$)/i.test(line),
  ).length;
  return relatedSignals >= 1;
}

function truncateLikelyNonArticleTail(rawLines: string[]): {
  lines: string[];
  removedCount: number;
} {
  let charCount = 0;
  for (let i = 0; i < rawLines.length; i++) {
    const t = rawLines[i].trim();
    if (t) {
      if (
        charCount >= MIN_CHARS_BEFORE_TAIL_TRUNCATE &&
        (lineMatchesTerminalSection(t) ||
          (looksLikeAllCapsSectionHeading(t) && lookaheadHasTailNoise(rawLines, i)))
      ) {
        return {
          lines: rawLines.slice(0, i),
          removedCount: rawLines.length - i,
        };
      }
      charCount += t.length;
    }
  }
  return { lines: rawLines, removedCount: 0 };
}

function shouldRemoveLine(trimmedLine: string): boolean {
  if (trimmedLine.length === 0) {
    return false;
  }
  if (lineMatchesBreadcrumbOrUiNoise(trimmedLine)) {
    return true;
  }
  if (lineMatchesPhotoCredit(trimmedLine)) {
    return true;
  }
  if (lineMatchesAdKeyword(trimmedLine)) {
    return true;
  }
  if (lineIsShortNoise(trimmedLine)) {
    return true;
  }
  return false;
}

function collapseBlankLines(lines: string[]): { lines: string[]; removedCount: number } {
  const out: string[] = [];
  let prevBlank = false;
  let removedCount = 0;
  for (const line of lines) {
    const blank = line.trim() === "";
    if (blank) {
      if (!prevBlank) {
        out.push("");
        prevBlank = true;
      } else {
        removedCount++;
      }
    } else {
      out.push(line);
      prevBlank = false;
    }
  }
  return { lines: out, removedCount };
}

/**
 * 仅以「空行」为段落边界；同一段内多行合并为空格（网页复制产生的软换行）。
 * 不猜测正文小标题，避免把段首行误判为标题而拆段（例如「… zu einem」+「Typus Mensch…」）。
 *
 * 回归样例（单换行 = 软折行，空行 = 真分段）：
 * ```
 * Fabian Takacs gehört zu einem
 * Typus Mensch, den ich sehr mag: blitzgescheit, hochempathisch – und bereit, sich mit Haut und Haar für Nachhaltigkeit einzusetzen.
 *
 * Für die Universität
 * St. Gallen, deren offizielles Kürzel immer noch «HSG» lautet, hat Takacs nur gute Worte übrig.
 *
 * Und was wäre eine bessere Methode?
 *
 * Neudenken, das Rethink. Dazu gehört etwa die Idee des Sharing.
 * ```
 * 期望：前两行合一；「Für die Universität」与「St. Gallen…」合一；原有空行分段保留。
 */
function normalizeParagraphStructure(lines: string[]): string {
  const paras: string[] = [];
  let buf: string[] = [];

  const flush = () => {
    if (buf.length > 0) {
      const joined = buf.join(" ").replace(/\s+/g, " ").trim();
      if (joined) paras.push(joined);
      buf = [];
    }
  };

  for (const line of lines) {
    if (line.trim() === "") {
      flush();
    } else {
      buf.push(line.trim());
    }
  }
  flush();

  return paras.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function cleanArticleText(input: string): {
  cleanedText: string;
  removedLineCount: number;
  originalCharCount: number;
  cleanedCharCount: number;
} {
  const normalized = input.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const originalCharCount = normalized.length;

  const rawLines = normalized.split("\n");
  const tailTrimmed = truncateLikelyNonArticleTail(rawLines);
  let removedLineCount = tailTrimmed.removedCount;
  const keptLines: string[] = [];

  for (const line of tailTrimmed.lines) {
    const t = line.trim();
    if (shouldRemoveLine(t)) {
      removedLineCount++;
      continue;
    }
    if (t === "") {
      keptLines.push("");
      continue;
    }
    keptLines.push(t);
  }

  const { lines: collapsed, removedCount: collapseRemoved } =
    collapseBlankLines(keptLines);
  removedLineCount += collapseRemoved;

  const cleanedText = normalizeParagraphStructure(collapsed);
  const cleanedCharCount = cleanedText.length;

  return {
    cleanedText,
    removedLineCount,
    originalCharCount,
    cleanedCharCount,
  };
}
