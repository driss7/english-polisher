// English Polisher — content script.
// Supports the keyboard shortcuts (Alt+Shift+F / Alt+Shift+H): captures the
// current selection, replaces it in place in editable fields, or shows a small
// result panel when the selection is read-only. (Right-click mode was removed.)

(() => {
  const VERSION = 9;
  // Legacy guard (pre-versioning scripts) or an equal/newer script already active:
  // bail so we never end up with two message listeners double-handling events.
  if (window.__englishPolisherLoaded || (window.__epVersion || 0) >= VERSION) return;
  const firstLoad = !window.__epVersion;
  window.__epVersion = VERSION;

  // Visible marker so you can confirm the script is alive (top frame only).
  if (window.top === window) console.info("[English Polisher] content script v" + VERSION + " active");

  // Diagnostic — click into a field, then run __epDebug() in the DevTools console.
  // Defined up-front so it exists even if later setup fails.
  window.__epDebug = () => {
    const a = deepActive();
    const info = {
      version: VERSION,
      frame: window.top === window ? "top" : "iframe",
      url: location.href,
      enabled: typeof epEnabled === "undefined" ? null : epEnabled,
      activeTag: a && a.tagName,
      activeType: a && a.getAttribute && a.getAttribute("type"),
      isContentEditable: a && a.isContentEditable,
      contentEditableAttr: a && a.getAttribute && a.getAttribute("contenteditable"),
      rootType: a && a.getRootNode && a.getRootNode().constructor && a.getRootNode().constructor.name,
      eligible: !!eligibleHost(a),
      dotDisplay: epDot && epDot.style.display,
    };
    console.log("[English Polisher]", info);
    return info;
  };

  // Swappable dispatcher: future re-injections replace window.__epHandle instead
  // of adding a second onMessage listener. With all_frames, the background
  // broadcasts RUN_SHORTCUT to every frame; only the frame holding the focused
  // field (or an active selection) acts, so nothing is duplicated.
  window.__epHandle = (msg) => {
    if (msg.type === "RUN_SHORTCUT") runShortcut(msg.mode);
  };
  if (firstLoad) {
    chrome.runtime.onMessage.addListener((m, s, r) => window.__epHandle(m, s, r));
  }

  // Keyboard-shortcut entry, frame-local: rewrite the focused field in place, or
  // show a result panel for a read-only text selection in this frame.
  function runShortcut(mode) {
    const host = eligibleHost(deepActive());
    if (host) { epHost = host; reposition(); runInline(mode); return; }
    const sel = window.getSelection();
    const text = sel && !sel.isCollapsed ? sel.toString() : "";
    if (text.trim()) runReadonly(mode, text);
  }

  async function runReadonly(mode, text) {
    showToast("Rewriting…", "busy");
    try {
      const resp = await chrome.runtime.sendMessage({ type: "REWRITE", mode, text: text.trim() });
      removeToast();
      if (resp?.ok) showResultPanel(resp.result);
      else showToast(resp?.error || "Something went wrong.", "error", 6000);
    } catch (err) {
      removeToast();
      showToast(String((err && err.message) || err), "error", 6000);
    }
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
/* inline field assistant */
#__ep_dot{position:fixed;z-index:2147483646;width:24px;height:24px;padding:0;border:none;border-radius:50%;background:linear-gradient(135deg,#274b9e,#16306e);box-shadow:0 2px 8px rgba(22,48,110,.45);display:none;align-items:center;justify-content:center;cursor:pointer;opacity:.9;transition:transform .12s,opacity .12s}
#__ep_dot:hover{opacity:1;transform:scale(1.12)}
#__ep_dot svg{width:14px;height:14px;display:block}
#__ep_dot .__ep-spin{display:none;width:12px;height:12px;border:2px solid rgba(255,255,255,.35);border-top-color:#fff;border-radius:50%;animation:__ep-rot .7s linear infinite}
#__ep_dot.busy{cursor:default;opacity:1}
#__ep_dot.busy svg{display:none}
#__ep_dot.busy .__ep-spin{display:block}
@keyframes __ep-rot{to{transform:rotate(360deg)}}
#__ep_menu{position:fixed;z-index:2147483647;display:none;min-width:172px;padding:5px;background:#faf7f1;border:1px solid #ded7c9;border-radius:12px;box-shadow:0 10px 30px rgba(22,48,110,.28);font:13px/1.4 'Avenir Next',Avenir,'Segoe UI',system-ui,sans-serif}
#__ep_menu.open{display:block}
#__ep_menu button{display:flex;flex-direction:column;align-items:flex-start;gap:1px;width:100%;text-align:left;border:none;background:none;cursor:pointer;padding:7px 10px;border-radius:8px;color:#1c1a17;font:inherit}
#__ep_menu button:hover{background:#f1ece1}
#__ep_menu button b{font-weight:600;font-size:12.5px}
#__ep_menu button span{font:italic 11px Georgia,serif;color:#6b6459}
.__ep-field-busy{animation:__ep-pulse 1.1s ease-in-out infinite}
@keyframes __ep-pulse{0%,100%{box-shadow:0 0 0 0 rgba(30,63,143,0)}50%{box-shadow:0 0 0 3px rgba(30,63,143,.28)}}
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

  // ---------- inline field assistant ----------
  // A small nib button in the bottom-right of any editable field. Click it for
  // Fix / Humanize / Shorten, which rewrite the field (or its selection) in place
  // with a loading state.

  let epEnabled = true;
  let epHost = null;          // the editable element the dot is attached to
  let epBusy = false;
  let epDot = null, epMenu = null, epHideTimer = null;

  const NIB_SVG =
    '<svg viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">' +
    '<g transform="rotate(-40 64 64)"><path fill-rule="evenodd" fill="#faf7f1" ' +
    'd="M64 112 C52 92 46 74 46 59 C46 43 54 33 64 33 C74 33 82 43 82 59 C82 74 76 92 64 112 Z ' +
    'M59 55 a5 5 0 1 0 10 0 a5 5 0 1 0 -10 0 M61.6 60 L66.4 60 L64 104 Z"/></g></svg>';

  const EP_ACTIONS = [
    ["fix", "Fix", "grammar & spelling"],
    ["humanize", "Humanize", "natural tone"],
    ["shorten", "Shorten", "tighter"],
  ];

  function eligibleHost(t) {
    if (!t || !t.closest) return null;
    if (t.closest("#__ep_panel,#__ep_dot,#__ep_menu")) return null;
    if (t.tagName === "TEXTAREA") return (t.readOnly || t.disabled) ? null : t;
    if (t.tagName === "INPUT") {
      if (!/^(text|search|url|email|)$/i.test(t.type)) return null;
      if (t.readOnly || t.disabled) return null;
      return t.clientWidth >= 200 ? t : null;
    }
    if (t.isContentEditable) return t.closest('[contenteditable=""],[contenteditable="true"]') || t;
    return null;
  }

  // The deepest focused element, descending through open shadow roots
  // (Reddit, many web-component editors put the real field in a shadow tree).
  function deepActive() {
    let a = document.activeElement;
    while (a && a.shadowRoot && a.shadowRoot.activeElement) a = a.shadowRoot.activeElement;
    return a;
  }

  // Selection object for the field's tree — shadow roots have their own in Chrome.
  function fieldSelection(host) {
    const root = host.getRootNode();
    return root && typeof root.getSelection === "function" ? root.getSelection() : window.getSelection();
  }

  function initInline() {
    ensureStyles();

    epDot = el("button");
    epDot.id = "__ep_dot";
    epDot.title = "Polish this text";
    epDot.innerHTML = NIB_SVG + '<span class="__ep-spin"></span>';

    epMenu = el("div");
    epMenu.id = "__ep_menu";
    for (const [mode, label, sub] of EP_ACTIONS) {
      const b = el("button");
      b.innerHTML = "<b>" + label + "</b><span>" + sub + "</span>";
      b.addEventListener("mousedown", (e) => e.preventDefault());
      b.addEventListener("click", () => runInline(mode));
      epMenu.appendChild(b);
    }

    // Keep the field focused (and its selection intact) when we click our own UI.
    epDot.addEventListener("mousedown", (e) => e.preventDefault());
    epMenu.addEventListener("mousedown", (e) => e.preventDefault());
    epDot.addEventListener("click", toggleMenu);

    document.documentElement.append(epDot, epMenu);

    document.addEventListener("focusin", onFocusIn, true);
    document.addEventListener("focusout", onFocusOut, true);
    document.addEventListener("click", (e) => {
      if (epMenu.classList.contains("open") && !epMenu.contains(e.target) && e.target !== epDot) {
        epMenu.classList.remove("open");
      }
    }, true);
    window.addEventListener("scroll", () => { if (epHost) reposition(); }, true);
    window.addEventListener("resize", () => { if (epHost) reposition(); });

    // Caret-based detection: catch the field even when a focus event didn't fire
    // (programmatic focus, editors that manage focus themselves, etc.).
    document.addEventListener("selectionchange", () => {
      if (!epEnabled || epBusy) return;
      const host = eligibleHost(deepActive());
      if (!host) return;
      if (host !== epHost) { epHost = host; epMenu.classList.remove("open"); }
      clearTimeout(epHideTimer);
      reposition();
    });

    chrome.storage?.sync?.get({ inlineButton: true })?.then((v) => {
      epEnabled = v.inlineButton !== false;
      if (!epEnabled) hideInline();
    });
    chrome.storage?.onChanged?.addListener((ch, area) => {
      if (area === "sync" && ch.inlineButton) {
        epEnabled = ch.inlineButton.newValue !== false;
        if (!epEnabled) hideInline();
      }
    });

    // A field may already be focused when this frame's script loads.
    const initHost = eligibleHost(deepActive());
    if (initHost) { epHost = initHost; reposition(); }
  }

  function onFocusIn(e) {
    if (!epEnabled) return;
    // composedPath()[0] is the true target even when the event crosses a shadow
    // boundary (e.target would be retargeted to the shadow host otherwise).
    const path = typeof e.composedPath === "function" ? e.composedPath() : null;
    const target = path && path.length ? path[0] : e.target;
    const host = eligibleHost(target);
    if (!host) return;
    clearTimeout(epHideTimer);
    epHost = host;
    epMenu.classList.remove("open");
    reposition();
  }

  function onFocusOut() {
    clearTimeout(epHideTimer);
    epHideTimer = setTimeout(() => {
      if (!epBusy && !eligibleHost(deepActive())) hideInline();
    }, 200);
  }

  function hideInline() {
    epHost = null;
    if (epDot) epDot.style.display = "none";
    if (epMenu) epMenu.classList.remove("open");
  }

  function reposition() {
    // isConnected (not document.contains) — the host may live in a shadow tree.
    if (!epHost || !epHost.isConnected) return hideInline();
    const r = epHost.getBoundingClientRect();
    if (r.width < 40 || r.height < 12 || r.bottom < 0 || r.top > innerHeight) {
      epDot.style.display = "none";
      epMenu.classList.remove("open");
      return;
    }
    const left = Math.min(r.right - 28, innerWidth - 30);
    const top = Math.max(Math.min(r.bottom - 28, innerHeight - 30), r.top + 2);
    epDot.style.left = left + "px";
    epDot.style.top = top + "px";
    epDot.style.display = "flex";
    if (epMenu.classList.contains("open")) positionMenu();
  }

  function toggleMenu() {
    if (epBusy) return;
    if (epMenu.classList.contains("open")) { epMenu.classList.remove("open"); return; }
    epMenu.classList.add("open");
    positionMenu();
  }

  function positionMenu() {
    const d = epDot.getBoundingClientRect();
    const m = epMenu.getBoundingClientRect();
    let left = d.right - m.width;
    let top = d.top - m.height - 6;
    if (top < 4) top = d.bottom + 6;      // not enough room above → drop below
    if (left < 4) left = 4;
    epMenu.style.left = left + "px";
    epMenu.style.top = top + "px";
  }

  function grabField(host) {
    if (host.tagName === "INPUT" || host.tagName === "TEXTAREA") {
      let s = host.selectionStart ?? 0, e = host.selectionEnd ?? 0;
      if (e <= s) { s = 0; e = host.value.length; }   // no selection → whole field
      return { kind: "input", start: s, end: e, text: host.value.slice(s, e) };
    }
    const sel = fieldSelection(host);
    if (sel && sel.rangeCount && !sel.isCollapsed && sel.toString().trim() && host.contains(sel.anchorNode)) {
      return { kind: "ce", whole: false, range: sel.getRangeAt(0).cloneRange(), text: sel.toString() };
    }
    return { kind: "ce", whole: true, text: host.innerText ?? host.textContent ?? "" };
  }

  function applyToField(host, info, text) {
    host.focus();
    if (info.kind === "input") {
      host.setSelectionRange(info.start, info.end);
      if (!document.execCommand("insertText", false, text)) {
        host.setRangeText(text, info.start, info.end, "end");
        host.dispatchEvent(new Event("input", { bubbles: true }));
      }
      return;
    }
    // contenteditable — select the target (whole field or the saved selection),
    // then insertText so rich editors (Gmail, Reddit/Lexical) see a normal edit.
    if (info.whole) {
      document.execCommand("selectAll", false);
    } else if (info.range) {
      const sel = fieldSelection(host);
      try { sel.removeAllRanges(); sel.addRange(info.range); } catch (_) {}
    }
    if (!document.execCommand("insertText", false, text) && info.whole) {
      host.textContent = text;   // last resort for editors that block execCommand
      host.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }

  function setInlineBusy(host, on) {
    epBusy = on;
    epDot.classList.toggle("busy", on);
    host.classList.toggle("__ep-field-busy", on);
    // Only lock plain inputs/textareas; leaving rich editors alone avoids
    // corrupting their internal state (e.g. Lexical).
    if (host.tagName === "INPUT" || host.tagName === "TEXTAREA") {
      if (on) { host.__epRO = host.readOnly; host.readOnly = true; }
      else host.readOnly = host.__epRO || false;
    }
  }

  async function runInline(mode) {
    if (epBusy || !epHost) return;
    const host = epHost;
    const info = grabField(host);
    const text = (info.text || "").trim();
    epMenu.classList.remove("open");
    if (!text) { showToast("This field is empty.", "error", 2500); return; }
    setInlineBusy(host, true);
    try {
      const resp = await chrome.runtime.sendMessage({ type: "REWRITE", mode, text });
      setInlineBusy(host, false);
      if (resp?.ok) {
        applyToField(host, info, resp.result);
        showToast("Done ✓ (Cmd+Z to undo)", "ok", 2500);
      } else {
        showToast(resp?.error || "Something went wrong.", "error", 6000);
      }
    } catch (err) {
      setInlineBusy(host, false);
      showToast(String((err && err.message) || err), "error", 6000);
    }
    reposition();
  }

  initInline();
})();
