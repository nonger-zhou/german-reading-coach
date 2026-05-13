import { MockArticleReader } from "@/components/MockArticleReader";

export default function MockArticlePage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          阅读 · Mock
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          桌面端左侧原文、右侧 Tabs（词汇、语法、摘要、阅读问题）；手机端单栏，先读文，选中高亮后在底部查看详情。左侧文前有高亮图例：系统课文词汇、用户、系统课文语法、用户语法。
        </p>
      </div>
      <MockArticleReader />
    </div>
  );
}
