const DRAFT_PREFIX = "importDraft:";
const MESSAGE_TYPE = "german-reading-coach:import-draft";

void bridgeImportDraft();

async function bridgeImportDraft() {
  const draftId = new URL(window.location.href).searchParams.get("chromeDraftId");
  if (!draftId) return;

  const key = `${DRAFT_PREFIX}${draftId}`;
  const stored = await chrome.storage.local.get(key);
  const payload = stored[key];
  if (!payload || typeof payload !== "object") return;

  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    window.postMessage(
      {
        type: MESSAGE_TYPE,
        draftId,
        payload,
      },
      window.location.origin,
    );
    if (attempts >= 8) {
      window.clearInterval(timer);
      void chrome.storage.local.remove(key);
    }
  }, 400);
}
