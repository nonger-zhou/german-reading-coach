import { importArticleFromUrl } from "../src/lib/import/importFromUrl.ts";
import { parseArticleFromRawInput } from "../src/lib/text/parseArticleFromRaw.ts";

const url =
  "https://blog.nationalmuseum.ch/2026/01/der-hotelier-dem-ein-licht-aufging/";

const a = await importArticleFromUrl(url);
console.log("import cleaned len", a.cleaned_text.length);
console.log("has 18. Juli", a.cleaned_text.includes("18. Juli"));
console.log("raw len", (a.raw_text ?? "").length);

const parsed = parseArticleFromRawInput(a.raw_text ?? "");
console.log("reparse len", parsed.cleanedText.length);
