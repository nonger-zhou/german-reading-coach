import Link from "next/link";
import type { ReactNode } from "react";
import { Card, CardTitle } from "@/components/ui/Card";

export const metadata = {
  title: "使用说明 · German Reading Coach",
};

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <Card id={id} className="scroll-mt-20 space-y-3">
      <CardTitle className="text-lg">{title}</CardTitle>
      <div className="space-y-2 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
        {children}
      </div>
    </Card>
  );
}

const toc = [
  { id: "flow", label: "一篇文章怎么学" },
  { id: "languages", label: "德语与英语" },
  { id: "import", label: "导入文章" },
  { id: "level", label: "阅读水平怎么选" },
  { id: "recommend", label: "AI 会推荐哪些词" },
  { id: "status", label: "学习中 / 已掌握 / 暂忽略" },
  { id: "long", label: "长文章" },
  { id: "review", label: "复习" },
  { id: "external", label: "外部深入解释与全文翻译" },
  { id: "faq", label: "常见问题" },
];

export default function HelpPage() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">使用说明</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          German Reading Coach 帮你用真实德语或英语文章学词：读前先看你不认识的词，读时随手标，读后定期复习。
        </p>
        <nav className="mt-3 flex flex-wrap gap-2 text-xs" aria-label="目录">
          {toc.map((t) => (
            <a
              key={t.id}
              href={`#${t.id}`}
              className="rounded-md bg-zinc-100 px-2 py-1 text-zinc-700 hover:underline dark:bg-zinc-800 dark:text-zinc-200"
            >
              {t.label}
            </a>
          ))}
        </nav>
      </div>

      <Section id="flow" title="一篇文章怎么学">
        <ol className="list-decimal space-y-1 pl-5">
          <li>
            <strong>导入</strong>：在「导入」页贴链接或粘贴正文，付费文章用 Chrome 插件导入全文。
          </li>
          <li>
            <strong>AI 分析</strong>：在阅读页点「AI 分析本文」，AI 按你的水平和词库，列出你多半不认识的词，最关键的排在最前面。
          </li>
          <li>
            <strong>读前过一遍</strong>：看推荐词的意思；一看就会的，直接标「已掌握」，以后不再推荐。
          </li>
          <li>
            <strong>保存后阅读</strong>：读的时候遇到不懂、但没被推荐的词，拖选后「添加为词汇」，解释会自动生成（可在设置中关闭）。
          </li>
          <li>
            <strong>复习</strong>：在「复习」页定期翻卡，记住的词标「已掌握」。
          </li>
        </ol>
      </Section>

      <Section id="languages" title="德语与英语">
        <p>
          可以学德语，也可以学英语，用的是同一套功能。两种语言的数据<strong>完全分开</strong>，像两个独立的学习空间。
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>顶栏切换</strong>：页面左上角的「德语 / 英语」决定当前学习语言。文章库、词库、语法库、复习、仪表盘的统计都只显示这种语言；切换会同步到账号，换设备也一样。
          </li>
          <li>
            <strong>导入</strong>：导入页默认用当前语言；正文明显是另一种语言时会自动改过来（也可以手动改）。保存另一种语言的文章后，顶栏会跟着切换。
          </li>
          <li>
            <strong>阅读页</strong>：打开哪篇文章就按这篇文章的语言显示（发音、释义、外部深入解释），与顶栏无关。
          </li>
          <li>
            <strong>阅读水平</strong>：德语、英语分别设置，例如德语 B2、英语 C1。在顶栏切到哪种语言，设置页就设置哪种语言的水平。
          </li>
          <li>
            <strong>推荐与复习</strong>：AI 判断你认不认识一个词时只看同一种语言的词库；复习排期也各算各的。德语里标「已掌握」的 die，不会影响英语。
          </li>
          <li>
            <strong>英语释义</strong>：中文释义 + 简明英文释义；推荐会特别注意短语动词（rule out）、固定搭配、习语和介词搭配。
          </li>
        </ul>
      </Section>

      <Section id="import" title="导入文章">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>链接导入</strong>：适合免费公开的网页。付费文章用链接抓取往往只能拿到开头。
          </li>
          <li>
            <strong>Chrome 插件</strong>：在你已登录、能看到全文的页面上点插件「导入到 German Reading Coach」，读取的是你屏幕上已经能看到的全文。不会绕过付费墙或登录墙。
          </li>
          <li>
            <strong>手动粘贴</strong>：复制正文后在导入页「从剪贴板读取」。
          </li>
          <li>
            <strong>截图 / 拍照</strong>：适合 X、Facebook 等帖子和报纸。一次最多 10 张，按顺序选好（长帖可截多张，重叠部分会自动去掉；超长截图也可以）。AI 只转写正文，去掉昵称、点赞数、按钮和别人的评论；识别出的文字填进正文框，核对后再保存。原图不保存。每张约花费不到 1 美分；不想花费时，可以把截图发给自己的 ChatGPT 等 App 转成文字，再复制过来用「从剪贴板读取」。
          </li>
        </ul>
      </Section>

      <Section id="level" title="阅读水平怎么选">
        <p>
          在
          <Link href="/settings" className="mx-0.5 text-emerald-700 hover:underline dark:text-emerald-400">
            设置
          </Link>
          里选默认水平，导入时也可以给单篇文章改。不必很准：你标「已掌握」和手动添加的词会让系统<strong>自动校准</strong>，读几篇后就会贴近实际水平。
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[22rem] text-left text-sm">
            <thead className="text-xs text-zinc-500">
              <tr>
                <th className="py-1 pr-3 font-medium">你的德语情况</th>
                <th className="py-1 font-medium">大约选</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {[
                ["歌德 / telc / ÖSD 证书", "证书上的等级"],
                ["TestDaF 各项 TDN 3", "B2"],
                ["TestDaF 各项 TDN 4–5", "C1"],
                ["DSH-1 / DSH-2 / DSH-3", "B2 / C1 / C2"],
                ["没考过试：能读简化新闻，常查词", "B1"],
                ["没考过试：能读瑞士 / 德国报纸，每段有几个生词", "B2"],
                ["没考过试：读报基本顺畅，只有少量专业词不认识", "C1"],
              ].map(([a, b]) => (
                <tr key={a}>
                  <td className="py-1.5 pr-3">{a}</td>
                  <td className="py-1.5 font-medium">{b}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="pt-2 font-medium text-zinc-900 dark:text-zinc-100">英语</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[22rem] text-left text-sm">
            <thead className="text-xs text-zinc-500">
              <tr>
                <th className="py-1 pr-3 font-medium">国内参照</th>
                <th className="py-1 pr-3 font-medium">大约词汇量</th>
                <th className="py-1 font-medium">大约对应 CEFR</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {[
                ["高考英语", "3500", "A2–B1"],
                ["大学英语四级（CET-4）", "4500", "B1"],
                ["大学英语六级（CET-6，550 分以上）", "6000", "B2"],
                ["考研英语", "5500", "B2"],
                ["英语专业四级（TEM-4）", "8000", "B2"],
                ["英语专业八级（TEM-8）", "13000", "C1"],
                ["雅思 6.5 / 托福 95", "—", "B2 偏上到 C1"],
                ["雅思 7.5 以上 / 托福 110 以上", "—", "C1–C2"],
              ].map(([a, b, c]) => (
                <tr key={a}>
                  <td className="py-1.5 pr-3">{a}</td>
                  <td className="py-1.5 pr-3">{b}</td>
                  <td className="py-1.5 font-medium">{c}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          英语对应关系为常见参考口径，不同机构略有出入。<strong>词汇量比证书等级更重要</strong>：做过词汇量测试的，按测出的词汇量选更准；介于两档之间时选低一档。
        </p>
        <p>
          选高了会少推、选低了会多推；用一段时间后系统会自动往合适的方向调。
        </p>
      </Section>

      <Section id="recommend" title="AI 会推荐哪些词">
        <p>目标是<strong>只推你不认识的词</strong>，判断顺序如下：</p>
        <ol className="list-decimal space-y-1 pl-5">
          <li>
            <strong>你词库里「学习中」的词</strong>：只要在这篇文章出现，就<strong>一定推荐</strong>，哪怕它很常用。
          </li>
          <li>
            <strong>「已掌握」或「暂忽略」的词</strong>：不再推荐（写法不同也能认出来，例如 das Mandat 和 Mandat）。
          </li>
          <li>
            <strong>其他单词</strong>：按这种语言的词频和你的阅读水平判断，比你水平对应的常用词更少见的才推荐。德语 B1 大约默认认识最常用的 8000 个词；英语各档按上面的对照表另行标定（英语 B2 约 13000 个词形）。
          </li>
          <li>
            <strong>固定搭配、可分动词、习语（英语还有短语动词、介词搭配）</strong>：只要意思看不出来，即使每个单词都简单也会推荐。
          </li>
        </ol>
        <p>
          <strong>会越用越准</strong>：如果你经常自己标出一些很常用的词，系统会认为你的水平定高了，自动多推一些；如果你标「已掌握」的词经常是比较难的词，就会少推一些。
        </p>
        <p>
          <strong>不推荐</strong>：人名、地名、政党、公司、品牌等专有名词（除非你自己把它加进词库）。
        </p>
        <p>
          推荐<strong>不设条数上限</strong>，按对读懂这篇文章的重要程度排序；时间紧时看前面一部分即可。词频只是近似，偶尔会推你已经会的词，标一下「已掌握」就好。
        </p>
      </Section>

      <Section id="status" title="学习中 / 已掌握 / 暂忽略">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>学习中</strong>：还在学。以后的文章里只要出现就会推荐，也会出现在「复习」里。
          </li>
          <li>
            <strong>已掌握</strong>：已经会了。以后不再推荐、不再复习；记录保留在词库里。
          </li>
          <li>
            <strong>暂忽略</strong>：暂时不想学（不等于会了）。以后不再推荐。
          </li>
          <li>
            <strong>又不会了怎么办</strong>：在阅读页把这个词重新拖选「添加为词汇」，它会自动改回「学习中」，之后又会推荐和复习。也可以在词库页直接改状态。
          </li>
          <li>
            <strong>删除</strong>：只是把它从这篇文章移除（例如误加），不等于已掌握。
          </li>
        </ul>
        <p>
          状态在阅读页、
          <Link href="/vocabulary" className="text-emerald-700 hover:underline dark:text-emerald-400">
            词库
          </Link>
          、
          <Link href="/review" className="text-emerald-700 hover:underline dark:text-emerald-400">
            复习
          </Link>
          三处都能改，效果一样。
        </p>
      </Section>

      <Section id="long" title="长文章">
        <p>
          超过约 1 万字符的文章会自动分成几段同时分析，再合并推荐词，等待时间和短文差不多。最多分析约 4 万字符（4 段），超出部分不分析，分析完会有提示。阅读问题根据第一段出。
        </p>
      </Section>

      <Section id="review" title="复习">
        <ul className="list-disc space-y-1 pl-5">
          <li>复习词库里所有「学习中」的词，每组最多 20 个。</li>
          <li>只复习顶栏当前语言的词；先看原词和原文例句回想意思，再点「显示释义」核对。</li>
          <li>
            <strong>还不熟</strong>：明天再出现。<strong>记住了</strong>：间隔逐步拉长（1 → 3 → 7 → 14 → 30 天）。
            <strong>已掌握</strong>：写入词库，以后不推荐、不复习。
          </li>
          <li>出现顺序：先到期该复习的，再是还没复习过的（最近在文章里遇到的优先）。</li>
          <li>复习进度保存在您的账号里（德语、英语各自一份），换设备也能接着复习；「已掌握」所有设备一致。</li>
        </ul>
      </Section>

      <Section id="external" title="外部深入解释与全文翻译">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>外部深入解释</strong>：在词汇或语法详情里，会把带上下文的提示词复制好，打开 ChatGPT 等外部 AI，粘贴即可得到更详细的讲解；可把结果存进「我的深度笔记」。不产生本软件的 AI 费用。
          </li>
          <li>
            <strong>全文翻译</strong>：阅读页「全文翻译为中文」同样是复制提示词到外部 AI。
          </li>
          <li>
            <strong>语法</strong>：AI 分析默认不自动标语法；拖选句子后可「解释语法」或「添加为语法」。
          </li>
        </ul>
      </Section>

      <Section id="faq" title="常见问题">
        <p>
          <strong>为什么推荐了我会的词？</strong> 词频只是近似（比如行业词、与英语相近的词）。标「已掌握」后不会再推，标得越多推荐越准。
        </p>
        <p>
          <strong>为什么我不会的词没推荐？</strong> 它可能被当成了常用词。读的时候拖选「添加为词汇」，它会进入学习中，以后每次出现都会推荐，系统也会据此多推。
        </p>
        <p>
          <strong>重新分析会怎样？</strong> 会再调用一次 AI（产生费用），确认后执行；已保存的词和状态不会被改掉。
        </p>
      </Section>
    </div>
  );
}
