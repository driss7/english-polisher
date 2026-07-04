// English Polisher — content script.
// Supports the keyboard shortcuts (Alt+Shift+F / Alt+Shift+H): captures the
// current selection, replaces it in place in editable fields, or shows a small
// result panel when the selection is read-only. (Right-click mode was removed.)

(() => {
  const VERSION = 4;
  // Legacy guard (pre-versioning scripts) or an equal/newer script already active:
  // bail so we never end up with two message listeners double-handling events.
  if (window.__englishPolisherLoaded || (window.__epVersion || 0) >= VERSION) return;
  const firstLoad = !window.__epVersion;
  window.__epVersion = VERSION;

  let lastTarget = null;   // input/textarea element, or contenteditable host
  let lastRange = null;    // Range for contenteditable selections
  let lastInputSel = null; // {start, end} for input/textarea

  // Swappable dispatcher: future re-injections replace window.__epHandle instead
  // of adding a second onMessage listener.
  window.__epHandle = (msg, _sender, sendResponse) => {
    if (msg.type === "GET_SELECTION") {
      sendResponse({ text: captureSelection(), v: VERSION });
    } else if (msg.type === "SHOW_BUSY") {
      showToast("Rewriting…", "busy");
    } else if (msg.type === "SHOW_ERROR") {
      showToast(msg.error, "error", 6000);
    } else if (msg.type === "SHOW_RESULT") {
      handleResult(msg.result);
    }
  };
  if (firstLoad) {
    chrome.runtime.onMessage.addListener((m, s, r) => window.__epHandle(m, s, r));
  }

  function captureSelection() {
    const el = document.activeElement;
    if (el && (el.tagName === "TEXTAREA" || (el.tagName === "INPUT" && /^(text|search|url|email)$/i.test(el.type)))) {
      const start = el.selectionStart ?? 0;
      const end = el.selectionEnd ?? 0;
      lastTarget = el;
      lastInputSel = { start, end };
      lastRange = null;
      return end > start ? el.value.slice(start, end) : "";
    }
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      const host = range.commonAncestorContainer;
      const hostEl = host.nodeType === 1 ? host : host.parentElement;
      lastRange = range.cloneRange();
      lastTarget = hostEl?.closest?.('[contenteditable=""], [contenteditable="true"]') || null;
      lastInputSel = null;
      return sel.toString();
    }
    lastTarget = null;
    lastRange = null;
    lastInputSel = null;
    return "";
  }

  function handleResult(result) {
    removeToast();
    // 1) input / textarea — replace via execCommand to keep the undo stack.
    if (lastTarget && lastInputSel && document.contains(lastTarget)) {
      lastTarget.focus();
      lastTarget.setSelectionRange(lastInputSel.start, lastInputSel.end);
      if (!document.execCommand("insertText", false, result)) {
        lastTarget.setRangeText(result, lastInputSel.start, lastInputSel.end, "end");
        lastTarget.dispatchEvent(new Event("input", { bubbles: true }));
      }
      showToast("Done ✓ (Cmd+Z to undo)", "ok", 3000);
      return;
    }
    // 2) contenteditable (Gmail, comment boxes, most rich editors).
    if (lastTarget && lastRange) {
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(lastRange);
      lastTarget.focus();
      if (document.execCommand("insertText", false, result)) {
        showToast("Done ✓ (Cmd+Z to undo)", "ok", 3000);
        return;
      }
    }
    // 3) read-only text — show the result in a small panel with a copy button.
    showResultPanel(result);
  }

  // ---------- toast ----------

  let toastEl = null;
  let toastTimer = null;

  function removeToast() {
    if (toastTimer) clearTimeout(toastTimer);
    toastEl?.remove();
    toastEl = null;
  }

  function showToast(text, kind, ttl) {
    removeToast();
    toastEl = document.createElement("div");
    toastEl.textContent = kind === "busy" ? "✍️ " + text : text;
    Object.assign(toastEl.style, {
      position: "fixed", zIndex: 2147483647, right: "16px", bottom: "16px",
      maxWidth: "360px", padding: "10px 14px", borderRadius: "10px",
      font: "13px/1.4 -apple-system, system-ui, sans-serif",
      color: "#faf7f1", boxShadow: "0 4px 16px rgba(0,0,0,.25)",
      background: kind === "error" ? "#a3372a" : kind === "ok" ? "#2f6b3a" : "#1c1a17",
    });
    document.documentElement.appendChild(toastEl);
    if (ttl) toastTimer = setTimeout(removeToast, ttl);
  }

  // ---------- read-only result panel ----------

  const EP_CSS = `
#__ep_panel{position:fixed;z-index:2147483647;right:16px;bottom:16px;width:min(440px,92vw);max-height:70vh;overflow:auto;background:#faf7f1;color:#1c1a17;border:1px solid #ded7c9;border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.35);padding:14px 16px;font:13px/1.5 "Avenir Next",Avenir,"Segoe UI",system-ui,sans-serif;text-align:left}
#__ep_panel *{box-sizing:border-box}
#__ep_panel .__ep-head{display:flex;align-items:center;gap:10px;margin-bottom:8px}
#__ep_panel .__ep-mark{font:italic 600 15px "Iowan Old Style",Palatino,Georgia,serif}
#__ep_panel .__ep-mark::after{content:".";color:#1e3f8f}
#__ep_panel .__ep-x{border:none;background:none;cursor:pointer;font-size:14px;color:#6b6459;padding:0}
#__ep_panel .__ep-label{display:block;margin:0 0 4px;font-family:inherit;font-weight:700;font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:#6b6459}
#__ep_panel .__ep-res{white-space:pre-wrap;background:#fffdf9;border:1px solid #ded7c9;border-left:3px solid #1e3f8f;border-radius:0 10px 10px 0;padding:9px 11px;font-family:"Iowan Old Style",Palatino,Georgia,serif;font-size:13px;line-height:1.55}
#__ep_panel .__ep-pill{padding:2px 12px;cursor:pointer;background:none;border:1px solid #ded7c9;border-radius:999px;font-family:inherit;font-size:11px;font-weight:600;color:#1c1a17;transition:border-color .15s,color .15s}
#__ep_panel .__ep-pill:hover{border-color:#2f6b3a;color:#2f6b3a}
`;

  function ensureStyles() {
    if (!document.getElementById("__ep_styles")) {
      const s = document.createElement("style");
      s.id = "__ep_styles";
      s.textContent = EP_CSS;
      document.documentElement.appendChild(s);
    }
  }

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function showResultPanel(result) {
    ensureStyles();
    document.getElementById("__ep_panel")?.remove();

    const panel = el("div");
    panel.id = "__ep_panel";
    panel.addEventListener("keydown", (e) => { if (e.key === "Escape") panel.remove(); });

    const head = el("div", "__ep-head");
    head.append(el("span", "__ep-mark", "English Polisher"));
    const copy = el("button", "__ep-pill", "Copy");
    copy.style.marginLeft = "auto";
    copy.onclick = async () => {
      await navigator.clipboard.writeText(result);
      copy.textContent = "Copied ✓";
      setTimeout(() => (copy.textContent = "Copy"), 1500);
    };
    const x = el("button", "__ep-x", "✕");
    x.onclick = () => panel.remove();
    head.append(copy, x);

    panel.append(head, el("div", "__ep-res", result));
    document.documentElement.appendChild(panel);
  }
})();
