const $ = (id) => document.getElementById(id);
const tabs = $("tabs");
const panes = { polish: $("panePolish"), ask: $("paneAsk") };
const resultCard = $("resultCard");
const result = $("result");
const copyBtn = $("copy");

// ---------- mode toggle ----------
function setMode(mode) {
  tabs.dataset.active = mode;
  $("tabPolish").classList.toggle("active", mode === "polish");
  $("tabAsk").classList.toggle("active", mode === "ask");
  panes.polish.classList.toggle("active", mode === "polish");
  panes.ask.classList.toggle("active", mode === "ask");
  chrome.storage?.sync?.set({ popupMode: mode });
  (mode === "polish" ? $("input") : $("instruction")).focus();
}
$("tabPolish").addEventListener("click", () => setMode("polish"));
$("tabAsk").addEventListener("click", () => setMode("ask"));
chrome.storage?.sync?.get({ popupMode: "polish" })?.then(({ popupMode }) => setMode(popupMode));

// ---------- context reveal (Ask tab) ----------
$("ctxToggle").addEventListener("click", () => {
  const open = !$("ctxWrap").classList.contains("open");
  $("ctxWrap").classList.toggle("open", open);
  $("ctxToggle").classList.toggle("open", open);
  if (open) $("context").focus();
});

// ---------- polish actions ----------
document.querySelectorAll(".actions button").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const text = $("input").value.trim();
    if (!text) return show("Paste some text in “Your text” first.", "error");
    show("polishing…", "busy");
    const resp = await chrome.runtime.sendMessage({ type: "REWRITE", mode: btn.dataset.mode, text });
    show(resp?.ok ? resp.result : resp?.error || "Something went wrong.", resp?.ok ? "" : "error");
  });
});

// ---------- ask / generate ----------
async function generate() {
  const instruction = $("instruction").value.trim();
  if (!instruction) return show("Tell me what to write first.", "error");
  const gen = $("gen");
  gen.disabled = true;
  show("writing…", "busy");
  const resp = await chrome.runtime.sendMessage({
    type: "REWRITE", mode: "prompt", instruction, context: $("context").value.trim(),
  });
  gen.disabled = false;
  show(resp?.ok ? resp.result : resp?.error || "Something went wrong.", resp?.ok ? "" : "error");
}
$("gen").addEventListener("click", generate);
$("instruction").addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); generate(); }
});
$("context").addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); generate(); }
});

// ---------- result ----------
function show(text, state) {
  resultCard.style.display = "block";
  resultCard.className = state; // "", "busy", "error"
  result.textContent = text;
  copyBtn.style.display = state ? "none" : "inline-block";
  if (state === "") saveDraft(); // keep successful results across popup reopens
}
copyBtn.addEventListener("click", async () => {
  await navigator.clipboard.writeText(result.textContent);
  copyBtn.textContent = "Copied ✓";
  setTimeout(() => (copyBtn.textContent = "Copy"), 1500);
});

$("openOptions").addEventListener("click", (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

// ---------- draft persistence ----------
// The popup is destroyed the moment it loses focus (a click anywhere outside),
// so every keystroke is saved and restored on reopen. storage.session survives
// popup closes but clears when the browser exits.
const draftStore = chrome.storage?.session || chrome.storage?.local;
let draftTimer = null;

function saveDraft() {
  if (!draftStore) return;
  clearTimeout(draftTimer);
  draftTimer = setTimeout(() => {
    draftStore.set({
      draft: {
        input: $("input").value,
        instruction: $("instruction").value,
        context: $("context").value,
        ctxOpen: $("ctxWrap").classList.contains("open"),
        result: resultCard.style.display === "block" && resultCard.className === "" ? result.textContent : "",
      },
    });
  }, 150);
}

for (const id of ["input", "instruction", "context"]) {
  $(id).addEventListener("input", saveDraft);
}
$("ctxToggle").addEventListener("click", saveDraft);

(async () => {
  if (!draftStore) return;
  const { draft } = await draftStore.get("draft");
  if (!draft) return;
  $("input").value = draft.input || "";
  $("instruction").value = draft.instruction || "";
  $("context").value = draft.context || "";
  if (draft.ctxOpen || draft.context) {
    $("ctxWrap").classList.add("open");
    $("ctxToggle").classList.add("open");
  }
  if (draft.result) show(draft.result, "");
})();

document.querySelectorAll(".clearDraft").forEach((btn) =>
  btn.addEventListener("click", () => {
    for (const id of ["input", "instruction", "context"]) $(id).value = "";
    $("ctxWrap").classList.remove("open");
    $("ctxToggle").classList.remove("open");
    resultCard.style.display = "none";
    draftStore?.remove("draft");
    (tabs.dataset.active === "polish" ? $("input") : $("instruction")).focus();
  })
);

// ---------- page diagnosis (for debugging sites where the button won't show) ----------
$("diag").addEventListener("click", async (e) => {
  e.preventDefault();
  const reports = [];
  const listener = (m) => { if (m?.type === "DIAG_REPORT") reports.push(m.data); };
  chrome.runtime.onMessage.addListener(listener);
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) await chrome.tabs.sendMessage(tab.id, { type: "DIAGNOSE" }).catch(() => {});
  } catch {}
  show("collecting…", "busy");
  setTimeout(() => {
    chrome.runtime.onMessage.removeListener(listener);
    // frames with editors or focus first, empty frames last
    reports.sort((a, b) => (b.editables + b.textareas + b.focusChain.length) - (a.editables + a.textareas + a.focusChain.length));
    show(reports.length ? JSON.stringify(reports, null, 1) : "No frames responded — refresh the tab and try again.", reports.length ? "" : "error");
  }, 700);
});

// ---------- content-script status for the active tab ----------
(async () => {
  const s = $("pageStatus");
  let tab;
  try {
    [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  } catch { return; }
  if (!tab?.id) return;
  try {
    const resp = await chrome.tabs.sendMessage(tab.id, { type: "PING" });
    if (resp?.v) {
      s.textContent = `✓ In-page button active on this tab (v${resp.v})`;
      s.className = "ok";
      return;
    }
    throw new Error("no response");
  } catch {
    if (tab.url && !/^https?:/i.test(tab.url)) {
      s.textContent = "In-page button can’t run on this page type (browser page / store / PDF).";
    } else {
      s.textContent = "⚠ In-page button not running in this tab — refresh the page (⌘⇧R).";
      s.className = "warn";
    }
  }
})();
