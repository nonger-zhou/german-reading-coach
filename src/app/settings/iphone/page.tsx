"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";
import {
  createImportToken,
  listImportTokens,
  revokeImportToken,
  type ImportTokenRow,
} from "@/lib/clip/clipData";
import { CLIP_SCRIPT_VERSION, CLIP_SHORTCUT_SCRIPT } from "@/lib/clip/shortcutScript.generated";
import { ensureUserProfile } from "@/lib/supabase/auth";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatSupabaseOrUnknownError } from "@/lib/supabase/errors";

const LOGIN_HREF = "/login?next=%2Fsettings%2Fiphone";

function formatDate(iso: string | null): string {
  if (!iso) return "从未使用";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleString("zh-CN", { year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [state, setState] = useState<"idle" | "done" | "error">("idle");
  async function onCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setState("done");
    } catch {
      setState("error");
    }
    window.setTimeout(() => setState("idle"), 2500);
  }
  return (
    <Button variant="secondary" className="px-3 py-1.5 text-xs" onClick={() => void onCopy()}>
      {state === "done" ? "已复制" : state === "error" ? "复制失败，请长按手动复制" : label}
    </Button>
  );
}

function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-zinc-100 px-1 py-0.5 text-[0.85em] text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
      {children}
    </code>
  );
}

export default function IphoneClipSetupPage() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [tokens, setTokens] = useState<ImportTokenRow[]>([]);
  const [missingTable, setMissingTable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [label, setLabel] = useState("iPhone");
  const [creating, setCreating] = useState(false);
  /** 新生成的令牌原文：只在本次页面里显示一次 */
  const [newToken, setNewToken] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
    const supabase = getSupabaseBrowserClient();
    void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  const loadTokens = useCallback(async () => {
    const res = await listImportTokens(getSupabaseBrowserClient());
    setMissingTable(res.missingTable);
    if (res.error && !res.missingTable) setError(formatSupabaseOrUnknownError(res.error));
    setTokens(res.rows);
  }, []);

  useEffect(() => {
    if (session?.user) void loadTokens();
  }, [session, loadTokens]);

  async function onCreate() {
    if (!session?.user) return;
    setCreating(true);
    setError(null);
    try {
      await ensureUserProfile(session.user);
      const token = await createImportToken(getSupabaseBrowserClient(), session.user.id, label);
      setNewToken(token);
      await loadTokens();
    } catch (e) {
      setError(formatSupabaseOrUnknownError(e));
    } finally {
      setCreating(false);
    }
  }

  async function onRevoke(id: string) {
    setError(null);
    try {
      await revokeImportToken(getSupabaseBrowserClient(), id);
      await loadTokens();
    } catch (e) {
      setError(formatSupabaseOrUnknownError(e));
    }
  }

  const apiUrl = `${origin || "https://reading.nonger.com"}/api/clip`;

  if (session === undefined) {
    return <p className="mx-auto max-w-2xl text-sm text-zinc-500">加载中…</p>;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <p className="text-sm">
          <Link href="/settings" className="text-emerald-700 hover:underline dark:text-emerald-400">
            ← 设置
          </Link>
        </p>
        <h1 className="mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-50">iPhone 分享保存</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          设置好后：在 iPhone 上打开文章 → 点「分享」→ 选「保存到读报学外语」，标题、正文和原文链接会自动存进文章列表。
          没能拿到完整正文时不会当作全文保存，而是放进「导入」页顶部的手机收件箱，并在手机上提示原因。
        </p>
      </div>

      <Card>
        <CardTitle className="text-base">各种打开方式能保存到什么程度</CardTitle>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
          <li>
            <b>Safari</b>：在你正在看的页面上提取正文（与电脑插件同一套规则）。付费文章只要你在 Safari 里登录、能看到全文，就能保存全文。
          </li>
          <li>
            <b>Chrome（iPhone 版）</b>：iOS 只允许 Chrome 把网址交给快捷指令，由服务器按网址抓取。公开文章可以；需要订阅或登录的文章，服务器通常只能抓到开头，会放进收件箱并提示你改用 Safari。
          </li>
          <li>
            <b>邮件里的 newsletter</b>：取决于链接在哪里打开。苹果「邮件」用系统默认浏览器；Gmail 按它自己的设置用内置浏览器、Chrome 或 Safari。分享菜单里有「在 Safari 中打开」说明你在 App 内置浏览器里，先转到 Safari 再分享，效果最好。
          </li>
          <li>
            Safari 和 Chrome 的登录状态是分开的：要保存订阅文章，需要在 <b>Safari</b> 里登录该媒体。
          </li>
          <li>
            有些手机网页把后半篇折叠在「Weiterlesen / 展开全文」按钮后面，提取只读得到已展开的部分；遇到提示时先点开再分享。
          </li>
        </ul>
      </Card>

      {!session?.user ? (
        <Card className="space-y-3">
          <CardTitle className="text-base">需要登录</CardTitle>
          <CardDescription>登录后才能生成导入令牌。</CardDescription>
          <Link href={LOGIN_HREF} className="text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400">
            去登录 →
          </Link>
        </Card>
      ) : (
        <>
          <Card>
            <CardTitle className="text-base">第 1 步：生成导入令牌</CardTitle>
            <CardDescription>
              快捷指令用这个令牌代表你保存文章（不需要在快捷指令里登录）。令牌只显示一次；手机丢了或不想用了，在这里作废即可。
            </CardDescription>
            {missingTable ? (
              <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
                数据库还没开启这个功能：请在 Supabase SQL Editor 执行 <Code>supabase/fixes/013_iphone_clip.sql</Code>，再刷新本页。
              </p>
            ) : (
              <>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="备注，例如 iPhone"
                    className="w-40 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                  />
                  <Button onClick={() => void onCreate()} disabled={creating}>
                    {creating ? "生成中…" : "生成新令牌"}
                  </Button>
                </div>
                {newToken ? (
                  <div className="mt-3 rounded-lg border border-emerald-300 bg-emerald-50 p-3 dark:border-emerald-800 dark:bg-emerald-950/30">
                    <p className="text-sm font-medium text-emerald-900 dark:text-emerald-100">
                      新令牌（只显示这一次，请现在复制到快捷指令）：
                    </p>
                    <p className="mt-2 break-all font-mono text-sm text-zinc-900 dark:text-zinc-100">{newToken}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <CopyButton text={newToken} label="复制令牌" />
                      <CopyButton text={`Bearer ${newToken}`} label="复制「Bearer 令牌」（填请求头用）" />
                    </div>
                  </div>
                ) : null}
                {tokens.length ? (
                  <ul className="mt-3 divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
                    {tokens.map((t) => (
                      <li key={t.id} className="flex items-center justify-between gap-3 py-2">
                        <span className="text-zinc-700 dark:text-zinc-300">
                          {t.label || "未命名"}
                          <span className="ml-2 text-xs text-zinc-500">
                            生成于 {formatDate(t.created_at)} · 最近使用：{formatDate(t.last_used_at)}
                          </span>
                        </span>
                        <Button variant="ghost" className="shrink-0 px-3 py-1.5 text-xs" onClick={() => void onRevoke(t.id)}>
                          作废
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </>
            )}
            {error ? (
              <pre className="mt-2 whitespace-pre-wrap text-xs text-red-700 dark:text-red-300">{error}</pre>
            ) : null}
          </Card>

          <Card>
            <CardTitle className="text-base">第 2 步：复制提取脚本</CardTitle>
            <CardDescription>
              这段脚本和电脑上 Chrome 插件的正文提取规则完全相同，只在你分享的那个页面上运行，读取标题、正文和原文链接。版本 {CLIP_SCRIPT_VERSION}；以后脚本更新时，保存成功的提示里会提醒你回来重新复制。
            </CardDescription>
            <div className="mt-3 flex flex-wrap gap-2">
              <CopyButton text={CLIP_SHORTCUT_SCRIPT} label="复制提取脚本" />
              <CopyButton text={apiUrl} label="复制接口地址" />
            </div>
            <p className="mt-2 text-xs text-zinc-500">
              接口地址：<Code>{apiUrl}</Code>
            </p>
          </Card>

          <Card>
            <CardTitle className="text-base">第 3 步：在「快捷指令」App 里搭建（一次性，约 10 分钟）</CardTitle>
            <CardDescription>
              建议在 iPhone 上打开本页，边看边做，复制的内容可以直接粘贴。动作名称按 iOS 18 中文界面写，括号里是英文名，搜索动作时两种都可以。
            </CardDescription>
            <ol className="mt-3 list-decimal space-y-2.5 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
              <li>
                先打开 iPhone <b>设置 → App → 快捷指令 → 高级</b>，打开「<b>允许运行脚本</b>」（iOS 17 是 设置 → 快捷指令 → 高级）。
              </li>
              <li>
                打开「快捷指令」App，点右上角 <b>＋</b> 新建，名称改为「<b>保存到读报学外语</b>」。
              </li>
              <li>
                点底部 <b>ⓘ</b>（或顶部名称 → 详细信息），打开「<b>在共享表单中显示</b>」。回到编辑页，顶部出现「从<b>共享表单</b>接收<b>任意输入</b>」：点「任意输入」，只保留 <b>Safari 网页</b>、<b>URL</b>、<b>文本</b>。
              </li>
              <li>
                添加动作「<b>如果</b>」（If）：输入选「快捷指令输入」，再点一下这个蓝色变量，把「类型」改成 <b>Safari 网页</b>；条件选「<b>有任何值</b>」。
                <span className="block text-xs text-zinc-500">作用：从 Safari 分享时走「页面上提取」，从 Chrome / 邮件等分享时走「按网址抓取」。</span>
              </li>
              <li>
                在「如果」里面添加「<b>在网页上运行 JavaScript</b>」（Run JavaScript on Web Page），网页选「快捷指令输入」；删掉里面原有的代码，粘贴第 2 步复制的<b>提取脚本</b>。
              </li>
              <li>
                紧接着添加「<b>获取 URL 的内容</b>」（Get Contents of URL）：
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  <li>URL：粘贴<b>接口地址</b> <Code>{apiUrl}</Code></li>
                  <li>点「显示更多」：方法选 <b>POST</b></li>
                  <li>
                    头部添加两项：<Code>Authorization</Code> = <Code>Bearer 你的令牌</Code>（Bearer 后有一个空格，可用第 1 步「复制 Bearer 令牌」）；<Code>Content-Type</Code> = <Code>application/json</Code>
                  </li>
                  <li>请求体选「<b>文件</b>」，文件选变量「<b>JavaScript 结果</b>」</li>
                </ul>
              </li>
              <li>
                在「<b>否则</b>」里添加第二个「<b>获取 URL 的内容</b>」：URL、方法 POST、两个头部都和上一步相同；请求体选「<b>JSON</b>」，添加一个「文本」字段：键填 <Code>text</Code>，值选「<b>快捷指令输入</b>」。
              </li>
              <li>
                在「<b>结束如果</b>」后面添加「<b>获取词典值</b>」（Get Dictionary Value）：获取「值」，键填 <Code>message</Code>，词典选「<b>如果结果</b>」。
              </li>
              <li>
                最后添加「<b>显示通知</b>」（Show Notification），内容选「<b>词典值</b>」。完成。
              </li>
            </ol>
          </Card>

          <Card>
            <CardTitle className="text-base">第 4 步：试一次</CardTitle>
            <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
              <li>在 Safari 打开一篇公开的新闻 → 分享 → 选「保存到读报学外语」。</li>
              <li>
                第一次在某个网站上运行时，iPhone 会问是否允许快捷指令访问该网站，选「<b>始终允许</b>」（每个新网站会问一次）。
              </li>
              <li>
                正常会弹出「已保存全文：《标题》（… 词）」，文章出现在文章列表里。提示「没有存为文章」时，到
                <Link href="/import" className="mx-1 text-emerald-700 hover:underline dark:text-emerald-400">导入</Link>
                页顶部的手机收件箱处理。
              </li>
              <li>提示「令牌无效」：检查请求头里的 Bearer 和空格，或回第 1 步重新生成。</li>
            </ol>
            <p className="mt-3 text-xs text-zinc-500">
              想把快捷指令分享给别人：先把两个请求头里的令牌删掉再分享 iCloud 链接，对方用自己的令牌填回去。你的令牌等同于往你账号里存文章的钥匙，不要发给别人。
            </p>
          </Card>
        </>
      )}
    </div>
  );
}
