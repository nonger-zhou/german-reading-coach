"use client";

import type { CefrLevel } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";

const LEVELS: CefrLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

const RECOMMENDED: CefrLevel[] = ["A2", "B1", "B2"];

const LEVEL_DETAILS: Record<
  CefrLevel,
  { fit: string; system: string }
> = {
  A1: {
    fit: "零基础或刚入门，日常句短、词汇有限。",
    system: "大量解释基础词，多用中文说明，必要时拆句。",
  },
  A2: {
    fit: "初级进阶，能接触简单话题与短新闻导语。",
    system: "解释较多基础与中频词，提示 Perfekt、情态动词、可分动词、weil/dass 等。",
  },
  B1: {
    fit: "中级，可开始读真实新闻大意与简讯。",
    system: "少解释过于基础的词，侧重新闻高频词、抽象名词、搭配、从句、被动态、介词格等。",
  },
  B2: {
    fit: "中高级，能读普通新闻与部分专业话题。",
    system: "只解释较难或理解关键的词，强调搭配、语体、隐含逻辑、复杂从句、Konjunktiv II、名词化等。",
  },
  C1: {
    fit: "高级，能理解复杂论证与语气。",
    system: "侧重隐含意义、语气、风格与精确表达，辅助更少。",
  },
  C2: {
    fit: "接近母语阅读水平（非本工具 MVP 核心人群）。",
    system: "以高阶分析与最小干预为主，仅保留必要提示。",
  },
};

export function GermanLevelSelect({
  value,
  onChange,
  name = "level",
}: {
  value: CefrLevel;
  onChange: (v: CefrLevel) => void;
  name?: string;
}) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
        德语阅读水平（CEFR）
      </legend>
      <p className="text-xs leading-relaxed text-amber-900/90 dark:text-amber-200/90">
        <span className="font-medium">重要提醒：</span>
        所选等级仅用于<strong>调节阅读辅助强度</strong>（释义多少、提示频率等），
        <strong>不代表</strong>您在听说读写上的完整 CEFR 水平。
      </p>
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
              } ${
                selected
                  ? "ring-2 ring-emerald-600 ring-offset-2 dark:ring-offset-zinc-950"
                  : ""
              }`}
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
                <span className="font-semibold text-zinc-900 dark:text-zinc-50">
                  {lvl}
                </span>
                {recommended ? (
                  <Badge tone="warning" className="ml-auto shrink-0">
                    推荐用于新闻阅读训练
                  </Badge>
                ) : null}
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                <span className="font-medium text-zinc-700 dark:text-zinc-300">
                  适合：
                </span>
                {d.fit}
              </p>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                <span className="font-medium text-zinc-700 dark:text-zinc-300">
                  系统如何解释：
                </span>
                {d.system}
              </p>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
