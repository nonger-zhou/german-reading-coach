"""
重新生成 src/lib/vocabSelection/englishFrequencyData.ts（与德语词表同一方法）。

用法（需联网）：
  curl -o en_50k.txt https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/en/en_50k.txt
  curl -o wiki_en.txt https://raw.githubusercontent.com/IlyaSemenov/wikipedia-word-frequency/master/results/enwiki-2023-04-13.txt
  python scripts/build-english-frequency.py en_50k.txt wiki_en.txt

数据许可：FrequencyWords 内容 CC BY-SA 4.0；wikipedia-word-frequency MIT。
排名 = 两份语料中较高（更常用）的名次再统一重排，只保留纯字母小写词形（字幕里 don't 被拆成 don / t）。
"""
import re
import sys

subtitles_path, wiki_path = sys.argv[1], sys.argv[2]
ok = re.compile(r"^[a-z]{2,}$")
best: dict[str, int] = {}
with open(subtitles_path, encoding="utf-8") as f:
    for i, line in enumerate(f, 1):
        w = line.split()[0].lower()
        if ok.match(w):
            best[w] = min(best.get(w, 10**9), i)
with open(wiki_path, encoding="utf-8") as f:
    for i, line in enumerate(f, 1):
        if i > 100_000:
            break
        w = line.split()[0].lower()
        if ok.match(w):
            best[w] = min(best.get(w, 10**9), i)

order = sorted(best, key=lambda w: (best[w], w))[:80_000]
header = '''/**
 * 英语词频排名（自动生成，勿手改；生成脚本见 scripts/build-english-frequency.py）。
 *
 * 每行一个小写词形，行号 = 排名（1 = 最常用）。共 80 000 条。
 * 排名 = 两份语料中较高（更常用）的名次，再统一重排：
 *  - OpenSubtitles 2018 英语前 50k（口语/日常）：hermitdave/FrequencyWords，内容 CC BY-SA 4.0
 *  - 英语维基百科前 100k（书面/新闻/专业）：IlyaSemenov/wikipedia-word-frequency（enwiki-2023-04-13），MIT
 * 只在分析英语文章时加载（见 lexicons.ts），德语请求不加载本文件。
 */
export const ENGLISH_FREQUENCY_WORDS = '''
with open("src/lib/vocabSelection/englishFrequencyData.ts", "w", encoding="utf-8") as f:
    f.write(header + "`" + "\n".join(order) + "`;\n")
print(f"wrote {len(order)} words")
