import { NextResponse } from "next/server";
import {
  createServerOpenAIClient,
  formatOpenAIRouteErrorMessage,
} from "@/lib/openai/createServerOpenAIClient";
import { getSupabaseUserFromBearer } from "@/lib/supabase/routeFromBearer";
import {
  IMAGE_IMPORT_JSON_SCHEMA,
  IMAGE_IMPORT_SYSTEM_PROMPT,
  parseImageImportResult,
  validateImportImages,
  type ImageImportResult,
} from "@/lib/import/imageImport";

/** 多张截图读图可能较慢 */
export const maxDuration = 120;

type OkBody = { ok: true; result: ImageImportResult };
type ErrBody = { ok: false; error: string };

/**
 * 截图 / 拍照导入：把浏览器压缩后的图片交给 OpenAI 视觉模型转写正文。
 * 图片不落库、不写日志，只返回文字；用户核对后在导入页照常保存。
 */
export async function POST(req: Request): Promise<NextResponse<OkBody | ErrBody>> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: "OPENAI_API_KEY 未配置" }, { status: 503 });
  }
  const auth = await getSupabaseUserFromBearer(req);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.message }, { status: auth.status });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "请求体不是合法 JSON（图片可能太大）" }, { status: 400 });
  }
  const images = (body as { images?: unknown } | null)?.images;
  const invalid = validateImportImages(images);
  if (invalid) {
    return NextResponse.json({ ok: false, error: invalid }, { status: 400 });
  }
  const imageList = images as string[];

  const openai = createServerOpenAIClient({ apiKey, timeout: 110_000, maxRetries: 1 });
  try {
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_VISION_MODEL?.trim() || "gpt-4o-mini",
      temperature: 0,
      messages: [
        { role: "system", content: IMAGE_IMPORT_SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `There are ${imageList.length} image(s), in order. Transcribe the main text.`,
            },
            ...imageList.map((url) => ({
              type: "image_url" as const,
              image_url: { url, detail: "high" as const },
            })),
          ],
        },
      ],
      response_format: { type: "json_schema", json_schema: IMAGE_IMPORT_JSON_SCHEMA },
    });

    const content = completion.choices[0]?.message?.content;
    const result = content ? parseImageImportResult(content) : null;
    if (!result) {
      return NextResponse.json({ ok: false, error: "AI 返回内容无法解析，请重试。" }, { status: 502 });
    }
    if (!result.text) {
      return NextResponse.json(
        { ok: false, error: "没有在图片里识别到文字，请换更清晰的截图。" },
        { status: 422 },
      );
    }
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: `识别失败：${formatOpenAIRouteErrorMessage(e)}` },
      { status: 502 },
    );
  }
}
