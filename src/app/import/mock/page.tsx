import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";

/**
 * 仅 UI 示意：用于对比「当前导入页主卡」与「减认知负荷草案」，无数据、不可保存。
 * 正式行为仍以 `/import` 为准。
 */
export default function ImportLayoutMockPage() {
  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
        <p className="font-medium">导入页 · 布局对比示意（静态）</p>
        <p className="mt-1 text-xs opacity-90">
          本页不连接 Supabase、不抓取链接；仅展示按钮与文案层级，便于与正式页{" "}
          <Link href="/import" className="underline underline-offset-2">
            /import
          </Link>{" "}
          对照。地址可直接收藏：<code className="rounded bg-amber-100/80 px-1 dark:bg-amber-900/50">/import/mock</code>
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <section aria-labelledby="mock-a-title" className="space-y-2">
          <h2
            id="mock-a-title"
            className="text-sm font-semibold text-zinc-800 dark:text-zinc-200"
          >
            A · 与当前「正文」主卡一致（示意）
          </h2>
          <Card>
            <CardTitle className="text-base">正文</CardTitle>
            <CardDescription>
              保存到云端时使用此处的文本。从网页复制全文时，请优先点「从剪贴板读取」，以便自动去掉广告与多余版式；若正文已是干净稿，也可直接在此编辑或粘贴。阅读水平请在下方「本篇阅读水平」中选择。
            </CardDescription>
            <textarea
              readOnly
              rows={6}
              defaultValue="（示意：定稿正文区域）"
              className="mt-3 w-full resize-y rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-600 outline-none dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-400"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" variant="secondary">
                从剪贴板读取
              </Button>
              <Button type="button" variant="primary">
                保存文章
              </Button>
            </div>
            <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-300">
              （示意：成功/提示文案行）
            </p>
            <details className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50/60 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900/40">
              <summary className="cursor-pointer font-medium text-zinc-800 dark:text-zinc-200">
                来源稿（可选）
                <span className="ml-2 text-xs font-normal text-zinc-500 dark:text-zinc-400">
                  与正文一致时可忽略
                </span>
              </summary>
              <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
                此处为抓取或剪贴板导入的原始文本。修改后约半秒会自动同步到上方正文；也可先改上方正文再保存。
              </p>
              <textarea
                readOnly
                rows={4}
                defaultValue="（示意：原始稿）"
                className="mt-2 w-full resize-y rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
            </details>
          </Card>
        </section>

        <section aria-labelledby="mock-b-title" className="space-y-2">
          <h2
            id="mock-b-title"
            className="text-sm font-semibold text-zinc-800 dark:text-zinc-200"
          >
            B · 草案：同一主卡，少猜、少扫视（未采纳项对照）
          </h2>
          <Card>
            <CardTitle className="text-base">正文</CardTitle>
            <CardDescription>
              下面就是会存进云端、在阅读页打开的正文。需要整页粘贴时，用「从剪贴板读取」自动去广告；已很干净时可直接在这里改。
            </CardDescription>
            <textarea
              readOnly
              rows={6}
              defaultValue="（示意：定稿正文区域）"
              className="mt-3 w-full resize-y rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-600 outline-none dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-400"
            />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button type="button" variant="secondary">
                从剪贴板读取
              </Button>
              <Button type="button" variant="secondary">
                按原始稿重新生成正文
              </Button>
              <Button
                type="button"
                className="bg-emerald-600 text-white hover:bg-emerald-700"
              >
                保存文章
              </Button>
            </div>
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              提示文案可缩短为一行，避免与主操作抢注意力。
            </p>
            <details className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50/60 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900/40">
              <summary className="cursor-pointer font-medium text-zinc-800 dark:text-zinc-200">
                原始全文（可选）
                <span className="ml-2 text-xs font-normal text-zinc-500 dark:text-zinc-400">
                  多数情况不用打开
                </span>
              </summary>
              <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
                剪贴板或抓取得到的原文；只有想对照或微调原文时再展开。与上面正文不一致很常见。
              </p>
              <textarea
                readOnly
                rows={4}
                defaultValue="（示意：原始全文）"
                className="mt-2 w-full resize-y rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
            </details>
          </Card>
        </section>
      </div>

      <ul className="list-inside list-disc text-xs text-zinc-600 dark:text-zinc-400">
        <li>
          <strong className="text-zinc-800 dark:text-zinc-200">A</strong>
          ：与正式页一致——标题「正文」；「从剪贴板读取」与「保存文章」同一行且无底部重复保存（示意为默认**链接导入**：剪贴板 **secondary**、保存主色）；来源稿改稿后防抖同步定稿，无「重新整理」按钮。
        </li>
        <li>
          <strong className="text-zinc-800 dark:text-zinc-200">B</strong>
          ：历史草案示意——三个主按钮同一排、保存放最后且最亮；次要操作用 secondary；「来源稿」改为更白话标题，第二按钮长文案（未采纳）。
        </li>
      </ul>
    </div>
  );
}
