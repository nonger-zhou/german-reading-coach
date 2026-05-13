import { NextResponse } from "next/server";
import {
  createServerOpenAIClient,
  formatOpenAIRouteErrorMessage,
} from "@/lib/openai/createServerOpenAIClient";

export const maxDuration = 120;
import { VOCAB_ENRICHMENT_JSON_SCHEMA } from "@/lib/articleAnalysis/enrichmentJsonSchemas";
import { snippetAroundOffsets } from "@/lib/articleAnalysis/enrichmentContext";
import { applyVocabularyAiEnrichment } from "@/lib/supabase/vocabulary";
import { getSupabaseUserFromBearer } from "@/lib/supabase/routeFromBearer";
import type { CefrLevel } from "@/lib/types";

const LEVELS: CefrLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

function isCefrLevel(s: unknown): s is CefrLevel {
  return typeof s === "string" && (LEVELS as string[]).includes(s);
}

const SYSTEM_PROMPT = `你是德语阅读教练。用户自己在文章中标记了一个「词汇型表达」（可能是单词，也可能是短语、搭配或可分动词），尚未有完整解释。请只根据提供的标题、学习者水平、词形信息、出现句和原文短片段，输出该表达在本次阅读语境中的解释。

【词汇型表达与可分动词】
- 用户选中的 surface_form 可能是：
  - 单个单词（如 Täter）
  - 复合名词（如 Untersuchungshaft, Kriminalstatistik）
  - 短语 / 搭配 / 固定表达（如 in fünf Fällen, unter Druck geraten）
  - 动词短语或动词搭配（如 eine Entscheidung treffen, eine Beratungsstelle einrichten）
  - 介词短语 / 介词搭配（如 auf etwas angewiesen sein）
  - 可分动词的实际用法（如 richtet … ein、brachte … um）
- 如果这是可分动词，请在 zh_meaning / simple_de_explanation 或 reason_for_selection 中**明确写出**：
  - 这是「可分动词」（separable Verb）
  - 词典形式 / lemma（例如 einrichten、umbringen）
  - 原文表面形式（例如 richtet … ein / brachte … um）
  - 说明前缀在句中的位置（通常在句尾），以及变位后的核心动词形式。
- 如果是短语、固定搭配或介词搭配，也要在 reason_for_selection 中说明这是哪一类表达，以及为什么按「词汇型表达」学习（而不是语法点）。

【输出字段要求】
- canonical_form：词典形式（lemma / canonical form）。
  - 动词尽量给不定式（如 niederlegen、einrichten、umbringen）。
  - 可分动词必须给完整词典形式（如 einrichten，而不是 richtet）。
  - 名词尽量给带冠词的形式（如 das Mandat / die Entscheidung）。
- surface_form：原文形式（来自文章出现的形式），可用于显示「原文形式：...」。
- zh_meaning：结合上下文的中文释义，具体可读，若是表达/搭配请解释整个表达的意思。
- simple_de_explanation：用简单德语解释该表达在此处的意思（初学者可懂），可简要提及这是固定搭配、可分动词等。
- part_of_speech：英文小写，从 noun / verb / adjective / adverb / phrase / conjunction / preposition / other 中选最贴切的一项；对于多词表达，可用 phrase。
- level_estimate：估计学习者大致需要的 CEFR 等级（A1–C2）。
- reason_for_selection：一两句话说明为何该表达值得在此文中学习，必要时注明「可分动词」「固定搭配」「介词短语」等标签，并指出 lemma 与原文形式（例如「这是可分动词 einrichten，在文中出现为 richtet … ein」）。
- example_sentence：优先使用用户给出的出现句；若必须改写，保持与原文高度一致。

不要输出与 JSON schema 无关的文字。`;

type OkBody = {
  ok: true;
  canonical_form: string;
  surface_form: string;
  zh_meaning: string;
  simple_de_explanation: string;
  part_of_speech: string;
  level_estimate: CefrLevel;
  reason_for_selection: string;
  example_sentence: string;
};

type ErrBody = {
  ok: false;
  error: string;
};

export async function POST(req: Request): Promise<NextResponse<OkBody | ErrBody>> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: "OPENAI_API_KEY 未配置" },
      { status: 503 },
    );
  }

  const auth = await getSupabaseUserFromBearer(req);
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: auth.message },
      { status: auth.status },
    );
  }
  const { user, supabase } = auth;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "请求体不是合法 JSON" },
      { status: 400 },
    );
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "请求体无效" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  const articleId = typeof b.articleId === "string" ? b.articleId.trim() : "";
  const vocabularyItemId =
    typeof b.vocabularyItemId === "string" ? b.vocabularyItemId.trim() : "";
  const userLevel = b.userLevel;

  if (!articleId || !vocabularyItemId) {
    return NextResponse.json(
      { ok: false, error: "缺少 articleId 或 vocabularyItemId" },
      { status: 400 },
    );
  }
  if (!isCefrLevel(userLevel)) {
    return NextResponse.json(
      { ok: false, error: "userLevel 必须是 A1–C2 之一" },
      { status: 400 },
    );
  }

  const { data: article, error: artErr } = await supabase
    .from("articles")
    .select("id,user_id,title,original_text")
    .eq("id", articleId)
    .maybeSingle();

  if (artErr) {
    return NextResponse.json(
      { ok: false, error: artErr.message || "无法读取文章" },
      { status: 500 },
    );
  }
  if (!article || article.user_id !== user.id) {
    return NextResponse.json({ ok: false, error: "无权访问该文章" }, { status: 403 });
  }

  const { data: vrow, error: vErr } = await supabase
    .from("vocabulary_items")
    .select("id,user_id,source,lemma,display_word,normalized_key,part_of_speech")
    .eq("id", vocabularyItemId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (vErr) {
    return NextResponse.json(
      { ok: false, error: vErr.message || "无法读取词汇项" },
      { status: 500 },
    );
  }
  if (!vrow || vrow.source !== "manual") {
    return NextResponse.json(
      { ok: false, error: "仅支持用户手动添加的词汇（source=manual）。" },
      { status: 403 },
    );
  }

  const { data: occRows, error: occErr } = await supabase
    .from("vocabulary_occurrences")
    .select("sentence,surface_form,start_offset,end_offset")
    .eq("article_id", articleId)
    .eq("vocabulary_item_id", vocabularyItemId)
    .order("created_at", { ascending: true })
    .limit(1);

  if (occErr) {
    return NextResponse.json(
      { ok: false, error: occErr.message || "无法读取出现记录" },
      { status: 500 },
    );
  }
  const occ0 = occRows?.[0] as
    | {
        sentence: string | null;
        surface_form: string | null;
        start_offset: number | null;
        end_offset: number | null;
      }
    | undefined;

  const originalText = String(article.original_text ?? "");
  const snippet = snippetAroundOffsets(
    originalText,
    occ0?.start_offset ?? undefined,
    occ0?.end_offset ?? undefined,
  );
  const occurrenceSentence =
    (occ0?.sentence && occ0.sentence.trim()) ||
    "（未提供出现句，请仅根据词形与片段推断）";
  const surface = (occ0?.surface_form && occ0.surface_form.trim()) ||
    String(vrow.display_word ?? vrow.lemma ?? "");

  const userPayload = {
    article_title: article.title ?? "",
    user_level: userLevel,
    lemma: vrow.lemma ?? "",
    display_word: vrow.display_word ?? "",
    normalized_key: vrow.normalized_key ?? "",
    surface_form_in_article: surface,
    occurrence_sentence: occurrenceSentence,
    original_text_snippet: snippet,
  };

  const openai = createServerOpenAIClient({
    apiKey,
    timeout: 120_000,
    maxRetries: 1,
  });

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.35,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: JSON.stringify(userPayload),
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: VOCAB_ENRICHMENT_JSON_SCHEMA,
      },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json(
        { ok: false, error: "OpenAI 返回空内容" },
        { status: 502 },
      );
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(content) as Record<string, unknown>;
    } catch {
      return NextResponse.json(
        { ok: false, error: "无法解析模型返回的 JSON" },
        { status: 502 },
      );
    }

    const zh_meaning = String(parsed.zh_meaning ?? "").trim();
    const canonical_form = String(parsed.canonical_form ?? "").trim();
    const surface_form = String(parsed.surface_form ?? "").trim();
    const simple_de_explanation = String(
      parsed.simple_de_explanation ?? "",
    ).trim();
    const part_of_speech = String(parsed.part_of_speech ?? "").trim();
    const level_estimate = parsed.level_estimate;
    const reason_for_selection = String(
      parsed.reason_for_selection ?? "",
    ).trim();
    const example_sentence = String(parsed.example_sentence ?? "").trim();

    if (!zh_meaning || !simple_de_explanation) {
      return NextResponse.json(
        { ok: false, error: "模型返回的解释字段为空" },
        { status: 502 },
      );
    }
    if (!isCefrLevel(level_estimate)) {
      return NextResponse.json(
        { ok: false, error: "模型返回的 level_estimate 无效" },
        { status: 502 },
      );
    }

    const { error: saveErr } = await applyVocabularyAiEnrichment(supabase, {
      userId: user.id,
      vocabularyItemId,
      canonical_form: canonical_form || vrow.lemma || vrow.display_word || surface,
      zh_meaning,
      simple_de_explanation,
      part_of_speech,
      level_estimate,
      example_sentence: example_sentence || null,
    });

    if (saveErr) {
      return NextResponse.json({ ok: false, error: saveErr }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      canonical_form:
        canonical_form || vrow.lemma || vrow.display_word || surface,
      surface_form: surface_form || surface,
      zh_meaning,
      simple_de_explanation,
      part_of_speech,
      level_estimate,
      reason_for_selection,
      example_sentence,
    });
  } catch (e: unknown) {
    const msg = formatOpenAIRouteErrorMessage(e);
    return NextResponse.json(
      { ok: false, error: msg || "OpenAI 调用失败" },
      { status: 502 },
    );
  }
}
