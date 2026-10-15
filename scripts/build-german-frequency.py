"""
重新生成 src/lib/vocabSelection/germanFrequencyData.ts。

用法（需联网）：
  curl -o de_50k.txt https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/de/de_50k.txt
  curl -o wiki_de.txt https://raw.githubusercontent.com/IlyaSemenov/wikipedia-word-frequency/master/results/dewiki-2022-08-29.txt
  python scripts/build-german-frequency.py de_50k.txt wiki_de.txt

数据许可：FrequencyWords 内容 CC BY-SA 4.0；wikipedia-word-frequency MIT。
"""
import re
import sys

subtitles_path, wiki_path = sys.argv[1], sys.argv[2]
ok = re.compile(r"^[a-zäöüß]{2,}$")
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
header = open("src/lib/vocabSelection/germanFrequencyData.ts", encoding="utf-8").read().split("`")[0]
with open("src/lib/vocabSelection/germanFrequencyData.ts", "w", encoding="utf-8") as f:
    f.write(header + "`" + "\n".join(order) + "`;\n")
print(f"wrote {len(order)} words")
