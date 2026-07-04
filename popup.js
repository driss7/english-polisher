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
