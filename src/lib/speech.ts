/** 浏览器是否暴露可用的 Web Speech 合成接口（客户端）。 */
export function isSpeechSynthesisAvailable(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.speechSynthesis !== "undefined" &&
    typeof SpeechSynthesisUtterance !== "undefined"
  );
}

/**
 * 按朗读语言选 voice：优先语言前缀相同的（de → de*，en → en*），同档中优先完全匹配（de-DE / en-US）。
 * 德语（lang = de-DE）的选择与以前完全相同。仅作增强，找不到仍应正常 speak。
 */
export function pickVoiceForLang(
  voices: SpeechSynthesisVoice[],
  lang: string,
): SpeechSynthesisVoice | undefined {
  const full = lang.toLowerCase();
  const prefix = full.split("-")[0];
  const sameLanguage = voices.filter((v) =>
    (v.lang || "").toLowerCase().startsWith(prefix),
  );
  if (sameLanguage.length === 0) return undefined;
  const preferExact = sameLanguage.find((v) =>
    (v.lang || "").toLowerCase().startsWith(full),
  );
  return preferExact ?? sameLanguage[0];
}

/**
 * 使用 speechSynthesis 朗读文本（默认德语；英语传 en-US）。函数名沿用旧名。
 * 须在用户手势（如 click）内同步调用，否则部分浏览器会静默忽略 speak。
 * 先 cancel；voice 可选（getVoices() 为空时仍 speak，仅依赖 utterance.lang）。
 */
export function speakGerman(text: string, lang = "de-DE"): boolean {
  if (!isSpeechSynthesisAvailable()) {
    return false;
  }
  const trimmed = text.trim();
  if (!trimmed) {
    console.log("没有可播放的文本");
    return false;
  }

  console.log("speaking text:", trimmed);

  window.speechSynthesis.cancel();

  const voices = window.speechSynthesis.getVoices();
  const voice = pickVoiceForLang(voices, lang);
  const utterance = new SpeechSynthesisUtterance(trimmed);
  utterance.lang = lang;
  utterance.rate = 0.9;
  utterance.pitch = 1;
  if (voice) {
    utterance.voice = voice;
  }

  console.log(
    "selected voice:",
    voice ? `${voice.name} (${voice.lang})` : "(none; using utterance.lang only)",
  );

  window.speechSynthesis.speak(utterance);
  return true;
}
