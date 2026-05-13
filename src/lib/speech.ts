/** 浏览器是否暴露可用的 Web Speech 合成接口（客户端）。 */
export function isSpeechSynthesisAvailable(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.speechSynthesis !== "undefined" &&
    typeof SpeechSynthesisUtterance !== "undefined"
  );
}

/** 优先选择 lang 以 de 开头的 voice；在同档中优先 de-DE。仅作增强，找不到仍应正常 speak。 */
function pickGermanVoice(
  voices: SpeechSynthesisVoice[],
): SpeechSynthesisVoice | undefined {
  const deVoices = voices.filter((v) =>
    (v.lang || "").toLowerCase().startsWith("de"),
  );
  if (deVoices.length === 0) return undefined;
  const preferDeDe = deVoices.find((v) =>
    (v.lang || "").toLowerCase().startsWith("de-de"),
  );
  return preferDeDe ?? deVoices[0];
}

/**
 * 使用 speechSynthesis 朗读德语文本。
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
  const voice = pickGermanVoice(voices);
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
