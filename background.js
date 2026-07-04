// English Polisher — MV3 service worker.
// Owns the context menus, keyboard commands, and all AI provider calls.

const MODES = {
  fix: {
    title: "Fix grammar & spelling",
    system:
      "You are a copy editor. Fix grammar, spelling and punctuation in the user's text. " +
      "Keep the meaning, tone, formatting and language variety exactly as written — do not rephrase " +
      "beyond what is needed to make it correct. Return ONLY the corrected text, no preamble, no quotes.",
  },
  humanize: {
    title: "Paraphrase — natural human tone",
    system:
      "You rewrite text so it sounds like a real person wrote it — natural, warm, conversational, " +
      "and clear. Remove stiff, robotic or AI-sounding phrasing (e.g. 'furthermore', 'delve', " +
      "'it is worth noting'). Use contractions where natural. Keep the meaning and roughly the same " +
      "length, and keep any formatting. Return ONLY the rewritten text, no preamble, no quotes.",
  },
  shorten: {
    title: "Make it shorter & clearer",
    system:
      "Rewrite the user's text to be significantly shorter and clearer while keeping every important " +
      "point and the original tone. Return ONLY the rewritten text, no preamble, no quotes.",
  },
  prompt: {
    title: "Ask AI — write or reply…",
    system:
      "You are a skilled writing assistant. Follow the user's INSTRUCTION. If CONTEXT text is provided " +
      "(e.g. an email to reply to, notes, an article), base your writing on it. Write in natural, " +
      "human-sounding English — clear, warm, and never robotic. Return ONLY the requested text, " +
      "no preamble, no explanations, no quotes.",
  },
};

const DEFAULTS = {
  provider: "gemini", // gemini | builtin | groq | openrouter | anthropic
  geminiKey: "",
  geminiModel: "gemini-flash-latest",
  groqKey: "",
  groqModel: "llama-3.3-70b-versatile",
  openrouterKey: "",
  openrouterModel: "meta-llama/llama-3.3-70b-instruct:free",
  anthropicKey: "",
  anthropicModel: "claude-haiku-4-5",
  extraStyle: "", // optional user instruction appended to every system prompt
};

chrome.commands.onCommand.addListener(async (command) => {
  const mode = command === "fix-grammar" ? "fix" : command === "humanize" ? "humanize" : null;
  if (!mode) return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id != null) runOnTab(tab.id, mode, "");
});

// Popup and the in-page prompt panel call the rewriter directly.
// For prompt mode, pass {instruction, context} and it's composed here.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "REWRITE") {
    const text = msg.instruction
      ? `INSTRUCTION:\n${msg.instruction}` + (msg.context ? `\n\nCONTEXT:\n${msg.context}` : "")
      : msg.text;
    rewrite(msg.mode, text)
      .then((result) => sendResponse({ ok: true, result }))
      .catch((err) => sendResponse({ ok: false, error: String(err.message || err) }));
    return true; // async response
  }
});

// Send to the content script; if the page was loaded before the extension
// installed, inject the script and retry once.
async function sendEnsuring(tabId, payload) {
  try {
    return await chrome.tabs.sendMessage(tabId, payload);
  } catch {
    try {
      await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
      return await chrome.tabs.sendMessage(tabId, payload);
    } catch {
      return null;
    }
  }
}

const CONTENT_VERSION = 6;

// After an extension update, already-open tabs keep running the old content
// script (Chrome never hot-swaps them). Detect that and tell the user to
// refresh the page instead of silently doing nothing.
function staleGuard(tabId, sel) {
  if (sel && sel.v !== CONTENT_VERSION) {
    notify(tabId, {
      type: "SHOW_ERROR",
      error: "English Polisher was updated — refresh this page (⌘R) to use it here.",
    });
    return true;
  }
  return false;
}

async function runOnTab(tabId, mode, fallbackText) {
  // Ask the content script for the exact selection (info.selectionText mangles newlines).
  const sel = await sendEnsuring(tabId, { type: "GET_SELECTION" });
  if (staleGuard(tabId, sel)) return;
  const text = (sel?.text || fallbackText || "").trim();
  if (!text) {
    notify(tabId, { type: "SHOW_ERROR", error: "Select some text first." });
    return;
  }

  notify(tabId, { type: "SHOW_BUSY", mode });
  try {
    const result = await rewrite(mode, text);
    notify(tabId, { type: "SHOW_RESULT", mode, original: text, result });
  } catch (err) {
    notify(tabId, { type: "SHOW_ERROR", error: String(err.message || err) });
  }
}

function notify(tabId, payload) {
  chrome.tabs.sendMessage(tabId, payload).catch(() => {});
}

async function rewrite(mode, text) {
  const cfg = await chrome.storage.sync.get(DEFAULTS);
  const modeDef = MODES[mode] || MODES.fix;
  let system = modeDef.system;
  if (cfg.extraStyle) system += " Additional style guidance from the user: " + cfg.extraStyle;

  switch (cfg.provider) {
    case "gemini":
      return callGemini(cfg, system, text);
    case "builtin":
      return callBuiltin(system, text);
    case "groq":
      return callOpenAICompat(
        "https://api.groq.com/openai/v1/chat/completions",
        cfg.groqKey, cfg.groqModel, system, text,
        "Groq — add a free API key in Options (console.groq.com/keys)."
      );
    case "openrouter":
      return callOpenAICompat(
        "https://openrouter.ai/api/v1/chat/completions",
        cfg.openrouterKey, cfg.openrouterModel, system, text,
        "OpenRouter — add a free API key in Options (openrouter.ai/keys)."
      );
    case "anthropic":
      return callAnthropic(cfg, system, text);
    default:
      throw new Error("No provider configured — open the extension Options.");
  }
}

// ---------- Providers ----------

// Google Gemini — free tier (aistudio.google.com/apikey), the recommended default.
async function callGemini(cfg, system, text) {
  if (!cfg.geminiKey) {
    throw new Error("Add a free Gemini API key in Options (get one at aistudio.google.com/apikey).");
  }
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `${encodeURIComponent(cfg.geminiModel)}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": cfg.geminiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text }] }],
      generationConfig: { temperature: 0.4 },
    }),
  });
  if (!res.ok) throw new Error(`Gemini error ${res.status}: ${await errText(res)}`);
  const data = await res.json();
  const out = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";
  if (!out) throw new Error("Gemini returned an empty response.");
  return out.trim();
}

// Chrome built-in AI (Gemini Nano via the Prompt API) — fully free, on-device, no key.
async function callBuiltin(system, text) {
  if (typeof LanguageModel === "undefined") {
    throw new Error(
      "Chrome built-in AI isn't available in this Chrome. Needs a recent Chrome on a machine " +
      "with ~16 GB RAM; check chrome://on-device-internals. Meanwhile use the free Gemini API instead."
    );
  }
  const availability = await LanguageModel.availability();
  if (availability === "unavailable") {
    throw new Error("This device can't run Chrome's on-device model. Use the free Gemini API instead.");
  }
  const session = await LanguageModel.create({
    initialPrompts: [{ role: "system", content: system }],
  });
  try {
    const out = await session.prompt(text);
    if (!out) throw new Error("Built-in model returned an empty response.");
    return out.trim();
  } finally {
    session.destroy();
  }
}

// Groq / OpenRouter — OpenAI-compatible chat completions (both have free tiers).
async function callOpenAICompat(url, key, model, system, text, keyHint) {
  if (!key) throw new Error(keyHint);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      messages: [
        { role: "system", content: system },
        { role: "user", content: text },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Provider error ${res.status}: ${await errText(res)}`);
  const data = await res.json();
  const out = data?.choices?.[0]?.message?.content || "";
  if (!out) throw new Error("Provider returned an empty response.");
  return out.trim();
}

// Anthropic Claude — paid (no free tier); Haiku 4.5 is the cheap default for rewrites.
// Raw fetch because an unbundled MV3 worker can't import the npm SDK; the
// anthropic-dangerous-direct-browser-access header is required outside Node.
async function callAnthropic(cfg, system, text) {
  if (!cfg.anthropicKey) throw new Error("Add an Anthropic API key in Options (console.anthropic.com).");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": cfg.anthropicKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: cfg.anthropicModel,
      max_tokens: 4096,
      system,
      messages: [{ role: "user", content: text }],
    }),
  });
  if (!res.ok) throw new Error(`Claude error ${res.status}: ${await errText(res)}`);
  const data = await res.json();
  if (data.stop_reason === "refusal") throw new Error("Claude declined this request.");
  const out = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
  if (!out) throw new Error("Claude returned an empty response.");
  return out.trim();
}

async function errText(res) {
  try {
    const j = await res.json();
    return j?.error?.message || JSON.stringify(j).slice(0, 200);
  } catch {
    return res.statusText;
  }
}
