const DEFAULTS = {
  provider: "gemini",
  geminiKey: "",
  geminiModel: "gemini-flash-latest",
  groqKey: "",
  groqModel: "llama-3.3-70b-versatile",
  openrouterKey: "",
  openrouterModel: "meta-llama/llama-3.3-70b-instruct:free",
  anthropicKey: "",
  anthropicModel: "claude-haiku-4-5",
  extraStyle: "",
  inlineButton: false, // experimental, off by default
};

const $ = (id) => document.getElementById(id);

function showBlocks() {
  const p = $("provider").value;
  document.querySelectorAll(".provider-block").forEach((el) => {
    el.classList.toggle("active", el.dataset.provider === p);
  });
}

async function load() {
  const cfg = await chrome.storage.sync.get(DEFAULTS);
  for (const key of Object.keys(DEFAULTS)) {
    const el = $(key);
    if (el.type === "checkbox") el.checked = !!cfg[key];
    else el.value = cfg[key];
  }
  showBlocks();
}

async function save() {
  const cfg = {};
  for (const key of Object.keys(DEFAULTS)) {
    const el = $(key);
    if (el.type === "checkbox") cfg[key] = el.checked;
    else cfg[key] = typeof el.value === "string" ? el.value.trim() : el.value;
  }
  await chrome.storage.sync.set(cfg);
  $("status").textContent = "Saved ✓";
  setTimeout(() => ($("status").textContent = ""), 2000);
}

$("provider").addEventListener("change", showBlocks);
$("save").addEventListener("click", save);
load();

// Support links — set your Buy Me a Coffee handle here. The link stays hidden
// until a real URL is configured, so no dead link ever ships.
const COFFEE_URL = ""; // e.g. "https://buymeacoffee.com/yourhandle"
if (COFFEE_URL) {
  $("coffeeLink").href = COFFEE_URL;
} else {
  $("coffeeLink").style.display = "none";
}
