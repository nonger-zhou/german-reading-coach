/**
 * 全文翻译外接工具：复制 Prompt + 可选打开站点（不调本 App OpenAI）。
 */

export type ExternalTranslationProvider = {
  id: string;
  label: string;
  url: string;
  region: "overseas" | "domestic";
};

export const FULL_ARTICLE_TRANSLATION_PROVIDERS: ExternalTranslationProvider[] =
  [
    {
      id: "chatgpt",
      label: "ChatGPT",
      url: "https://chatgpt.com/",
      region: "overseas",
    },
    {
      id: "google_translate",
      label: "Google 翻译",
      url: "https://translate.google.com/?sl=de&tl=zh-CN&op=translate",
      region: "overseas",
    },
    {
      id: "deepseek",
      label: "DeepSeek",
      url: "https://chat.deepseek.com/",
      region: "domestic",
    },
    {
      id: "doubao",
      label: "豆包",
      url: "https://www.doubao.com/chat/",
      region: "domestic",
    },
  ];

export async function copyTextAndOpenExternalSite(
  text: string,
  openUrl: string | null,
): Promise<{ ok: boolean; message: string }> {
  try {
    await navigator.clipboard.writeText(text);
    if (openUrl) {
      window.open(openUrl, "_blank", "noopener,noreferrer");
      return {
        ok: true,
        message: "Prompt 已复制，已打开对应网站，可直接 Ctrl+V 粘贴发送。",
      };
    }
    return {
      ok: true,
      message: "Prompt 已复制，请粘贴到任意外接翻译工具。",
    };
  } catch {
    return { ok: false, message: "复制失败，请检查浏览器剪贴板权限。" };
  }
}
