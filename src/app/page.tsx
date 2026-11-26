import Link from "next/link";

const links = [
  { href: "/dashboard", title: "仪表盘", desc: "查看学习概览和最近保存的文章。" },
  { href: "/articles", title: "文章库", desc: "分页查看所有保存过的文章，继续阅读或删除旧文章。" },
  { href: "/import", title: "导入文章", desc: "链接抓取或手动粘贴，保存到自己的文章库" },
  { href: "/articles/mock", title: "演示课文", desc: "先用示例文章体验分栏阅读、高亮和学习卡片。" },
  { href: "/vocabulary", title: "总词库", desc: "登录后汇总你在各篇文章中的词汇与学习状态" },
  { href: "/review", title: "复习", desc: "翻卡复习「学习中」的词，记住了的标为已掌握。" },
  { href: "/help", title: "使用说明", desc: "AI 推荐哪些词、学习状态的含义、长文章、复习规则等。" },
  { href: "/grammar", title: "总语法库", desc: "登录后汇总语法点与学习状态" },
  { href: "/settings", title: "设置", desc: "调整阅读水平、解释语言和发音相关选项。" },
];

export default function Home() {
  return (
    <div className="space-y-10">
      <section className="border-b border-zinc-900 pb-8 dark:border-zinc-800">
        <h1 className="font-serif text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-5xl">
          German Reading Coach
        </h1>
        <p className="mt-4 max-w-3xl font-serif text-lg leading-relaxed text-zinc-700 dark:text-zinc-300 sm:text-xl">
          用真实德语 / 英语文章学词：导入文章 → AI 只推你不认识的词 → 读前过一遍、读时随手标 → 定期复习。
          <Link href="/help" className="ml-1 whitespace-nowrap font-sans text-base font-medium text-emerald-600 underline underline-offset-4 hover:text-emerald-800 dark:text-emerald-400">
            使用说明 →
          </Link>
        </p>
      </section>
      <section className="grid gap-x-12 sm:grid-cols-2">
        {links.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group block border-b border-zinc-300 py-4 dark:border-zinc-800"
          >
            <h2 className="font-serif text-xl font-semibold text-zinc-900 group-hover:text-emerald-600 dark:text-zinc-50 dark:group-hover:text-emerald-400">
              {item.title}
            </h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{item.desc}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
