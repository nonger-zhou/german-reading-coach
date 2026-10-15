/**
 * 截图 / 拍照导入（PRD §1.4.3 A）：共用常量、提示词、JSON schema 与结果校验。
 * 浏览器端压缩切片见 `compressImageForImport.ts`；服务端接口见 `/api/import-image`。
 * 图片只用于识别，不保存。
 */

/** 每次最多选几张原图 */
export const MAX_IMPORT_IMAGES = 10;
/** 长截图切片后最多发给模型的图块数 */
export const MAX_IMPORT_TILES = 20;
/** 单个图块 data URL 上限（字符），约 1.2 MB */
export const MAX_TILE_DATA_URL_CHARS = 1_600_000;
/** 一次请求所有图块合计上限（Vercel 函数请求体约 4.5 MB） */
export const MAX_TOTAL_DATA_URL_CHARS = 4_000_000;

export type ImageImportLanguage = "de" | "en" | "other";

export type ImageImportResult = {
  title: string;
  text: string;
  language: ImageImportLanguage;
  source_platform: string;
};

export const IMAGE_IMPORT_SYSTEM_PROMPT = `You transcribe text from screenshots or photos so that a language learner can study it.
The images are given in order. They may be several screenshots of one long post, thread or article, or vertical slices of one long screenshot; consecutive images may overlap.

Rules:
- Transcribe the main content (post, thread, article, newspaper text) VERBATIM in its original language. Do not translate, summarize, correct or rewrite. Keep original spelling, umlauts and punctuation.
- Remove interface elements: usernames/handles, avatars, timestamps, like/repost/reply/view counts, buttons such as "Translate post", "Show more", "Follow", menus, navigation, ads, cookie banners, image captions of ads.
- Remove replies/comments written by other people. For a thread by the same author, keep all of that author's posts in order.
- Join the images in order. Where two images overlap, keep the overlapping text only once.
- Separate paragraphs (and separate posts of a thread) with one blank line. Do not keep the line breaks caused by narrow screen width inside a paragraph.
- title: the headline if there is one; otherwise an empty string (do not invent one).
- language: "de" for German, "en" for English, otherwise "other".
- source_platform: e.g. "X", "Facebook", "Instagram", "LinkedIn", "Zeitung", a news site name, or "" if unknown.
- If there is no readable text, return an empty text.`;

export const IMAGE_IMPORT_JSON_SCHEMA = {
  name: "image_import_transcription",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      title: { type: "string" },
      text: { type: "string" },
      language: { type: "string", enum: ["de", "en", "other"] },
      source_platform: { type: "string" },
    },
    required: ["title", "text", "language", "source_platform"],
  },
} as const;

const DATA_URL_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

/** 校验请求里的图片列表；返回错误信息或 null */
export function validateImportImages(images: unknown): string | null {
  if (!Array.isArray(images) || images.length === 0) return "请至少选择一张图片。";
  if (images.length > MAX_IMPORT_TILES) return `图片太多（最多 ${MAX_IMPORT_TILES} 块），请分几次导入。`;
  let total = 0;
  for (const img of images) {
    if (typeof img !== "string" || !DATA_URL_RE.test(img)) return "图片格式无效。";
    if (img.length > MAX_TILE_DATA_URL_CHARS) return "单张图片太大，请换一张或截小一些。";
    total += img.length;
  }
  if (total > MAX_TOTAL_DATA_URL_CHARS) return "图片总体积太大，请减少张数后分几次导入。";
  return null;
}

/** 解析并清理模型返回 */
export function parseImageImportResult(content: string): ImageImportResult | null {
  let o: Record<string, unknown>;
  try {
    o = JSON.parse(content) as Record<string, unknown>;
  } catch {
    return null;
  }
  const lang = o.language;
  const text = typeof o.text === "string" ? normalizeTranscript(o.text) : "";
  return {
    title: typeof o.title === "string" ? o.title.trim() : "",
    text,
    language: lang === "de" || lang === "en" ? lang : "other",
    source_platform: typeof o.source_platform === "string" ? o.source_platform.trim() : "",
  };
}

/** 统一换行：去掉行尾空白，最多保留一个空行 */
export function normalizeTranscript(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.replace(/\s+$/u, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * 长截图切片：给定（缩放后）宽高，返回竖向切片的 [y, h] 列表。
 * 每片最高 `maxTileHeight`，相邻两片重叠 `overlap` 像素，避免一行字被切断。
 */
export function planVerticalTiles(
  height: number,
  maxTileHeight = 2000,
  overlap = 120,
): Array<{ y: number; h: number }> {
  if (height <= maxTileHeight) return [{ y: 0, h: height }];
  const tiles: Array<{ y: number; h: number }> = [];
  let y = 0;
  while (y < height) {
    const h = Math.min(maxTileHeight, height - y);
    tiles.push({ y, h });
    if (y + h >= height) break;
    y += maxTileHeight - overlap;
  }
  return tiles;
}
