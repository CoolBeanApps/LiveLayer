const enabled = document.querySelector("#enabled");
const open = document.querySelector("#open");
const status = document.querySelector("#status");
const STORAGE_KEY = "livelayerState";
const DEFAULT_NUMBER_STYLE = { mode: "inherit", solidColor: "#ffffff", farColor: "#ff4d5e", nearColor: "#ffd54a", reachedColor: "#42df82" };
const DEFAULT_SETTINGS = {
  accentColor: "#62d9ff",
  textColor: "#ffffff",
  fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
  backgroundOpacity: 0,
  gridOpacity: 0.1,
  numberStyle: DEFAULT_NUMBER_STYLE
};
const settingInputs = {
  accentColor: document.querySelector("#accentColor"),
  textColor: document.querySelector("#textColor"),
  fontFamily: document.querySelector("#fontFamily"),
  backgroundOpacity: document.querySelector("#backgroundOpacity"),
  gridOpacity: document.querySelector("#gridOpacity"),
  numberColorMode: document.querySelector("#numberColorMode"),
  solidColor: document.querySelector("#solidColor"),
  farColor: document.querySelector("#farColor"),
  nearColor: document.querySelector("#nearColor"),
  reachedColor: document.querySelector("#reachedColor")
};
let currentState = null;
let saveTimer = 0;

async function activeTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

async function send(message) {
  const tab = await activeTab();
  if (!tab?.id) throw new Error("No active tab was found.");
  try {
    await chrome.tabs.sendMessage(tab.id, message);
  } catch {
    throw new Error("LiveLayer cannot run on this browser page. Open a normal website or video page.");
  }
}

async function load() {
  const [tab, stored] = await Promise.all([activeTab(), chrome.storage.local.get(STORAGE_KEY)]);
  currentState = stored[STORAGE_KEY] || { enabled: true, controlsVisible: true, sources: [], widgets: [] };
  currentState.settings = { ...DEFAULT_SETTINGS, ...(currentState.settings || {}), numberStyle: { ...DEFAULT_NUMBER_STYLE, ...(currentState.settings?.numberStyle || {}) } };
  populateSettings(currentState.settings);
  if (!tab?.id) return;
  const response = await chrome.runtime.sendMessage({ type: "LIVELAYER_GET_ACTIVE_TAB", tabId: tab.id });
  enabled.checked = Boolean(response?.active);
}

function populateSettings(settings) {
  settingInputs.accentColor.value = settings.accentColor;
  settingInputs.textColor.value = settings.textColor;
  settingInputs.fontFamily.value = settings.fontFamily;
  settingInputs.backgroundOpacity.value = Math.round(settings.backgroundOpacity * 100);
  settingInputs.gridOpacity.value = Math.round(settings.gridOpacity * 100);
  settingInputs.numberColorMode.value = settings.numberStyle.mode;
  settingInputs.solidColor.value = settings.numberStyle.solidColor;
  settingInputs.farColor.value = settings.numberStyle.farColor;
  settingInputs.nearColor.value = settings.numberStyle.nearColor;
  settingInputs.reachedColor.value = settings.numberStyle.reachedColor;
  document.querySelector("#backgroundOpacityLabel").textContent = `${settingInputs.backgroundOpacity.value}%`;
  document.querySelector("#gridOpacityLabel").textContent = `${settingInputs.gridOpacity.value}%`;
  document.documentElement.style.setProperty("--accent", settings.accentColor);
}

function settingsFromInputs() {
  return {
    accentColor: settingInputs.accentColor.value,
    textColor: settingInputs.textColor.value,
    fontFamily: settingInputs.fontFamily.value,
    backgroundOpacity: Number(settingInputs.backgroundOpacity.value) / 100,
    gridOpacity: Number(settingInputs.gridOpacity.value) / 100,
    numberStyle: {
      mode: settingInputs.numberColorMode.value,
      solidColor: settingInputs.solidColor.value,
      farColor: settingInputs.farColor.value,
      nearColor: settingInputs.nearColor.value,
      reachedColor: settingInputs.reachedColor.value
    }
  };
}

function scheduleSettingsSave() {
  if (!currentState) return;
  const next = settingsFromInputs();
  currentState.settings = next;
  populateSettings(next);
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    const stored = await chrome.storage.local.get(STORAGE_KEY);
    const latest = stored[STORAGE_KEY] || currentState;
    const previous = { ...DEFAULT_SETTINGS, ...(latest.settings || {}), numberStyle: { ...DEFAULT_NUMBER_STYLE, ...(latest.settings?.numberStyle || {}) } };
    for (const widget of latest.widgets || []) {
      widget.style ||= {};
      if (!widget.style.accentColor || widget.style.accentColor === previous.accentColor) widget.style.accentColor = next.accentColor;
      if (!widget.style.color || widget.style.color === previous.textColor) widget.style.color = next.textColor;
      if (!widget.style.fontFamily || widget.style.fontFamily === previous.fontFamily) widget.style.fontFamily = next.fontFamily;
      if (widget.style.backgroundOpacity === undefined || widget.style.backgroundOpacity === previous.backgroundOpacity) widget.style.backgroundOpacity = next.backgroundOpacity;
    }
    latest.settings = next;
    currentState = latest;
    await chrome.storage.local.set({ [STORAGE_KEY]: latest });
    status.textContent = "Settings saved.";
    status.classList.add("saved");
  }, 100);
}

for (const input of Object.values(settingInputs)) input.addEventListener("input", scheduleSettingsSave);
document.querySelector("#reset").addEventListener("click", () => {
  populateSettings(structuredClone(DEFAULT_SETTINGS));
  scheduleSettingsSave();
});

enabled.addEventListener("change", async () => {
  status.textContent = "";
  status.classList.remove("saved");
  const tab = await activeTab();
  if (!tab?.id) return;
  const response = await chrome.runtime.sendMessage({ type: "LIVELAYER_SET_ACTIVE_TAB", tabId: tab.id, active: enabled.checked });
  if (!response?.ok) {
    enabled.checked = !enabled.checked;
    status.textContent = response?.error || "LiveLayer could not change tabs.";
  }
});

open.addEventListener("click", async () => {
  status.textContent = "";
  status.classList.remove("saved");
  try {
    const tab = await activeTab();
    if (!tab?.id) throw new Error("No active tab was found.");
    if (!enabled.checked) {
      const response = await chrome.runtime.sendMessage({ type: "LIVELAYER_SET_ACTIVE_TAB", tabId: tab.id, active: true });
      if (!response?.ok) throw new Error(response?.error || "LiveLayer could not enable this tab.");
      enabled.checked = true;
    }
    await send({ type: "LIVELAYER_OPEN_CONTROLS" });
    window.close();
  } catch (error) {
    status.textContent = error.message;
  }
});

load();
