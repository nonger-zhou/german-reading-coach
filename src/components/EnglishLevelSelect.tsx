"use client";

import Link from "next/link";
import type { CefrLevel } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";

const LEVELS: CefrLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

const RECOMMENDED: CefrLevel[] = ["B1", "B2", "C1"];

/** 英语各档说明（国内参照见 PRD §1.5.3 对照表） */
const LEVEL_DETAILS: Record<CefrLevel, { ref: string; fit: string; system: string }> = {
  A1: {
    ref: "初中及以下",
    fit: "刚入门，常用词还不多。",
    system: "解释大量基础词，多用中文说明，必要时拆句。",
  },
  A2: {
    ref: "约高考（3500 词）",
    fit: "能读简单短文，新闻原文仍吃力。",
    system: "解释较多中频词与常见短语动词，提示时态、被动、定语从句等。",
  },
  B1: {
    ref: "约四级（4500 词）",
    fit: "能读懂新闻大意，长句和地道表达常卡住。",
    system: "少解释基础词，侧重新闻高频词、短语动词、固定搭配、介词搭配。",
  },
  B2: {
    ref: "约六级 550+ / 考研（5500–6000 词）",
    fit: "能读普通新闻与评论，细节和语气偶有偏差。",
    system: "只解释较难或理解关键的词，强调习语、语体、隐含逻辑和抽象表达。",
  },
  C1: {
    ref: "约专八 / 雅思 7–7.5（13000 词）",
    fit: "能读复杂评论与专业话题。",
    system: "侧重低频词、习语、语气与修辞，辅助更少。",
  },
  C2: {
    ref: "雅思 8+ / 托福 110+",
    fit: "接近母语阅读水平。",
    system: "只保留真正少见的词与微妙表达。",
  },
};

/** 英语水平对照（与 /help「阅读水平怎么选」、docs/USER_MANUAL.md §4.4 一致） */
const REFERENCE_ROWS: Array<[string, string, string]> = [
  ["高考英语", "3500", "A2–B1"],
  ["大学英语四级（CET-4）", "4500", "B1"],
  ["大学英语六级（CET-6，550 分以上）", "6000", "B2"],
  ["考研英语", "5500", "B2"],
  ["英语专业四级（TEM-4）", "8000", "B2"],
  ["英语专业八级（TEM-8）", "13000", "C1"],
  ["雅思 6.5 / 托福 95", "—", "B2 偏上到 C1"],
  ["雅思 7.5 以上 / 托福 110 以上", "—", "C1–C2"],
];

export function EnglishLevelSelect({
  value,
  onChange,
  name = "level-en",
}: {
  value: CefrLevel;
  onChange: (v: CefrLevel) => void;
  name?: string;
}) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
        英语阅读水平（CEFR）
      </legend>
      <p className="text-xs leading-relaxed text-amber-900/90 dark:text-amber-200/90">
        <span className="font-medium">重要提醒：</span>
        所选等级仅用于<strong>调节阅读辅助强度</strong>（推荐哪些词、释义多少），
        <strong>不代表</strong>您在听说读写上的完整水平。词汇量比证书等级更重要；
        拿不准就选低一档，系统会根据你标记的词自动校准。
        <Link
          href="/help#level"
          className="ml-1 font-medium text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-400"
        >
          完整说明 →
        </Link>
      </p>
      <details className="rounded-lg border border-zinc-200 bg-white text-xs dark:border-zinc-800 dark:bg-zinc-950">
        <summary className="cursor-pointer select-none px-3 py-2 font-medium text-zinc-700 dark:text-zinc-300">
          不知道选哪个？看对照表
        </summary>
        <div className="overflow-x-auto px-3 pb-3">
          <table className="w-full min-w-[22rem] border-collapse text-left">
            <thead>
              <tr className="text-zinc-500">
                <th className="py-1 pr-3 font-medium">国内参照</th>
                <th className="py-1 pr-3 font-medium">大约词汇量</th>
                <th className="py-1 font-medium">大约对应 CEFR</th>
              </tr>
            </thead>
            <tbody>
              {REFERENCE_ROWS.map(([exam, words, cefr]) => (
                <tr key={exam} className="border-t border-zinc-100 dark:border-zinc-800">
                  <td className="py-1 pr-3 text-zinc-700 dark:text-zinc-300">{exam}</td>
                  <td className="py-1 pr-3 text-zinc-600 dark:text-zinc-400">{words}</td>
                  <td className="py-1 text-zinc-700 dark:text-zinc-300">{cefr}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-zinc-500">
            常见参考口径，仅供选择起点；做过词汇量测试的，按测出的词汇量选更准。
          </p>
        </div>
      </details>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {LEVELS.map((lvl) => {
          const recommended = RECOMMENDED.includes(lvl);
          const selected = value === lvl;
          const d = LEVEL_DETAILS[lvl];
          return (
            <label
              key={lvl}
              className={`relative flex cursor-pointer flex-col gap-1.5 rounded-xl border p-3 transition ${
                recommended
                  ? "border-amber-400/80 bg-amber-50/80 ring-1 ring-amber-300/60 dark:border-amber-600/50 dark:bg-amber-950/30 dark:ring-amber-700/40"
                  : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
              } ${selected ? "ring-2 ring-emerald-600 ring-offset-2 dark:ring-offset-zinc-950" : ""}`}
            >
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  name={name}
                  value={lvl}
                  checked={selected}
                  onChange={() => onChange(lvl)}
                  className="h-4 w-4 accent-emerald-600"
                />
                <span className="font-semibold text-zinc-900 dark:text-zinc-50">{lvl}</span>
                {recommended ? (
                  <Badge tone="warning" className="ml-auto shrink-0">
                    推荐用于新闻阅读训练
                  </Badge>
                ) : null}
              </div>
              <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{d.ref}</p>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                <span className="font-medium text-zinc-700 dark:text-zinc-300">适合：</span>
                {d.fit}
              </p>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                <span className="font-medium text-zinc-700 dark:text-zinc-300">系统如何解释：</span>
                {d.system}
              </p>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
