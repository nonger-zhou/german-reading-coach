import Link from "next/link";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";

const links = [
  { href: "/dashboard", title: "仪表盘", desc: "查看学习概览和最近保存的文章。" },
  { href: "/articles", title: "文章库", desc: "分页查看所有保存过的文章，继续阅读或删除旧文章。" },
  { href: "/import", title: "导入文章", desc: "链接抓取或手动粘贴，保存到自己的文章库" },
  { href: "/articles/mock", title: "演示课文", desc: "先用示例文章体验分栏阅读、高亮和学习卡片。" },
  { href: "/vocabulary", title: "总词库", desc: "登录后汇总你在各篇文章中的词汇与学习状态" },
  { href: "/grammar", title: "总语法库", desc: "登录后汇总语法点与学习状态" },
  { href: "/settings", title: "设置", desc: "调整阅读水平、解释语言和发音相关选项。" },
];

export default function Home() {
  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-zinc-200 bg-gradient-to-br from-emerald-50/80 to-white p-6 dark:border-zinc-800 dark:from-emerald-950/40 dark:to-zinc-950 sm:p-8">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">
          German Reading Coach
        </h1>
      </section>
      <section className="grid gap-4 sm:grid-cols-2">
        {links.map((item) => (
          <Link key={item.href} href={item.href} className="block">
            <Card className="h-full transition hover:border-emerald-300/80 hover:shadow-md dark:hover:border-emerald-800/60">
              <CardTitle className="text-base">{item.title}</CardTitle>
              <CardDescription>{item.desc}</CardDescription>
            </Card>
          </Link>
        ))}
      </section>
    </div>
  );
}
