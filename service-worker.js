import {
  espnApiUrl,
  kalshiApiUrl,
  kalshiEventApiUrl,
  normalizeEspnScoreboard,
  normalizeEspnSummary,
  normalizeKalshiMarket,
  normalizeKalshiEvent,
  parseEspnInput,
  parseKalshiAccountPage,
  parseKalshiTicker
} from "./lib/sources.js";

const STORAGE_KEY = "livelayerState";
const KALSHI_SNAPSHOTS_KEY = "livelayerKalshiSnapshots";
const ACTIVE_TAB_KEY = "livelayerActiveTabId";
const DEFAULT_STATE = {
  enabled: true,
  controlsVisible: true,
  sources: [],
  widgets: [],
  layouts: [],
  activeLayoutId: "",
  settings: {
    accentColor: "#62d9ff",
    textColor: "#ffffff",
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
    backgroundOpacity: 0,
    gridOpacity: 0.1,
    numberStyle: { mode: "inherit", solidColor: "#ffffff", farColor: "#ff4d5e", nearColor: "#ffd54a", reachedColor: "#42df82" }
  },
  ui: { selectedSourceId: "all" }
};

async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
      headers: { Accept: "application/json" }
    });
    if (!response.ok) throw new Error(`Source returned HTTP ${response.status}.`);
    return await response.json();
  } catch (error) {
    if (error?.name === "AbortError") throw new Error("The live source timed out.");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchEspn(widget) {
  const source = parseEspnInput(widget.sourceInput, widget.sourceMeta || {});
  const data = await fetchJson(espnApiUrl(source));
  return source.eventId
    ? normalizeEspnSummary(data, source)
    : normalizeEspnScoreboard(data, source);
}

async function fetchKalshi(widget) {
  const ticker = widget.sourceMeta?.ticker || widget.sourceMeta?.eventTicker || parseKalshiTicker(widget.sourceInput);
  if (!widget.sourceMeta?.eventTicker) {
    try {
      const data = await fetchJson(kalshiApiUrl(ticker));
      return normalizeKalshiMarket(data, ticker);
    } catch (marketError) {
      try {
        const eventData = await fetchJson(kalshiEventApiUrl(ticker));
        return normalizeKalshiEvent(eventData, ticker);
      } catch {
        throw marketError;
      }
    }
  }
  const eventData = await fetchJson(kalshiEventApiUrl(ticker));
  return normalizeKalshiEvent(eventData, ticker);
}

function sameKalshiPath(left, right) {
  try {
    const a = new URL(left);
    const b = new URL(right);
    return a.origin === b.origin && a.pathname.replace(/\/$/, "") === b.pathname.replace(/\/$/, "");
  } catch {
    return false;
  }
}

function sameKalshiAccountScope(left, right) {
  try {
    const a = new URL(left);
    const b = new URL(right);
    const accountPath = /(portfolio|position|order|history|activity|fill|document|account|trade)/i;
    return a.origin === b.origin && accountPath.test(`${a.pathname} ${a.search}`) && accountPath.test(`${b.pathname} ${b.search}`);
  } catch {
    return false;
  }
}

async function saveKalshiSnapshot(snapshot) {
  const parsed = parseKalshiAccountPage(snapshot?.url);
  const stored = await chrome.storage.local.get(KALSHI_SNAPSHOTS_KEY);
  const snapshots = stored[KALSHI_SNAPSHOTS_KEY] || {};
  snapshots[parsed.pageKey] = {
    ...snapshot,
    url: parsed.url,
    pageKey: parsed.pageKey,
    capturedAt: Number(snapshot.capturedAt) || Date.now()
  };
  const trimmed = Object.fromEntries(Object.entries(snapshots)
    .sort((a, b) => Number(b[1]?.capturedAt || 0) - Number(a[1]?.capturedAt || 0))
    .slice(0, 12));
  await chrome.storage.local.set({ [KALSHI_SNAPSHOTS_KEY]: trimmed });
  return trimmed[parsed.pageKey];
}

async function fetchKalshiAccount(widget) {
  const source = parseKalshiAccountPage(widget.sourceInput);
  const stored = await chrome.storage.local.get(KALSHI_SNAPSHOTS_KEY);
  const snapshots = Object.values(stored[KALSHI_SNAPSHOTS_KEY] || {});
  const snapshot = snapshots
    .filter((item) => item?.pageKey === source.pageKey || sameKalshiPath(item?.url, source.url) || sameKalshiAccountScope(item?.url, source.url))
    .sort((a, b) => Number(b.capturedAt || 0) - Number(a.capturedAt || 0))[0];

  if (!snapshot) {
    return {
      kind: "account",
      connected: false,
      source,
      title: "Kalshi account page not connected",
      summary: [],
      rows: [],
      capturedAt: 0
    };
  }
  return { kind: "account", connected: true, source, ...snapshot };
}

async function activeOverlayTabId() {
  const stored = await chrome.storage.session.get(ACTIVE_TAB_KEY);
  return Number(stored[ACTIVE_TAB_KEY]) || 0;
}

async function notifyTab(tabId, active) {
  if (!tabId) return;
  try {
    await chrome.tabs.sendMessage(tabId, { type: "LIVELAYER_TAB_ACTIVE", active });
  } catch {
    // The tab may be loading or may not accept content scripts.
  }
}

async function setActiveOverlayTab(tabId, active) {
  const previousTabId = await activeOverlayTabId();
  if (!active) {
    if (previousTabId === tabId) {
      await chrome.storage.session.remove(ACTIVE_TAB_KEY);
      await notifyTab(tabId, false);
    }
    return 0;
  }
  if (previousTabId && previousTabId !== tabId) await notifyTab(previousTabId, false);
  await chrome.storage.session.set({ [ACTIVE_TAB_KEY]: tabId });
  await notifyTab(tabId, true);
  return tabId;
}

chrome.runtime.onInstalled.addListener(async () => {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  if (!stored[STORAGE_KEY]) await chrome.storage.local.set({ [STORAGE_KEY]: DEFAULT_STATE });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "LIVELAYER_GET_TAB_STATUS") {
    (async () => {
      const activeTabId = await activeOverlayTabId();
      sendResponse({ ok: true, active: Boolean(_sender.tab?.id && _sender.tab.id === activeTabId) });
    })();
    return true;
  }

  if (message?.type === "LIVELAYER_GET_ACTIVE_TAB") {
    (async () => {
      const activeTabId = await activeOverlayTabId();
      sendResponse({ ok: true, active: Number(message.tabId) === activeTabId, activeTabId });
    })();
    return true;
  }

  if (message?.type === "LIVELAYER_SET_ACTIVE_TAB") {
    (async () => {
      const tabId = Number(message.tabId);
      if (!Number.isInteger(tabId) || tabId <= 0) {
        sendResponse({ ok: false, error: "No valid browser tab was supplied." });
        return;
      }
      const activeTabId = await setActiveOverlayTab(tabId, Boolean(message.active));
      sendResponse({ ok: true, active: activeTabId === tabId, activeTabId });
    })();
    return true;
  }

  if (message?.type === "LIVELAYER_PUBLISH_KALSHI_SNAPSHOT") {
    (async () => {
      try {
        const snapshot = await saveKalshiSnapshot(message.snapshot || {});
        sendResponse({ ok: true, snapshot });
      } catch (error) {
        sendResponse({ ok: false, error: error?.message || "The Kalshi page could not be synced." });
      }
    })();
    return true;
  }

  if (message?.type === "LIVELAYER_OPEN_KALSHI_PAGE") {
    (async () => {
      try {
        const source = parseKalshiAccountPage(message.url);
        await chrome.tabs.create({ url: source.url });
        sendResponse({ ok: true });
      } catch (error) {
        sendResponse({ ok: false, error: error?.message || "The Kalshi page could not be opened." });
      }
    })();
    return true;
  }

  if (message?.type !== "LIVELAYER_FETCH_WIDGET") return false;

  (async () => {
    try {
      const widget = message.widget || {};
      const data = widget.type === "espn"
        ? await fetchEspn(widget)
        : widget.type === "kalshi"
          ? await fetchKalshi(widget)
          : widget.type === "kalshiAccount"
            ? await fetchKalshiAccount(widget)
          : null;
      sendResponse({ ok: true, data });
    } catch (error) {
      sendResponse({ ok: false, error: error?.message || "The live source could not be loaded." });
    }
  })();
  return true;
});

async function messageActiveTab(message) {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tabs[0]?.id) return;
  if (tabs[0].id !== await activeOverlayTabId()) return;
  try {
    await chrome.tabs.sendMessage(tabs[0].id, message);
  } catch {
    // Browser settings pages do not accept content scripts.
  }
}

chrome.commands.onCommand.addListener(async (command) => {
  if (command === "toggle-overlay") await messageActiveTab({ type: "LIVELAYER_TOGGLE" });
  if (command === "open-controls") await messageActiveTab({ type: "LIVELAYER_OPEN_CONTROLS" });
});
