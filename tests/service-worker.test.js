import test from "node:test";
import assert from "node:assert/strict";

test("only one tab is active and the previous tab is disabled", async () => {
  const local = {};
  const session = {};
  const tabMessages = [];
  let messageListener;

  const storageArea = (store) => ({
    async get(key) {
      if (typeof key === "string") return { [key]: store[key] };
      return { ...store };
    },
    async set(values) { Object.assign(store, values); },
    async remove(key) { delete store[key]; }
  });

  globalThis.chrome = {
    storage: { local: storageArea(local), session: storageArea(session) },
    runtime: {
      onInstalled: { addListener() {} },
      onMessage: { addListener(listener) { messageListener = listener; } }
    },
    tabs: {
      async sendMessage(tabId, message) { tabMessages.push({ tabId, message }); },
      async create() {},
      async query() { return []; }
    },
    commands: { onCommand: { addListener() {} } }
  };

  await import(`../service-worker.js?test=${Date.now()}`);
  assert.equal(typeof messageListener, "function");

  const send = (message, sender = {}) => new Promise((resolve, reject) => {
    try {
      const asyncResponse = messageListener(message, sender, resolve);
      if (asyncResponse !== true) resolve(undefined);
    } catch (error) {
      reject(error);
    }
  });

  assert.deepEqual(await send({ type: "LIVELAYER_GET_TAB_STATUS" }, { tab: { id: 11 } }), { ok: true, active: false });
  assert.equal((await send({ type: "LIVELAYER_SET_ACTIVE_TAB", tabId: 11, active: true })).active, true);
  assert.deepEqual(await send({ type: "LIVELAYER_GET_TAB_STATUS" }, { tab: { id: 11 } }), { ok: true, active: true });
  assert.equal((await send({ type: "LIVELAYER_SET_ACTIVE_TAB", tabId: 22, active: true })).activeTabId, 22);
  assert.deepEqual(tabMessages.slice(-2), [
    { tabId: 11, message: { type: "LIVELAYER_TAB_ACTIVE", active: false } },
    { tabId: 22, message: { type: "LIVELAYER_TAB_ACTIVE", active: true } }
  ]);
  assert.equal((await send({ type: "LIVELAYER_SET_ACTIVE_TAB", tabId: 22, active: false })).active, false);
  assert.equal(session.livelayerActiveTabId, undefined);

  delete globalThis.chrome;
});

test("falls back from a Kalshi market link to a nested sports event", async () => {
  let messageListener;
  const requested = [];
  globalThis.chrome = {
    storage: {
      local: { async get() { return {}; }, async set() {}, async remove() {} },
      session: { async get() { return {}; }, async set() {}, async remove() {} }
    },
    runtime: {
      onInstalled: { addListener() {} },
      onMessage: { addListener(listener) { messageListener = listener; } }
    },
    tabs: { async sendMessage() {}, async create() {}, async query() { return []; } },
    commands: { onCommand: { addListener() {} } }
  };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    requested.push(String(url));
    if (String(url).includes("/markets/")) return { ok: false, status: 404, async json() { return {}; } };
    return {
      ok: true,
      status: 200,
      async json() {
        return { event: { event_ticker: "KXGAME-26SEP22", title: "Miami vs. Las Vegas", markets: [
          { ticker: "KXGAME-26SEP22-MIA", title: "Miami to win", status: "open", yes_bid_dollars: "0.5100", yes_ask_dollars: "0.5300" }
        ] } };
      }
    };
  };

  await import(`../service-worker.js?event-test=${Date.now()}`);
  const response = await new Promise((resolve) => {
    messageListener({ type: "LIVELAYER_FETCH_WIDGET", widget: { type: "kalshi", sourceInput: "KXGAME-26SEP22", sourceMeta: {} } }, {}, resolve);
  });
  assert.equal(response.ok, true);
  assert.equal(response.data.kind, "event");
  assert.equal(response.data.markets[0].yesPercent, 52);
  assert.match(requested[0], /\/markets\/KXGAME-26SEP22$/);
  assert.match(requested[1], /\/events\/KXGAME-26SEP22\?with_nested_markets=true$/);

  globalThis.fetch = originalFetch;
  delete globalThis.chrome;
});

test("matches a saved Kalshi portfolio link after Kalshi redirects to a portfolio subpage", async () => {
  const local = {};
  let messageListener;
  const storageArea = (store) => ({
    async get(key) { return typeof key === "string" ? { [key]: store[key] } : { ...store }; },
    async set(values) { Object.assign(store, values); },
    async remove(key) { delete store[key]; }
  });
  globalThis.chrome = {
    storage: { local: storageArea(local), session: storageArea({}) },
    runtime: {
      onInstalled: { addListener() {} },
      onMessage: { addListener(listener) { messageListener = listener; } }
    },
    tabs: { async sendMessage() {}, async create() {}, async query() { return []; } },
    commands: { onCommand: { addListener() {} } }
  };
  await import(`../service-worker.js?portfolio-test=${Date.now()}`);
  const send = (message) => new Promise((resolve) => messageListener(message, {}, resolve));
  await send({ type: "LIVELAYER_PUBLISH_KALSHI_SNAPSHOT", snapshot: {
    url: "https://kalshi.com/portfolio/positions",
    title: "Portfolio",
    authenticated: true,
    items: [{ key: "love", title: "Jordan Love 200+ passing yards", text: "Jordan Love 200+ passing yards" }],
    capturedAt: Date.now()
  } });
  const response = await send({ type: "LIVELAYER_FETCH_WIDGET", widget: {
    type: "kalshiAccount",
    sourceInput: "https://kalshi.com/portfolio",
    sourceMeta: {}
  } });
  assert.equal(response.ok, true);
  assert.equal(response.data.connected, true);
  assert.equal(response.data.items[0].key, "love");
  delete globalThis.chrome;
});
