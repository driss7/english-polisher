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
  for (const key of Object.keys(DEFAULTS)) $(key).value = cfg[key];
  showBlocks();
}

async function save() {
  const cfg = {};
  for (const key of Object.keys(DEFAULTS)) cfg[key] = $(key).value.trim ? $(key).value.trim() : $(key).value;
  cfg.extraStyle = $("extraStyle").value.trim();
  await chrome.storage.sync.set(cfg);
  $("status").textContent = "Saved ✓";
  setTimeout(() => ($("status").textContent = ""), 2000);
}

$("provider").addEventListener("change", showBlocks);
$("save").addEventListener("click", save);
load();
