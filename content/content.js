(() => {
  if (window.__liveLayerSportsOverlay) return;
  window.__liveLayerSportsOverlay = true;

  const STORAGE_KEY = "livelayerState";
  const DEFAULT_NUMBER_STYLE = { mode: "inherit", solidColor: "#ffffff", farColor: "#ff4d5e", nearColor: "#ffd54a", reachedColor: "#42df82" };
  const DEFAULT_SETTINGS = { accentColor: "#62d9ff", textColor: "#ffffff", fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif", backgroundOpacity: 0, gridOpacity: 0.1, numberStyle: DEFAULT_NUMBER_STYLE };
  const DEFAULT_STATE = { enabled: true, controlsVisible: true, sources: [], widgets: [], layouts: [], activeLayoutId: "", settings: DEFAULT_SETTINGS, ui: { selectedSourceId: "all" } };
  const { conditionalColor, findOpenPlacement, inferPlayerProp, numberFromText, progressInfo, rectsOverlap, toPercentPosition } = globalThis.LiveLayerWidgetUtils;
  const ARRANGE_GAP = 0;
  const ARRANGE_GRID_SIZE = 32;
  const PRESETS = {
    espn: [
      { key: "scoreboard", group: "Score", label: "Scoreboard", fields: ["score"] },
      { key: "clock", group: "Score", label: "Clock and status", fields: ["status"] },
      { key: "records", group: "Score", label: "Team records", fields: ["records"] },
      { key: "situation", group: "Live game", label: "Current drive", fields: ["situation"] },
      { key: "last-play", group: "Live game", label: "Last play", fields: ["lastPlay"] },
      { key: "win-probability", group: "Live game", label: "Win probability", fields: ["winProbability"] },
      { key: "passing-yards", group: "Team stats", label: "Passing yards", fields: ["teamStat:netPassingYards"] },
      { key: "rushing-yards", group: "Team stats", label: "Rushing yards", fields: ["teamStat:rushingYards"] },
      { key: "total-yards", group: "Team stats", label: "Total yards", fields: ["teamStat:totalYards"] },
      { key: "first-downs", group: "Team stats", label: "First downs", fields: ["teamStat:firstDowns"] },
      { key: "turnovers", group: "Team stats", label: "Turnovers", fields: ["teamStat:turnovers"] },
      { key: "sacks", group: "Team stats", label: "Sacks", fields: ["teamStat:sacksYardsLost"] },
      { key: "third-downs", group: "Team stats", label: "Third-down efficiency", fields: ["teamStat:thirdDownEff"] },
      { key: "possession", group: "Team stats", label: "Time of possession", fields: ["teamStat:possessionTime"] },
      { key: "penalties", group: "Team stats", label: "Penalties", fields: ["teamStat:totalPenaltiesYards"] },
      { key: "passing-leader", group: "Player stats", label: "Passing leader", fields: ["playerCategory:passing"] },
      { key: "rushing-leader", group: "Player stats", label: "Rushing leader", fields: ["playerCategory:rushing"] },
      { key: "receiving-leader", group: "Player stats", label: "Receiving leader", fields: ["playerCategory:receiving"] },
      { key: "defensive-leader", group: "Player stats", label: "Defensive leader", fields: ["playerCategory:defensive"] },
      { key: "all-leaders", group: "Player stats", label: "All leaders", fields: ["leaders"] },
      { key: "venue", group: "Details", label: "Venue", fields: ["venue"] },
      { key: "updated", group: "Details", label: "Update time", fields: ["updated"] }
    ],
    kalshi: [
      { key: "probability", group: "Market", label: "YES / NO price", fields: ["probability"] },
      { key: "spread", group: "Market", label: "Bid and ask", fields: ["spread"] },
      { key: "chart", group: "Market", label: "Live price chart", fields: ["chart"], visualStyle: "marketChart", blockSize: "wide" },
      { key: "bet", group: "My position", label: "My manual bet", fields: ["bet"] },
      { key: "volume", group: "Market", label: "Volume and interest", fields: ["volume"] },
      { key: "status", group: "Market", label: "Market status", fields: ["status"] },
      { key: "updated", group: "Market", label: "Update time", fields: ["updated"] }
    ],
    kalshiAccount: [
      { key: "summary", group: "Account", label: "Portfolio summary", fields: ["summary"] },
      { key: "connection", group: "Account", label: "Connection status", fields: ["updated"] }
    ]
  };

  let state = structuredClone(DEFAULT_STATE);
  let editMode = false;
  let arrangeFocusId = "";
  let panelOpen = false;
  let panelPage = "widgets";
  let activeForTab = false;
  let panelPresetSignature = "";
  let editor = null;
  let editorSaveTimer = 0;
  let sourceEditor = null;
  let liveLayerFullscreenTarget = null;
  let liveLayerFullscreenStyles = null;
  let liveLayerFullscreenMedia = null;
  let liveLayerFullscreenMediaStyles = null;
  const live = new Map();
  const sourceLive = new Map();
  const sourceRequests = new Map();
  const displayedNumbers = new Map();

  const host = document.createElement("div");
  host.id = "livelayer-extension-host";
  host.setAttribute("popover", "manual");
  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = `
    :host { all: initial; position: fixed; inset: 0; width: 100vw; height: 100vh; border: 0; margin: 0; padding: 0; overflow: visible; background: transparent; pointer-events: none; }
    :host::backdrop { background: transparent; pointer-events: none; }
    *, *::before, *::after { box-sizing: border-box; }
    #ll-stage { position: fixed; inset: 0; z-index: 2147483646; pointer-events: none; color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; --ll-app-accent: #62d9ff; --ll-grid-opacity: .1; }
    #ll-stage.arranging::before { content: ""; position: absolute; inset: 0; pointer-events: none; opacity: var(--ll-grid-opacity); background-image: linear-gradient(color-mix(in srgb, var(--ll-app-accent) 75%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--ll-app-accent) 75%, transparent) 1px, transparent 1px); background-size: ${ARRANGE_GRID_SIZE}px ${ARRANGE_GRID_SIZE}px; }
    #ll-widgets { position: absolute; inset: 0; pointer-events: none; }
    .ll-widget { position: absolute; min-width: 120px; max-width: 92vw; padding: 10px 12px; border: 1px solid transparent; border-radius: 10px; color: #fff; white-space: normal; line-height: 1.2; overflow-wrap: anywhere; overflow: hidden; user-select: none; pointer-events: none; transition: border-color .15s, box-shadow .15s, width .16s, height .16s; }
    .ll-widget-body { height: 100%; opacity: var(--ll-text-opacity, 1); }
    .ll-style-card { background: rgba(9,15,22,.88) !important; border-color: rgba(255,255,255,.16); border-radius: 14px; backdrop-filter: blur(10px); box-shadow: 0 12px 34px rgba(0,0,0,.32); }
    .ll-style-square { background: rgba(9,15,22,.9) !important; border-color: color-mix(in srgb, var(--ll-accent) 30%, transparent); border-radius: 14px; }
    .ll-style-square .ll-widget-body { display: grid; align-content: center; }
    .ll-style-scorebug { background: rgba(6,10,15,.94) !important; border: 1px solid rgba(255,255,255,.2); border-left: 5px solid var(--ll-accent); border-radius: 4px; }
    .ll-style-block { background: rgba(8,13,19,.92) !important; border-color: rgba(255,255,255,.13); border-radius: 2px; }
    .ll-style-marketChart { background: linear-gradient(160deg, rgba(7,16,20,.97), rgba(6,10,17,.95)) !important; border-color: color-mix(in srgb, var(--ll-chart-color, #42df82) 45%, transparent); border-radius: 10px; box-shadow: 0 12px 36px rgba(0,0,0,.38); }
    .ll-widget.arrange { pointer-events: auto; cursor: move; border-color: var(--ll-app-accent); box-shadow: 0 0 0 2px color-mix(in srgb, var(--ll-app-accent) 24%, transparent); }
    .ll-widget.arrange-focus { border-color: var(--ll-accent, #62d9ff); box-shadow: 0 0 0 3px color-mix(in srgb, var(--ll-accent, #62d9ff) 34%, transparent), 0 9px 30px rgba(0,0,0,.3); }
    .ll-widget.dragging { opacity: .86; }
    .ll-widget-tools { display: none; position: absolute; right: -13px; top: -14px; gap: 5px; z-index: 2; }
    .ll-widget.arrange .ll-widget-tools { display: flex; }
    .ll-resize-width, .ll-resize-height, .ll-resize-scale { display: none; position: absolute; background: var(--ll-app-accent); border: 2px solid #07131a; box-shadow: 0 2px 8px rgba(0,0,0,.45); pointer-events: auto; }
    .ll-widget.arrange .ll-resize-width, .ll-widget.arrange .ll-resize-height, .ll-widget.arrange .ll-resize-scale { display: block; }
    .ll-resize-width { right: -6px; top: 35%; width: 10px; height: 30%; min-height: 22px; border-radius: 7px; cursor: ew-resize; }
    .ll-resize-height { left: 35%; bottom: -6px; width: 30%; min-width: 22px; height: 10px; border-radius: 7px; cursor: ns-resize; }
    .ll-resize-scale { right: -7px; bottom: -7px; width: 14px; height: 14px; border-radius: 4px; cursor: nwse-resize; }
    .ll-tool-button { width: 26px; height: 26px; border: 1px solid rgba(255,255,255,.18); border-radius: 7px; background: #141a21; color: #fff; cursor: pointer; font: 700 13px/1 system-ui, sans-serif; display: grid; place-items: center; box-shadow: 0 5px 18px rgba(0,0,0,.28); }
    .ll-kicker { font-size: .66em; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; margin-bottom: 5px; }
    .ll-score-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 18px; align-items: baseline; font-weight: 850; }
    .ll-score-row + .ll-score-row { margin-top: 2px; }
    .ll-score-team { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .ll-score-value { font-size: 1.42em; font-variant-numeric: tabular-nums; }
    .ll-possession { color: var(--ll-app-accent); margin-right: 5px; }
    .ll-primary { font-size: 1.75em; font-weight: 900; line-height: 1; font-variant-numeric: tabular-nums; margin: 4px 0 6px; }
    .ll-subline { font-size: .74em; font-weight: 650; margin-top: 4px; }
    .ll-detail { font-size: .7em; margin-top: 5px; }
    .ll-leaders { display: grid; gap: 5px; margin-top: 7px; }
    .ll-leader { font-size: .64em; }
    .ll-broadcast-card { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px; align-items: start; }
    .ll-broadcast-title { font-size: .88em; font-weight: 850; line-height: 1.08; }
    .ll-broadcast-value { text-align: right; font-size: 1.8em; font-weight: 950; line-height: .9; font-variant-numeric: tabular-nums; }
    .ll-broadcast-target { font-size: .42em; font-weight: 700; opacity: .72; margin-left: 2px; }
    .ll-broadcast-unit { display: block; margin-top: 4px; font-size: .34em; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; opacity: .78; }
    .ll-progress-wrap { grid-column: 1 / -1; margin-top: 7px; }
    .ll-progress { height: 7px; overflow: hidden; border-radius: 999px; background: rgba(255,255,255,.18); }
    .ll-progress > i { display: block; height: 100%; width: var(--ll-progress, 0%); border-radius: inherit; background: var(--ll-accent, var(--ll-app-accent)); opacity: .72; transition: width .22s ease; }
    .ll-progress.complete > i { opacity: 1; box-shadow: 0 0 10px var(--ll-accent, #62d9ff); }
    .ll-progress-label { margin-top: 4px; font-size: .54em; font-weight: 750; opacity: .76; font-variant-numeric: tabular-nums; }
    .ll-dynamic-number { transition: color .18s ease; }
    .ll-market-head { display: flex; align-items: start; justify-content: space-between; gap: 10px; }
    .ll-market-price { font-size: 1.6em; line-height: 1; font-weight: 950; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .ll-market-chart { display: block; width: 100%; height: 82px; margin-top: 8px; overflow: visible; }
    .ll-market-chart-grid { stroke: rgba(255,255,255,.11); stroke-width: 1; vector-effect: non-scaling-stroke; }
    .ll-market-chart-line { fill: none; stroke: var(--ll-chart-color, #42df82); stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; vector-effect: non-scaling-stroke; }
    .ll-market-change { margin-top: 3px; color: var(--ll-chart-color, #42df82); font-size: .62em; font-weight: 850; }
    .ll-stat-pair { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 4px; }
    .ll-stat-block { min-width: 0; }
    .ll-stat-team { font-size: .62em; font-weight: 800; opacity: .74; }
    .ll-stat-number { font-size: 1.45em; font-weight: 950; font-variant-numeric: tabular-nums; }
    .ll-table-row { display: grid; gap: 4px; margin-top: 5px; }
    .ll-table-cell { display: grid; grid-template-columns: minmax(0, .8fr) minmax(0, 1.2fr); gap: 8px; font-size: .64em; }
    .ll-table-cell b { opacity: .64; }
    .ll-error { color: #ffd0d0; font-weight: 700; font-size: .72em; }
    .ll-loading { opacity: .72; font-size: .72em; }
    #ll-gear { position: absolute; right: 18px; bottom: 18px; width: 44px; height: 44px; border: 1px solid rgba(255,255,255,.22); border-radius: 13px; background: rgba(10,15,22,.88); color: var(--ll-app-accent); cursor: pointer; pointer-events: auto; display: grid; place-items: center; box-shadow: 0 10px 28px rgba(0,0,0,.36); backdrop-filter: blur(10px); font: 900 15px/1 system-ui, sans-serif; letter-spacing: -.05em; }
    #ll-gear:hover { background: rgba(17,28,38,.96); transform: translateY(-1px); }
    #ll-panel { position: absolute; right: 18px; bottom: 72px; width: min(470px, calc(100vw - 28px)); max-height: min(780px, calc(100vh - 92px)); overflow: auto; pointer-events: auto; background: rgba(12,16,22,.97); color: #f7f9fc; border: 1px solid rgba(255,255,255,.13); border-radius: 16px; box-shadow: 0 22px 70px rgba(0,0,0,.52); backdrop-filter: blur(16px); font-size: 14px; line-height: 1.35; }
    .ll-panel-head { position: sticky; top: 0; z-index: 2; display: flex; justify-content: space-between; align-items: center; padding: 14px 15px; background: rgba(12,16,22,.97); border-bottom: 1px solid rgba(255,255,255,.09); }
    .ll-brand { font-size: 17px; font-weight: 900; letter-spacing: -.02em; }
    .ll-brand span { color: var(--ll-app-accent); }
    .ll-head-actions { display: flex; gap: 7px; }
    .ll-panel-body { padding: 14px; }
    .ll-page-title { font-size: 16px; font-weight: 900; margin-bottom: 3px; }
    .ll-page-subtitle { color: #91a0ad; font-size: 11px; margin-bottom: 13px; }
    .ll-row { display: flex; gap: 8px; align-items: center; }
    .ll-space { justify-content: space-between; }
    .ll-source-nav { display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 8px; align-items: end; margin: 10px 0 4px; }
    .ll-add-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 7px; margin: 12px 0 15px; }
    button.ll-button { appearance: none; border: 1px solid rgba(255,255,255,.13); background: #202833; color: #f7f9fc; border-radius: 9px; padding: 8px 10px; font: 750 12px/1.15 system-ui, sans-serif; cursor: pointer; }
    button.ll-button:hover { background: #2b3542; }
    button.ll-button.primary { background: var(--ll-app-accent); border-color: var(--ll-app-accent); color: #04131a; }
    button.ll-button.primary:hover { filter: brightness(1.12); }
    button.ll-button.danger { color: #ffb8b8; }
    button.ll-button.active { color: #071015; background: var(--ll-app-accent); border-color: var(--ll-app-accent); }
    button.ll-icon { width: 30px; height: 30px; padding: 0; display: grid; place-items: center; }
    .ll-section-title { font-size: 11px; font-weight: 850; text-transform: uppercase; letter-spacing: .12em; color: #9aabba; margin: 13px 0 7px; }
    .ll-empty { padding: 17px 12px; border: 1px dashed rgba(255,255,255,.16); border-radius: 10px; color: #99a8b6; text-align: center; font-size: 12px; }
    .ll-widget-list { display: grid; gap: 7px; }
    .ll-widget-card { display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 10px; padding: 10px; background: rgba(255,255,255,.045); border: 1px solid rgba(255,255,255,.08); border-radius: 10px; }
    .ll-widget-name { font-size: 13px; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .ll-widget-meta { color: #95a4b2; font-size: 11px; margin-top: 2px; }
    .ll-card-actions { display: flex; gap: 5px; }
    .ll-source-list { display: grid; gap: 7px; margin-bottom: 10px; }
    .ll-source-card { display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 10px; align-items: center; padding: 10px; background: rgba(255,255,255,.045); border: 1px solid rgba(255,255,255,.09); border-radius: 10px; }
    .ll-layout-list { display: grid; gap: 8px; margin-top: 12px; }
    .ll-layout-card { display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 9px; align-items: center; padding: 10px; background: rgba(255,255,255,.045); border: 1px solid rgba(255,255,255,.09); border-radius: 10px; }
    .ll-layout-card.active { border-color: color-mix(in srgb, var(--ll-app-accent) 70%, transparent); }
    .ll-source-box { display: grid; gap: 8px; margin-bottom: 13px; padding: 12px; background: rgba(255,255,255,.035); border: 1px solid rgba(255,255,255,.09); border-radius: 11px; }
    .ll-source-box-title { font-size: 12px; font-weight: 900; }
    .ll-source-type { color: var(--ll-app-accent); font-size: 9px; font-weight: 900; letter-spacing: .11em; text-transform: uppercase; }
    .ll-source-name { font-weight: 800; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .ll-preset-source { margin-top: 12px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,.08); }
    .ll-preset-head { display: flex; justify-content: space-between; gap: 8px; align-items: center; margin-bottom: 7px; }
    .ll-preset-title { font-size: 12px; font-weight: 850; }
    .ll-preset-group { margin: 9px 0 5px; color: #8fa0af; font-size: 9px; font-weight: 900; letter-spacing: .11em; text-transform: uppercase; }
    .ll-preset-grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 7px; }
    .ll-preset-card { position: relative; min-height: 50px; border: 1px solid rgba(255,255,255,.1); border-radius: 10px; background: #151c24; overflow: hidden; }
    .ll-preset-card.active { border-color: color-mix(in srgb, var(--ll-app-accent) 72%, transparent); background: color-mix(in srgb, var(--ll-app-accent) 22%, transparent); }
    .ll-preset-main { width: 100%; min-height: 50px; padding: 10px 36px 10px 10px; border: 0; background: transparent; color: #d8e2e9; text-align: left; font: 760 11px/1.2 system-ui, sans-serif; cursor: pointer; }
    .ll-preset-card.active .ll-preset-main { color: #eafeff; }
    .ll-preset-gear { position: absolute; top: 7px; right: 7px; width: 26px; height: 26px; border: 1px solid rgba(255,255,255,.13); border-radius: 7px; background: #25303b; color: #ccebf4; cursor: pointer; font: 700 13px/1 system-ui, sans-serif; }
    .ll-preset-status { display: block; margin-top: 4px; color: #7f909e; font-size: 9px; font-weight: 650; }
    .ll-preset-card.active .ll-preset-status { color: var(--ll-app-accent); }
    .ll-form { display: grid; gap: 11px; }
    .ll-field { display: grid; gap: 5px; }
    .ll-field > label, .ll-label { font-size: 11px; color: #aebbc7; font-weight: 750; }
    input.ll-input, select.ll-input, textarea.ll-input { width: 100%; border: 1px solid rgba(255,255,255,.14); border-radius: 8px; background: #10161d; color: #f6f9fb; padding: 9px 10px; font: 500 13px/1.3 system-ui, sans-serif; outline: none; }
    input.ll-input:focus, select.ll-input:focus, textarea.ll-input:focus { border-color: var(--ll-app-accent); box-shadow: 0 0 0 2px color-mix(in srgb, var(--ll-app-accent) 14%, transparent); }
    textarea.ll-input { resize: vertical; min-height: 76px; }
    textarea.ll-code { min-height: 96px; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 11px; }
    input[type="range"] { width: 100%; accent-color: var(--ll-app-accent); }
    input[type="color"] { width: 42px; height: 34px; border: 0; padding: 0; background: transparent; }
    .ll-checks { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 8px; }
    .ll-color-grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 8px; }
    .ll-color-field { display: flex; align-items: center; justify-content: space-between; gap: 7px; padding: 7px 8px; border: 1px solid rgba(255,255,255,.09); border-radius: 8px; color: #aebbc7; font-size: 10px; font-weight: 750; }
    .ll-check { display: flex; gap: 7px; align-items: flex-start; font-size: 11px; color: #d6dee5; }
    .ll-check input { margin: 1px 0 0; accent-color: var(--ll-app-accent); }
    .ll-preview { padding: 9px 10px; background: color-mix(in srgb, var(--ll-app-accent) 8%, transparent); border: 1px solid color-mix(in srgb, var(--ll-app-accent) 18%, transparent); border-radius: 8px; font-size: 11px; color: color-mix(in srgb, var(--ll-app-accent) 55%, white); }
    .ll-preview.error { background: rgba(255,86,86,.08); border-color: rgba(255,86,86,.22); color: #ffcaca; }
    .ll-note { color: #8f9eac; font-size: 11px; }
    .ll-divider { height: 1px; background: rgba(255,255,255,.08); margin: 4px 0; }
    .ll-toggle { display: flex; gap: 7px; align-items: center; color: #ccd6df; font-size: 12px; }
    .ll-toggle input { accent-color: var(--ll-app-accent); }
    @media (max-width: 560px) { #ll-panel { right: 8px; bottom: 62px; max-height: calc(100vh - 74px); } #ll-gear { right: 8px; bottom: 8px; } .ll-checks { grid-template-columns: 1fr; } }
  `;
  shadow.append(style);

  const stage = document.createElement("div");
  stage.id = "ll-stage";
  stage.style.display = "none";
  stage.innerHTML = `<div id="ll-widgets"></div><button id="ll-gear" title="LiveLayer controls" aria-label="Open LiveLayer controls">LL</button>`;
  shadow.append(stage);
  const widgetsRoot = stage.querySelector("#ll-widgets");
  const gear = stage.querySelector("#ll-gear");

  function mount() {
    if (host.parentNode !== document.documentElement) document.documentElement.append(host);
    requestAnimationFrame(() => {
      try {
        if (host.matches(":popover-open")) host.hidePopover();
        host.showPopover();
      } catch {
        const target = document.fullscreenElement || document.documentElement;
        if (host.parentNode !== target) target.append(host);
      }
    });
  }

  function unmount() {
    try { if (host.matches(":popover-open")) host.hidePopover(); } catch { /* Popover is optional. */ }
    host.remove();
  }

  function mediaCandidates() {
    return [...document.querySelectorAll("video, iframe")].filter((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width >= 240 && rect.height >= 130 && style.display !== "none" && style.visibility !== "hidden";
    });
  }

  function largestMediaElement() {
    return mediaCandidates().sort((left, right) => {
      const leftRect = left.getBoundingClientRect();
      const rightRect = right.getBoundingClientRect();
      const leftPlaying = left.tagName === "VIDEO" && !left.paused ? 2 : 1;
      const rightPlaying = right.tagName === "VIDEO" && !right.paused ? 2 : 1;
      return rightRect.width * rightRect.height * rightPlaying - leftRect.width * leftRect.height * leftPlaying;
    })[0] || null;
  }

  function likelyPlayerContainer(media) {
    const mediaRect = media.getBoundingClientRect();
    const mediaArea = Math.max(1, mediaRect.width * mediaRect.height);
    let candidate = media;
    let current = media.parentElement;
    for (let depth = 0; current && depth < 6 && current !== document.body && current !== document.documentElement; depth += 1) {
      const rect = current.getBoundingClientRect();
      const area = rect.width * rect.height;
      const closeSize = rect.width <= mediaRect.width * 1.35 && rect.height <= mediaRect.height * 1.55;
      if (area >= mediaArea && area <= mediaArea * 2.7 && closeSize) candidate = current;
      current = current.parentElement;
    }
    return candidate;
  }

  const FULLSCREEN_STYLE_PROPERTIES = ["position", "inset", "top", "right", "bottom", "left", "width", "height", "max-width", "max-height", "z-index", "margin", "transform", "background", "object-fit"];

  function saveInlineStyles(element) {
    return FULLSCREEN_STYLE_PROPERTIES.map((property) => ({
      property,
      value: element.style.getPropertyValue(property),
      priority: element.style.getPropertyPriority(property)
    }));
  }

  function restoreLiveLayerFullscreenTarget() {
    const restoreStyles = (element, styles) => {
      if (!element || !styles) return;
      for (const item of styles) {
        if (item.value) element.style.setProperty(item.property, item.value, item.priority);
        else element.style.removeProperty(item.property);
      }
    };
    restoreStyles(liveLayerFullscreenMedia, liveLayerFullscreenMediaStyles);
    if (liveLayerFullscreenTarget !== liveLayerFullscreenMedia) restoreStyles(liveLayerFullscreenTarget, liveLayerFullscreenStyles);
    liveLayerFullscreenMedia = null;
    liveLayerFullscreenMediaStyles = null;
    liveLayerFullscreenTarget = null;
    liveLayerFullscreenStyles = null;
  }

  function applyImportantStyles(element, declarations) {
    for (const [property, value] of Object.entries(declarations)) {
      element.style.setProperty(property, value, "important");
    }
  }

  function showToast(message) {
    stage.querySelector("#ll-toast")?.remove();
    const toast = document.createElement("div");
    toast.id = "ll-toast";
    toast.style.cssText = "position:absolute;left:50%;top:24px;transform:translateX(-50%);pointer-events:none;background:rgba(9,14,20,.94);color:#fff;padding:10px 14px;border:1px solid rgba(255,255,255,.16);border-radius:10px;font:700 12px system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.4)";
    toast.textContent = message;
    stage.append(toast);
    setTimeout(() => toast.remove(), 3200);
  }

  async function toggleLiveLayerFullscreen() {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    const media = largestMediaElement();
    if (!media) {
      showToast("No visible video or embedded player was found on this page.");
      return;
    }
    const target = likelyPlayerContainer(media);
    liveLayerFullscreenTarget = target;
    liveLayerFullscreenStyles = saveInlineStyles(target);
    liveLayerFullscreenMedia = media;
    liveLayerFullscreenMediaStyles = target === media ? liveLayerFullscreenStyles : saveInlineStyles(media);
    const declarations = {
      position: "fixed", inset: "0", top: "0", right: "0", bottom: "0", left: "0",
      width: "100vw", height: "100vh", "max-width": "none", "max-height": "none",
      "z-index": "2147483644", margin: "0", transform: "none", background: "#000"
    };
    applyImportantStyles(target, declarations);
    if (target !== media) applyImportantStyles(media, { width: "100%", height: "100%", "max-width": "none", "max-height": "none", margin: "0" });
    if (media.tagName === "VIDEO") media.style.setProperty("object-fit", "contain", "important");
    try {
      await document.documentElement.requestFullscreen({ navigationUI: "hide" });
    } catch (error) {
      restoreLiveLayerFullscreenTarget();
      showToast(error?.message || "Fullscreen was blocked by this page.");
    }
  }

  function isKalshiAccountPage() {
    return /(^|\.)kalshi\.com$/i.test(location.hostname)
      && /(portfolio|position|order|history|activity|fill|document|account|trade)/i.test(`${location.pathname} ${location.search}`);
  }

  function cleanVisibleLine(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function uniqueLines(values, limit = 40) {
    const seen = new Set();
    const result = [];
    for (const value of values) {
      const line = cleanVisibleLine(value);
      const key = line.toLowerCase();
      if (!line || line.length > 260 || seen.has(key)) continue;
      seen.add(key);
      result.push(line);
      if (result.length >= limit) break;
    }
    return result;
  }

  function stableKey(value) {
    let hash = 2166136261;
    for (const char of String(value || "")) {
      hash ^= char.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function kalshiItemLink(node) {
    const anchor = node?.matches?.("a[href*='/markets/']") ? node : node?.querySelector?.("a[href*='/markets/']");
    if (!anchor?.href) return { href: "", ticker: "", label: "" };
    let ticker = "";
    try {
      const url = new URL(anchor.href, location.href);
      ticker = decodeURIComponent(url.pathname.split("/").filter(Boolean).at(-1) || "").toUpperCase();
    } catch {
      ticker = "";
    }
    return { href: anchor.href, ticker, label: cleanVisibleLine(anchor.innerText || anchor.getAttribute("aria-label")) };
  }

  function captureKalshiAccountPage() {
    if (!isKalshiAccountPage()) return null;
    const main = document.querySelector("main, [role='main']") || document.body;
    const pageLines = uniqueLines((main.innerText || "").split("\n"), 160);
    const unauthenticated = pageLines.some((line) => /^(log in|sign in|create account)$/i.test(line));
    const summary = [];
    for (let index = 0; index < pageLines.length; index += 1) {
      const line = pageLines[index];
      if (!/(portfolio value|cash balance|available cash|balance|unrealized|realized|profit|loss|p&l|open positions?|open orders?)/i.test(line)) continue;
      const next = pageLines[index + 1] || "";
      summary.push(next && /[$¢%+\-\d]/.test(next) && !/(portfolio|balance|position|order|profit|loss)/i.test(next) ? `${line}: ${next}` : line);
    }

    const rows = [];
    const items = [];
    let headers = [];
    const rowNodes = main.querySelectorAll("table tr, [role='row']");
    for (const row of rowNodes) {
      const cellNodes = [...row.querySelectorAll("th, td, [role='cell'], [role='gridcell'], [role='columnheader']")];
      const cells = cellNodes.map((cell) => cleanVisibleLine(cell.innerText)).filter(Boolean);
      const line = cells.length ? cells.join(" · ") : cleanVisibleLine(row.innerText);
      if (!line) continue;
      rows.push(line);
      const isHeader = cellNodes.some((cell) => cell.matches("th, [role='columnheader']"));
      if (isHeader && cells.length) {
        headers = cells;
      } else if (cells.length) {
        const market = kalshiItemLink(row);
        items.push({ key: stableKey(market.href || line), title: market.label || cells[0], cells, text: line, href: market.href, ticker: market.ticker });
      }
    }

    if (rows.length < 2) {
      const cards = main.querySelectorAll("article, [data-testid*='position' i], [data-testid*='order' i], [data-testid*='fill' i], a[href*='/markets/']");
      for (const card of cards) {
        const lines = uniqueLines((card.innerText || "").split("\n"), 8);
        if (lines.length) {
          const line = lines.join(" · ");
          const market = kalshiItemLink(card);
          rows.push(line);
          items.push({ key: stableKey(market.href || line), title: market.label || lines[0], cells: lines, text: line, href: market.href, ticker: market.ticker });
        }
      }
    }

    const summaryLines = uniqueLines(summary, 10);
    let rowLines = uniqueLines(rows, 40);
    if (!rowLines.length) {
      rowLines = uniqueLines(pageLines.filter((line) => !summaryLines.includes(line) && /(yes|no|buy|sell|order|position|fill|contract|¢|\$|%)/i.test(line)), 18);
    }
    const pathText = `${location.pathname} ${location.search}`;
    const kind = /order/i.test(pathText) ? "Orders" : /fill|history|activity/i.test(pathText) ? "Trade history" : "Portfolio";
    return {
      url: location.href,
      title: `${kind} · ${document.title.replace(/\s*[|·-]\s*Kalshi.*$/i, "").trim() || "Kalshi"}`,
      authenticated: !unauthenticated,
      summary: summaryLines,
      rows: rowLines,
      headers,
      items: [...new Map(items.map((item) => [item.key, item])).values()].slice(0, 40),
      capturedAt: Date.now()
    };
  }

  let lastKalshiSnapshotFingerprint = "";
  let kalshiPublishDebounce = 0;
  async function publishKalshiSnapshot(force = false) {
    const snapshot = captureKalshiAccountPage();
    if (!snapshot) return;
    const fingerprint = JSON.stringify({ url: snapshot.url, authenticated: snapshot.authenticated, summary: snapshot.summary, rows: snapshot.rows, headers: snapshot.headers, items: snapshot.items });
    if (!force && fingerprint === lastKalshiSnapshotFingerprint) return;
    lastKalshiSnapshotFingerprint = fingerprint;
    try {
      await chrome.runtime.sendMessage({ type: "LIVELAYER_PUBLISH_KALSHI_SNAPSHOT", snapshot });
    } catch {
      // A reloaded extension can temporarily disconnect an already-open tab.
    }
  }

  function queueKalshiSnapshot() {
    if (!/(^|\.)kalshi\.com$/i.test(location.hostname)) return;
    clearTimeout(kalshiPublishDebounce);
    kalshiPublishDebounce = setTimeout(() => publishKalshiSnapshot(false), 250);
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
    })[char]);
  }

  function id() {
    return globalThis.crypto?.randomUUID?.() || `ll-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function widgetName(widget) {
    return widget.name || (widget.type === "espn"
      ? "ESPN game"
      : widget.type === "kalshi"
        ? "Kalshi market"
        : widget.type === "kalshiAccount"
          ? "Kalshi portfolio"
          : "Text note");
  }

  function sourceTypeLabel(type) {
    return type === "espn" ? "ESPN" : type === "kalshi" ? "Kalshi market or game" : "Kalshi account";
  }

  function sourceForWidget(widget) {
    return state.sources.find((source) => source.id === widget.sourceId) || null;
  }

  function migrateSources() {
    let changed = false;
    if (!Array.isArray(state.sources)) { state.sources = []; changed = true; }
    for (const widget of state.widgets) {
      if (widget.type === "text" || widget.sourceId) continue;
      let source = state.sources.find((item) => item.type === widget.type && item.input === widget.sourceInput);
      if (!source) {
        source = {
          id: id(),
          type: widget.type,
          name: widget.name || sourceTypeLabel(widget.type),
          input: widget.sourceInput || "",
          meta: widget.sourceMeta || {},
          connectedLabel: widget.name || ""
        };
        state.sources.push(source);
      }
      widget.sourceId = source.id;
      widget.presetKey ||= `legacy-${widget.id}`;
      changed = true;
    }
    return changed;
  }

  function normalizeState(raw = {}) {
    const normalized = { ...DEFAULT_STATE, ...raw };
    normalized.sources = Array.isArray(normalized.sources) ? normalized.sources : [];
    normalized.widgets = Array.isArray(normalized.widgets) ? normalized.widgets : [];
    normalized.layouts = Array.isArray(normalized.layouts) ? normalized.layouts : [];
    normalized.settings = {
      ...DEFAULT_SETTINGS,
      ...(normalized.settings || {}),
      numberStyle: { ...DEFAULT_NUMBER_STYLE, ...(normalized.settings?.numberStyle || {}) }
    };
    normalized.ui = { selectedSourceId: "all", ...(normalized.ui || {}) };
    return normalized;
  }

  async function loadState() {
    const stored = await chrome.storage.local.get(STORAGE_KEY);
    state = normalizeState(stored[STORAGE_KEY]);
    const migrated = migrateSources();
    if (migrated) await saveState();
    render();
  }

  async function saveState() {
    await chrome.storage.local.set({ [STORAGE_KEY]: state });
  }

  function styleFor(widget) {
    const style = widget.style || {};
    const color = style.color || state.settings.textColor;
    const fontSize = clamp(Number(style.fontSize) || 18, 11, 54);
    const opacity = clamp(Number(style.backgroundOpacity ?? state.settings.backgroundOpacity) || 0, 0, 0.9);
    const textOpacity = clamp(Number(style.textOpacity ?? 1), 0.05, 1);
    const blockDimensions = {
      smallSquare: { width: 160, height: 160 },
      wide: { width: 320, height: 160 },
      largeSquare: { width: 320, height: 320 },
      banner: { width: 480, height: 160 }
    }[style.blockSize];
    const width = blockDimensions?.width || clamp(Number(style.width) || 310, 120, 720);
    let height = blockDimensions?.height || clamp(Number(style.height) || 0, 0, 720);
    const visualStyle = ["transparent", "card", "square", "scorebug", "block", "marketChart"].includes(style.visualStyle) ? style.visualStyle : "transparent";
    if (!height && visualStyle === "square") height = width;
    const shadowValue = style.shadow === false ? "none" : "0 2px 4px rgba(0,0,0,.95), 0 0 10px rgba(0,0,0,.7)";
    const fontFamily = style.fontFamily || state.settings.fontFamily;
    const accentColor = style.accentColor || state.settings.accentColor;
    return { color, fontSize, opacity, textOpacity, width, height, visualStyle, blockSize: style.blockSize || "auto", shadowValue, alignment: style.alignment || "left", fontFamily, accentColor, customCss: style.customCss || "" };
  }

  function numberStyleFor(widget) {
    return { ...DEFAULT_NUMBER_STYLE, ...(state.settings.numberStyle || {}), ...(widget.numberStyle || {}) };
  }

  function numberColor(widget, current) {
    return conditionalColor({ ...numberStyleFor(widget), current, target: widget.card?.target });
  }

  function numericAnimationValue(value) {
    const cleaned = String(value ?? "").trim().replaceAll(",", "");
    if (!/^-?\d+(?:\.\d+)?$/.test(cleaned)) return null;
    const number = Number(cleaned);
    return Number.isFinite(number) ? { number, decimals: cleaned.includes(".") ? cleaned.split(".")[1].length : 0 } : null;
  }

  function numberMarkup(widget, current, className = "", key = "value") {
    const color = numberColor(widget, current);
    const parsed = numericAnimationValue(current);
    const animationKey = `${widget.id}:${key}`;
    const previous = displayedNumbers.get(animationKey);
    const attributes = parsed
      ? ` data-number-key="${escapeHtml(animationKey)}" data-number-to="${parsed.number}" data-number-decimals="${parsed.decimals}" data-number-final="${escapeHtml(current)}"`
      : "";
    const initial = parsed && Number.isFinite(previous) && previous !== parsed.number ? previous.toFixed(parsed.decimals) : current;
    return `<span class="ll-dynamic-number ${escapeHtml(className)}"${attributes}${color ? ` style="color:${escapeHtml(color)}"` : ""}>${escapeHtml(initial)}</span>`;
  }

  function animateWidgetNumbers(element) {
    const reduceMotion = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    for (const node of element.querySelectorAll("[data-number-key]")) {
      const key = node.dataset.numberKey;
      const target = Number(node.dataset.numberTo);
      const decimals = Number(node.dataset.numberDecimals) || 0;
      const previous = displayedNumbers.get(key);
      displayedNumbers.set(key, target);
      if (reduceMotion || !Number.isFinite(previous) || previous === target) {
        node.textContent = node.dataset.numberFinal;
        continue;
      }
      const started = performance.now();
      const duration = 480;
      const frame = (now) => {
        if (!node.isConnected) return;
        const progress = clamp((now - started) / duration, 0, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const value = previous + (target - previous) * eased;
        node.textContent = value.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
        if (progress < 1) requestAnimationFrame(frame);
        else node.textContent = node.dataset.numberFinal;
      };
      requestAnimationFrame(frame);
    }
  }

  function marketChartMarkup(widget, data, history = []) {
    const current = Number(data?.yesPercent);
    const points = history.filter((point) => Number.isFinite(Number(point.value))).slice(-60);
    if (!points.length && Number.isFinite(current)) points.push({ value: current, time: Date.now() });
    const values = points.map((point) => Number(point.value));
    const first = values[0] ?? current;
    const last = values.at(-1) ?? current;
    const change = Number.isFinite(first) && Number.isFinite(last) ? Math.round((last - first) * 10) / 10 : 0;
    const min = Math.min(...values, Number.isFinite(current) ? current : 0);
    const max = Math.max(...values, Number.isFinite(current) ? current : 100);
    const span = Math.max(5, max - min);
    const plotted = values.length === 1 ? [values[0], values[0]] : values;
    const polyline = plotted.map((value, index) => {
      const x = plotted.length === 1 ? 0 : (index / (plotted.length - 1)) * 300;
      const y = 75 - ((value - min) / span) * 66;
      return `${Math.round(x * 10) / 10},${Math.round(y * 10) / 10}`;
    }).join(" ");
    const color = change < 0 ? "#ff5a67" : "#42df82";
    const sign = change > 0 ? "+" : "";
    return `<div style="--ll-chart-color:${color}"><div class="ll-market-head"><div><div class="ll-broadcast-title">${escapeHtml(data.title || data.ticker || "Kalshi market")}</div><div class="ll-detail">YES price · ${escapeHtml(data.status || "live")}</div></div><div class="ll-market-price">${numberMarkup(widget, Number.isFinite(current) ? current : "N/A", "", "chart-price")}%</div></div><svg class="ll-market-chart" viewBox="0 0 300 82" preserveAspectRatio="none" role="img" aria-label="YES price history"><line class="ll-market-chart-grid" x1="0" y1="41" x2="300" y2="41"></line><polyline class="ll-market-chart-line" points="${polyline}"></polyline></svg><div class="ll-market-change">${sign}${escapeHtml(change)} points since tracking began${points.length < 2 ? " · collecting history" : ""}</div></div>`;
  }

  function updatedTime(record) {
    if (!record?.updatedAt) return "";
    return new Date(record.updatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });
  }

  function headingMarkup(widget, fallback = "") {
    if (widget.display?.showHeading !== true) return "";
    const heading = widget.name || fallback;
    return heading ? `<div class="ll-kicker">${escapeHtml(heading)}</div>` : "";
  }

  function targetProgressMarkup(widget, current, label = "") {
    if (widget.card?.showProgress === false) return "";
    const progress = progressInfo(current, widget.card?.target);
    if (!progress) return "";
    const unit = String(widget.card?.unit || "").trim();
    const currentText = String(current ?? progress.currentNumber);
    const targetText = String(widget.card?.target ?? progress.targetNumber);
    const prefix = label ? `${label}: ` : "";
    const suffix = unit ? ` ${unit}` : "";
    const summary = `${prefix}${currentText} / ${targetText}${suffix} · ${progress.roundedPercentage}% completed`;
    return `<div class="ll-progress-wrap"><div class="ll-progress ${progress.complete ? "complete" : ""}" style="--ll-progress:${progress.percentage}%" role="progressbar" aria-valuemin="0" aria-valuemax="${escapeHtml(progress.targetNumber)}" aria-valuenow="${escapeHtml(progress.currentNumber)}" aria-label="${escapeHtml(summary)}"><i></i></div><div class="ll-progress-label">${escapeHtml(prefix)}${numberMarkup(widget, currentText, "", `progress-${label || "main"}`)} / ${escapeHtml(targetText + suffix)} · ${escapeHtml(progress.roundedPercentage)}% completed</div></div>`;
  }

  function broadcastCardMarkup(widget, { title, current, target, unit, subtitle = "" }) {
    const currentText = current === null || current === undefined || current === "" ? "N/A" : String(current);
    const targetMarkup = target !== null && target !== undefined && target !== "" ? `<span class="ll-broadcast-target">/ ${escapeHtml(target)}</span>` : "";
    const displayWidget = { ...widget, card: { ...(widget.card || {}), target, unit } };
    return `<div class="ll-broadcast-card"><div><div class="ll-broadcast-title">${escapeHtml(title || "Stat")}</div>${subtitle && widget.card?.showDetails !== false ? `<div class="ll-detail">${escapeHtml(subtitle)}</div>` : ""}</div><div class="ll-broadcast-value">${numberMarkup(displayWidget, currentText, "", "broadcast")}${targetMarkup}${unit ? `<span class="ll-broadcast-unit">${escapeHtml(unit)}</span>` : ""}</div>${targetProgressMarkup(displayWidget, current)}</div>`;
  }

  const TEAM_STAT_ALIASES = {
    netPassingYards: ["netPassingYards", "passingYards", "netPassing", "passing"],
    rushingYards: ["rushingYards", "rushing", "rushYards"],
    totalYards: ["totalYards", "totalOffense", "yards"],
    firstDowns: ["firstDowns", "firstDown"],
    turnovers: ["turnovers", "totalTurnovers"],
    sacksYardsLost: ["sacksYardsLost", "sacks", "sacksMade"],
    thirdDownEff: ["thirdDownEff", "thirdDownEfficiency", "thirdDownConversions"],
    possessionTime: ["possessionTime", "timeOfPossession"],
    totalPenaltiesYards: ["totalPenaltiesYards", "penalties", "penaltyYards"]
  };

  function findTeamStat(team, key) {
    const entries = Object.entries(team?.stats || {});
    const aliases = TEAM_STAT_ALIASES[key] || [key];
    for (const alias of aliases) {
      const direct = team?.stats?.[alias];
      if (direct) return direct;
      const normalized = alias.toLowerCase().replace(/[^a-z0-9]/g, "");
      const match = entries.find(([name, stat]) => `${name} ${stat?.label || ""} ${stat?.abbreviation || ""}`.toLowerCase().replace(/[^a-z0-9]/g, "").includes(normalized));
      if (match) return match[1];
    }
    return null;
  }

  function teamStatMarkup(widget, data, field) {
    const key = field.slice("teamStat:".length);
    let teams = data.teamStats || [];
    if (widget.teamSide === "away") teams = teams.slice(0, 1);
    if (widget.teamSide === "home") teams = teams.slice(-1);
    const stats = teams.map((team) => ({ team: team.team, stat: findTeamStat(team, key) })).filter((item) => item.stat);
    if (!stats.length) return `<div class="ll-error">ESPN did not return this stat for this game.</div>`;
    const label = stats[0].stat.label || key;
    return `${headingMarkup(widget)}<div class="ll-kicker">${escapeHtml(label)}</div><div class="ll-stat-pair">${stats.map((item) => `<div class="ll-stat-block"><div class="ll-stat-team">${escapeHtml(item.team)}</div><div class="ll-stat-number">${numberMarkup(widget, item.stat.value, "", `team-${item.team}`)}${widget.card?.target ? `<span class="ll-broadcast-target">/ ${escapeHtml(widget.card.target)}</span>` : ""}</div>${targetProgressMarkup(widget, item.stat.value, item.team)}</div>`).join("")}</div>`;
  }

  function playerStatMarkup(widget, data, field) {
    const categoryKey = field.slice("playerCategory:".length).toLowerCase();
    const categories = (data.playerStats || []).filter((category) => `${category.key} ${category.label}`.toLowerCase().includes(categoryKey));
    const athletes = categories.flatMap((category) => category.athletes.map((athlete) => ({ ...athlete, team: category.team, labels: category.labels })));
    if (!athletes.length) return `<div class="ll-error">ESPN did not return player ${escapeHtml(categoryKey)} stats for this game.</div>`;
    const chosen = athletes.find((athlete) => athlete.id && athlete.id === widget.player?.athleteId)
      || athletes.find((athlete) => athlete.name === widget.player?.athleteName)
      || athletes[0];
    const preferredLabel = widget.player?.statLabel;
    const labels = chosen.labels || [];
    const statLabel = preferredLabel && labels.includes(preferredLabel)
      ? preferredLabel
      : labels.find((label) => /YDS|YARDS|TOTAL|TACKLES|SACKS|PTS|POINTS/i.test(label)) || labels[0] || "STAT";
    const current = chosen.stats?.[statLabel] ?? chosen.values?.[labels.indexOf(statLabel)] ?? "N/A";
    const playerName = widget.player?.showNumber && chosen.jersey ? `#${chosen.jersey} ${chosen.name}` : chosen.name;
    const title = widget.card?.title || playerName;
    const unit = widget.card?.unit || statLabel;
    const subtitle = widget.card?.showDetails === false ? "" : `${chosen.team} ${categories[0]?.label || categoryKey}`;
    return `${headingMarkup(widget)}${broadcastCardMarkup(widget, { title, current, target: widget.card?.target, unit, subtitle })}`;
  }

  function espnMarkup(widget, record) {
    if (record?.error) return `${headingMarkup(widget)}<div class="ll-error">${escapeHtml(record.error)}</div>`;
    const data = record?.data;
    if (!data || data.kind !== "game") return `${headingMarkup(widget)}<div class="ll-loading">Loading ESPN…</div>`;
    const fields = new Set(widget.fields || ["score", "status"]);
    const specialField = [...fields].find((field) => field.startsWith("teamStat:") || field.startsWith("playerCategory:"));
    if (specialField?.startsWith("teamStat:")) return teamStatMarkup(widget, data, specialField);
    if (specialField?.startsWith("playerCategory:")) return playerStatMarkup(widget, data, specialField);
    const pieces = [headingMarkup(widget)];
    if (fields.has("score")) {
      pieces.push(...data.teams.map((team) => `<div class="ll-score-block"><div class="ll-score-row"><span class="ll-score-team">${team.possession ? '<span class="ll-possession">◆</span>' : ""}${escapeHtml(team.abbreviation)}</span><span class="ll-score-value">${numberMarkup(widget, team.score, "", `score-${team.abbreviation}`)}${widget.card?.target ? `<span class="ll-broadcast-target">/ ${escapeHtml(widget.card.target)}</span>` : ""}</span></div>${targetProgressMarkup(widget, team.score, team.abbreviation)}</div>`));
    }
    if (fields.has("status")) {
      const clock = [data.period, data.clock].filter(Boolean).join(" · ");
      pieces.push(`<div class="ll-subline">${escapeHtml(data.status)}${clock && !String(data.status).includes(data.clock) ? ` · ${escapeHtml(clock)}` : ""}</div>`);
    }
    if (fields.has("records")) {
      const records = data.teams.filter((team) => team.record).map((team) => `${team.abbreviation} ${team.record}`).join(" · ");
      if (records) pieces.push(`<div class="ll-detail">${escapeHtml(records)}</div>`);
    }
    if (fields.has("situation") && data.situation) pieces.push(`<div class="ll-detail">${escapeHtml(data.situation)}</div>`);
    if (fields.has("lastPlay") && data.lastPlay) pieces.push(`<div class="ll-detail">Last: ${escapeHtml(data.lastPlay)}</div>`);
    if (fields.has("winProbability") && data.winProbability) {
      const win = data.winProbability;
      pieces.push(`<div class="ll-detail">Win: ${escapeHtml(win.awayTeam)} ${numberMarkup(widget, win.awayPercent, "", "win-away")}% · ${escapeHtml(win.homeTeam)} ${numberMarkup(widget, win.homePercent, "", "win-home")}%</div>${targetProgressMarkup(widget, win.awayPercent, win.awayTeam)}${targetProgressMarkup(widget, win.homePercent, win.homeTeam)}`);
    }
    if (fields.has("leaders") && data.leaders?.length) {
      const leaderLines = data.leaders.flatMap((team) => team.items.slice(0, 2).map((item) => `<div class="ll-leader"><strong>${escapeHtml(team.team)} ${escapeHtml(item.label)}:</strong> ${escapeHtml(item.athlete)} ${escapeHtml(item.value)}</div>`));
      pieces.push(`<div class="ll-leaders">${leaderLines.join("")}</div>`);
    }
    if (fields.has("venue") && data.venue) pieces.push(`<div class="ll-detail">${escapeHtml(data.venue)}</div>`);
    if (fields.has("updated")) pieces.push(`<div class="ll-detail">Updated ${escapeHtml(updatedTime(record))}</div>`);
    return pieces.join("");
  }

  function formatContracts(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "";
  }

  function kalshiMarkup(widget, record) {
    if (record?.error) return `${headingMarkup(widget)}<div class="ll-error">${escapeHtml(record.error)}</div>`;
    const sourceData = record?.data;
    const data = sourceData?.kind === "event"
      ? (sourceData.markets || []).find((market) => market.ticker === widget.marketTicker) || sourceData.markets?.[0]
      : sourceData;
    if (!data || data.kind !== "market") return `${headingMarkup(widget)}<div class="ll-loading">Loading Kalshi…</div>`;
    const fields = new Set(widget.fields || ["probability", "bet"]);
    const side = widget.bet?.side === "no" ? "NO" : "YES";
    const current = side === "YES" ? data.yesPercent : data.noPercent;
    const entry = Number(widget.bet?.entryPrice);
    const delta = Number.isFinite(entry) && Number.isFinite(current) ? Math.round((current - entry) * 10) / 10 : null;
    const pieces = [headingMarkup(widget), widget.display?.showSourceTitle === false || fields.has("chart") ? "" : `<div class="ll-subline">${escapeHtml(data.title)}</div>`];
    if (fields.has("chart")) pieces.push(marketChartMarkup(widget, data, record?.history?.[data.ticker] || []));
    if (fields.has("probability")) pieces.push(`<div class="ll-primary">YES ${numberMarkup(widget, data.yesPercent ?? "N/A", "", "yes-price")}%</div><div class="ll-subline">NO ${numberMarkup(widget, data.noPercent ?? "N/A", "", "no-price")}% market-implied</div>${targetProgressMarkup(widget, data.yesPercent, "YES")}`);
    if (fields.has("spread")) pieces.push(`<div class="ll-detail">YES bid ${numberMarkup(widget, data.yesBid ?? "N/A", "", "yes-bid")}¢ · ask ${numberMarkup(widget, data.yesAsk ?? "N/A", "", "yes-ask")}¢ · last ${numberMarkup(widget, data.last ?? "N/A", "", "last")}¢</div>${targetProgressMarkup(widget, data.last, "Last trade")}`);
    if (fields.has("bet") && Number.isFinite(entry)) {
      const contracts = formatContracts(widget.bet?.contracts);
      const sign = delta > 0 ? "+" : "";
      pieces.push(`<div class="ll-detail">My bet: ${side} @ ${escapeHtml(entry)}¢${contracts ? ` · ${escapeHtml(contracts)} contracts` : ""}${delta === null ? "" : ` · ${sign}${escapeHtml(delta)}¢`}</div>${targetProgressMarkup(widget, current, side)}`);
    }
    if (fields.has("volume")) pieces.push(`<div class="ll-detail">Volume ${numberMarkup(widget, data.volume || "N/A", "", "volume")} · Open interest ${numberMarkup(widget, data.openInterest || "N/A", "", "open-interest")}</div>${targetProgressMarkup(widget, data.volume, "Volume")}`);
    if (fields.has("status")) pieces.push(`<div class="ll-detail">${escapeHtml(data.status)}${data.result ? ` · Result ${escapeHtml(data.result.toUpperCase())}` : ""}</div>`);
    if (fields.has("updated")) pieces.push(`<div class="ll-detail">Updated ${escapeHtml(updatedTime(record))}</div>`);
    return pieces.join("");
  }

  function espnBoundCardValue(card) {
    if (!card?.espnSourceId) return null;
    const data = sourceLive.get(card.espnSourceId)?.data;
    const athletes = (data?.playerStats || [])
      .filter((category) => !card.espnCategoryKey || category.key === card.espnCategoryKey)
      .flatMap((category) => category.athletes.map((athlete) => ({ ...athlete, labels: category.labels, team: category.team, category: category.label })));
    const athlete = athletes.find((item) => item.id && item.id === card.espnAthleteId)
      || athletes.find((item) => item.name === card.espnAthleteName);
    if (!athlete) return null;
    const labels = athlete.labels || [];
    const statLabel = card.espnStatLabel && labels.includes(card.espnStatLabel)
      ? card.espnStatLabel
      : labels.find((label) => /YDS|YARDS|TOTAL|TACKLES|SACKS|PTS|POINTS/i.test(label)) || labels[0];
    if (!statLabel) return null;
    const playerName = card.showPlayerNumber && athlete.jersey ? `#${athlete.jersey} ${athlete.name}` : athlete.name;
    let current = athlete.stats?.[statLabel] ?? athlete.values?.[labels.indexOf(statLabel)] ?? null;
    if (card.espnStatPart && String(current).includes("/")) {
      const parts = String(current).split("/");
      current = card.espnStatPart === "second" ? parts[1] : parts[0];
    }
    return { current, unit: statLabel, detail: `${playerName} · ${athlete.team} ${athlete.category || ""}`.trim() };
  }

  function kalshiAccountMarkup(widget, record) {
    if (record?.error) return `${headingMarkup(widget)}<div class="ll-error">${escapeHtml(record.error)}</div>`;
    const data = record?.data;
    if (!data) return `${headingMarkup(widget)}<div class="ll-loading">Looking for the open Kalshi tab…</div>`;
    if (!data.connected) {
      return `${headingMarkup(widget)}<div class="ll-error">Open the linked Kalshi page in another tab and stay logged in.</div>`;
    }
    if (data.authenticated === false) return `${headingMarkup(widget)}<div class="ll-error">The Kalshi tab is open, but it is not logged in.</div>`;
    const fields = new Set(widget.fields || ["summary", "rows", "updated"]);
    const pieces = [headingMarkup(widget), widget.display?.showSourceTitle === true ? `<div class="ll-subline">${escapeHtml(data.title || "Portfolio / order history")}</div>` : ""];
    if (widget.accountItemKey) {
      const item = (data.items || []).find((entry) => entry.key === widget.accountItemKey)
        || (data.items || []).find((entry) => entry.text === widget.accountItemText);
      if (!item) return `${headingMarkup(widget)}<div class="ll-error">This position or order is not visible on the connected Kalshi page.</div>`;
      if (widget.card?.mode === "table") {
        const cells = item.cells || [item.text];
        const headers = data.headers || [];
        return `${headingMarkup(widget)}<div class="ll-table-row">${cells.map((cell, index) => widget.card?.showHeaders === false ? `<div class="ll-table-cell" style="grid-template-columns:1fr"><span>${escapeHtml(cell)}</span></div>` : `<div class="ll-table-cell"><b>${escapeHtml(headers[index] || `Field ${index + 1}`)}</b><span>${escapeHtml(cell)}</span></div>`).join("")}</div>`;
      }
      const values = (item.cells || []).slice(1);
      const inferredCurrent = values.map(numberFromText).find((value) => Number.isFinite(value));
      const title = widget.card?.title || item.title || item.text;
      const espnBinding = widget.card?.currentMode === "espn" ? espnBoundCardValue(widget.card) : null;
      const current = widget.card?.currentMode === "manual"
        ? widget.card?.current
        : widget.card?.currentMode === "espn"
          ? espnBinding?.current
          : inferredCurrent;
      const liveBetDetails = values.slice(0, 4).join(" · ");
      const subtitle = widget.card?.subtitle || [espnBinding?.detail, liveBetDetails].filter(Boolean).join(" · ");
      const unit = widget.card?.unit || espnBinding?.unit || "";
      return `${headingMarkup(widget)}${broadcastCardMarkup(widget, { title, current, target: widget.card?.target, unit, subtitle })}`;
    }
    if (fields.has("summary") && data.summary?.length) {
      pieces.push(`<div class="ll-leaders">${data.summary.slice(0, 6).map((line) => `<div class="ll-leader">${escapeHtml(line)}</div>`).join("")}</div>`);
    }
    if (!data.summary?.length && !data.items?.length) pieces.push(`<div class="ll-detail">The page is connected, but no portfolio rows are currently visible.</div>`);
    if (fields.has("updated")) {
      const ageSeconds = Math.max(0, Math.round((Date.now() - Number(data.capturedAt || 0)) / 1000));
      const status = ageSeconds > 90 ? `Stale, ${ageSeconds}s old. Keep the Kalshi tab open.` : `Connected · refreshed ${ageSeconds}s ago`;
      pieces.push(`<div class="ll-detail">${escapeHtml(status)}</div>`);
    }
    return pieces.join("");
  }

  function textMarkup(widget) {
    return String(widget.text || "Your note").split("\n").map(escapeHtml).join("<br>");
  }

  function renderWidgets() {
    widgetsRoot.replaceChildren();
    if (!activeForTab) {
      stage.style.display = "none";
      return;
    }
    stage.style.display = "block";
    stage.style.setProperty("--ll-app-accent", state.settings.accentColor);
    stage.style.setProperty("--ll-grid-opacity", String(clamp(Number(state.settings.gridOpacity), 0, .3)));
    stage.style.fontFamily = state.settings.fontFamily;
    stage.classList.toggle("arranging", editMode);
    widgetsRoot.style.display = state.enabled ? "block" : "none";
    gear.style.display = state.controlsVisible === false ? "none" : "grid";
    if (!state.enabled) return;

    let widgetsToRender = state.widgets;
    if (editor?.widget) {
      const preview = { ...editor.widget, visible: true };
      const exists = widgetsToRender.some((widget) => widget.id === preview.id);
      widgetsToRender = exists
        ? widgetsToRender.map((widget) => widget.id === preview.id ? preview : widget)
        : [...widgetsToRender, preview];
    }

    for (const widget of widgetsToRender.filter((item) => item.visible !== false)) {
      const element = document.createElement("div");
      const position = widget.position || { x: 5, y: 8 };
      const look = styleFor(widget);
      element.className = `ll-widget ll-style-${look.visualStyle}${editMode ? " arrange" : ""}${arrangeFocusId === widget.id ? " arrange-focus" : ""}`;
      element.dataset.widgetId = widget.id;
      element.style.left = `${clamp(Number(position.x) || 0, 0, 96)}%`;
      element.style.top = `${clamp(Number(position.y) || 0, 0, 96)}%`;
      element.style.width = `${look.width}px`;
      element.style.height = look.height ? `${look.height}px` : "auto";
      element.style.color = look.color;
      element.style.fontSize = `${look.fontSize}px`;
      element.style.background = `rgba(0, 0, 0, ${look.opacity})`;
      element.style.textShadow = look.shadowValue;
      element.style.textAlign = look.alignment;
      element.style.fontFamily = look.fontFamily;
      element.style.setProperty("--ll-text-opacity", String(look.textOpacity));
      element.style.setProperty("--ll-accent", look.accentColor);
      if (look.customCss) element.style.cssText += `;${look.customCss}`;
      const source = sourceForWidget(widget);
      const record = sourceLive.get(source?.id) || live.get(widget.id);
      const body = widget.type === "espn"
        ? espnMarkup(widget, record)
        : widget.type === "kalshi"
          ? kalshiMarkup(widget, record)
          : widget.type === "kalshiAccount"
            ? kalshiAccountMarkup(widget, record)
            : textMarkup(widget);
      element.innerHTML = `<div class="ll-widget-tools"><button class="ll-tool-button" data-widget-action="edit" title="Edit">✎</button><button class="ll-tool-button" data-widget-action="remove" title="Remove">×</button></div><div class="ll-widget-body">${body}</div><div class="ll-resize-width" data-resize="width" title="Drag to change width"></div><div class="ll-resize-height" data-resize="height" title="Drag to change height"></div><div class="ll-resize-scale" data-resize="scale" title="Drag to scale widget"></div>`;
      widgetsRoot.append(element);
      animateWidgetNumbers(element);
    }
  }

  function nextPaint() {
    return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }

  function occupiedWidgetRects(excludedWidgetId = "") {
    return [...widgetsRoot.querySelectorAll(".ll-widget")]
      .filter((element) => element.dataset.widgetId !== excludedWidgetId)
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
      });
  }

  async function arrangeWidgetNow(widget, forceReposition = false) {
    editMode = true;
    arrangeFocusId = widget.id;
    render();
    await nextPaint();
    const element = [...widgetsRoot.querySelectorAll(".ll-widget")].find((item) => item.dataset.widgetId === widget.id);
    if (!element) {
      await saveState();
      return;
    }
    const rect = element.getBoundingClientRect();
    const occupied = occupiedWidgetRects(widget.id);
    const collision = occupied.some((other) => rectsOverlap(rect, other, ARRANGE_GAP));
    const outsideViewport = rect.right > window.innerWidth || rect.bottom > window.innerHeight || rect.left < 0 || rect.top < 0;
    if (forceReposition || collision || outsideViewport) {
      const placement = findOpenPlacement({
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        width: rect.width,
        height: rect.height,
        occupied,
        gap: ARRANGE_GAP,
        gridSize: ARRANGE_GRID_SIZE,
        margin: 32
      });
      widget.position = toPercentPosition(placement.left, placement.top, window.innerWidth, window.innerHeight);
    }
    await saveState();
    render();
  }

  function render() {
    if (!widgetsRoot.querySelector(".dragging")) renderWidgets();
    renderPanel();
  }

  function sourceInputDetails(type) {
    if (type === "espn") return { title: "ESPN game", helper: "Paste a specific ESPN game or scoreboard URL.", placeholder: "https://www.espn.com/nfl/game/_/gameId/..." };
    if (type === "kalshi") return { title: "Kalshi market or game", helper: "Paste an individual market URL, a sports game/event URL, or its ticker. Game links are split into separate market stats.", placeholder: "https://kalshi.com/markets/..." };
    return { title: "Kalshi account", helper: "Paste your portfolio, positions, orders, fills, or history page URL.", placeholder: "https://kalshi.com/account/..." };
  }

  function newSource(type) {
    return { id: id(), type, name: "", input: "", meta: {}, connectedLabel: "" };
  }

  function sourceById(sourceId) {
    return state.sources.find((source) => source.id === sourceId) || null;
  }

  function collectSourceDraft(sourceId) {
    const form = [...stage.querySelectorAll("form[data-source-id]")].find((item) => item.dataset.sourceId === sourceId);
    if (!form) return null;
    const data = new FormData(form);
    const type = form.dataset.sourceType;
    const existing = sourceById(sourceId);
    const source = structuredClone(sourceEditor?.source?.id === sourceId ? sourceEditor.source : existing || newSource(type));
    source.name = String(data.get("sourceName") || "").trim();
    source.input = String(data.get("sourceInput") || "").trim();
    if (type === "espn" && sourceEditor?.source?.id === sourceId && sourceEditor.preview?.kind === "scoreboard") {
      const eventId = String(data.get("eventChoice") || "").trim();
      source.meta = eventId ? { ...sourceEditor.preview.source, eventId } : {};
    } else if (existing && source.input !== existing.input) {
      source.meta = {};
      source.connectedLabel = "";
    }
    return source;
  }

  function sourceBoxMarkup(inputSource) {
    const existing = sourceById(inputSource.id);
    const editing = sourceEditor?.source?.id === inputSource.id ? sourceEditor : null;
    const source = editing?.source || inputSource;
    const type = source.type;
    const details = sourceInputDetails(type);
    const choices = editing?.preview?.kind === "scoreboard" ? editing.preview.choices || [] : [];
    const selectedEvent = source.meta?.eventId || "";
    const choiceMarkup = choices.length
      ? `<div class="ll-field"><label>Choose the game</label><select class="ll-input" name="eventChoice"><option value="">Select a game</option>${choices.map((choice) => `<option value="${escapeHtml(choice.eventId)}" ${choice.eventId === selectedEvent ? "selected" : ""}>${escapeHtml(`${choice.title} | ${choice.status}${choice.score ? ` | ${choice.score}` : ""}`)}</option>`).join("")}</select></div>`
      : "";
    const message = editing?.message ? `<div class="ll-preview ${editing.error ? "error" : ""}">${escapeHtml(editing.message)}</div>` : "";
    return `<form class="ll-source-box" data-source-id="${escapeHtml(source.id)}" data-source-type="${escapeHtml(type)}">
      <div class="ll-row ll-space"><div><div class="ll-source-box-title">${escapeHtml(source.name || source.connectedLabel || details.title)}</div><div class="ll-source-type">${escapeHtml(details.title)}</div></div>${existing ? `<button type="button" class="ll-button ll-icon danger" data-action="remove-source" data-source-id="${escapeHtml(existing.id)}" title="Remove source">×</button>` : ""}</div>
      <div class="ll-note">${escapeHtml(details.helper)}</div>
      <input class="ll-input" name="sourceName" value="${escapeHtml(source.name || "")}" placeholder="Display name, for example Miami vs. LV">
      <input class="ll-input" name="sourceInput" value="${escapeHtml(source.input || "")}" placeholder="${escapeHtml(details.placeholder)}">
      ${choiceMarkup}${message}
      <div class="ll-row"><button type="button" class="ll-button" data-action="check-source" data-source-id="${escapeHtml(source.id)}">${type === "kalshiAccount" ? "Check connection" : "Check link"}</button>${type === "kalshiAccount" ? `<button type="button" class="ll-button" data-action="open-kalshi-page" data-source-id="${escapeHtml(source.id)}">Open tab</button>` : ""}<button type="button" class="ll-button primary" data-action="save-source" data-source-id="${escapeHtml(source.id)}">Save source</button></div>
    </form>`;
  }

  function widgetForPreset(sourceId, presetKey) {
    return state.widgets.find((widget) => widget.sourceId === sourceId && widget.presetKey === presetKey) || null;
  }

  function presetsForSource(source) {
    let presets = [...(PRESETS[source.type] || [])];
    if (source.type === "espn") {
      const data = sourceLive.get(source.id)?.data;
      const existingFields = new Set(presets.flatMap((preset) => preset.fields || []));
      for (const [key, stat] of Object.entries(data?.teamStats?.[0]?.stats || {})) {
        const field = `teamStat:${key}`;
        if (existingFields.has(field)) continue;
        presets.push({ key: `team-${stableKey(key)}`, group: "More team stats", label: stat.label || key, fields: [field] });
        existingFields.add(field);
      }
      const existingPlayerFields = new Set(presets.flatMap((preset) => preset.fields || []).filter((field) => field.startsWith("playerCategory:")));
      for (const category of data?.playerStats || []) {
        const categoryKey = String(category.key || category.label || "players");
        const field = `playerCategory:${categoryKey}`;
        if (existingPlayerFields.has(field)) continue;
        presets.push({ key: `player-${stableKey(categoryKey)}`, group: "More player stats", label: `${category.label || categoryKey} card`, fields: [field] });
        existingPlayerFields.add(field);
      }
      const seenPlayerPresets = new Set();
      for (const category of data?.playerStats || []) {
        const categoryKey = String(category.key || category.label || "players");
        for (const athlete of category.athletes || []) {
          const athleteKey = athlete.id || athlete.name;
          const presetKey = `athlete-${stableKey(`${categoryKey}|${athleteKey}`)}`;
          if (!athleteKey || seenPlayerPresets.has(presetKey)) continue;
          seenPlayerPresets.add(presetKey);
          const labels = category.labels || [];
          const statLabel = labels.find((label) => /YDS|YARDS|TOTAL|TACKLES|SACKS|PTS|POINTS/i.test(label)) || labels[0] || "";
          presets.push({
            key: presetKey,
            group: `${category.label || categoryKey} players`,
            label: `${athlete.jersey ? `#${athlete.jersey} ` : ""}${athlete.name} · ${category.team}`,
            fields: [`playerCategory:${categoryKey}`],
            player: { athleteId: athlete.id || "", athleteName: athlete.name, statLabel, showNumber: false }
          });
        }
      }
    }
    if (source.type === "kalshi") {
      const data = sourceLive.get(source.id)?.data;
      if (data?.kind === "event") {
        presets = (data.markets || []).flatMap((market) => {
          const key = stableKey(market.ticker);
          const title = market.title || market.ticker;
          return [
            { key: `${key}-probability`, group: title, label: "YES / NO price", fields: ["probability"], marketTicker: market.ticker },
            { key: `${key}-chart`, group: title, label: "Live price chart", fields: ["chart"], marketTicker: market.ticker, visualStyle: "marketChart", blockSize: "wide" },
            { key: `${key}-spread`, group: title, label: "Bid, ask, and last", fields: ["spread"], marketTicker: market.ticker },
            { key: `${key}-bet`, group: title, label: "My manual bet", fields: ["bet"], marketTicker: market.ticker },
            { key: `${key}-volume`, group: title, label: "Volume and interest", fields: ["volume"], marketTicker: market.ticker },
            { key: `${key}-status`, group: title, label: "Market status", fields: ["status"], marketTicker: market.ticker }
          ];
        });
      }
    }
    if (source.type === "kalshiAccount") {
      const data = sourceLive.get(source.id)?.data;
      for (const item of data?.items || []) {
        presets.push({ key: `account-item-${item.key}`, group: "Positions and orders", label: item.title || item.text, fields: ["accountItem"], accountItemKey: item.key, accountItemText: item.text });
      }
    }
    return presets;
  }

  function presetsForSourceMarkup(source) {
    const presets = presetsForSource(source);
    const groups = [...new Set(presets.map((preset) => preset.group))];
    const groupMarkup = groups.map((group) => {
      const tiles = presets.filter((preset) => preset.group === group).map((preset) => {
        const widget = widgetForPreset(source.id, preset.key);
        const active = widget && widget.visible !== false;
        return `<div class="ll-preset-card ${active ? "active" : ""}"><button class="ll-preset-main" data-action="toggle-preset" data-source-id="${escapeHtml(source.id)}" data-preset-key="${escapeHtml(preset.key)}">${escapeHtml(preset.label)}<span class="ll-preset-status">${active ? "Enabled" : "Click to enable"}</span></button><button class="ll-preset-gear" data-action="edit-preset" data-source-id="${escapeHtml(source.id)}" data-preset-key="${escapeHtml(preset.key)}" title="Widget settings">⚙</button></div>`;
      }).join("");
      return `<div class="ll-preset-group">${escapeHtml(group)}</div><div class="ll-preset-grid">${tiles}</div>`;
    }).join("");
    const record = sourceLive.get(source.id);
    const status = record?.error ? "Source error" : record?.data?.connected === false ? "Open the linked Kalshi tab" : record?.updatedAt ? "Live" : "Loading";
    return `<div class="ll-preset-source"><div class="ll-preset-head"><div><div class="ll-preset-title">${escapeHtml(source.name || source.connectedLabel || sourceTypeLabel(source.type))}</div><div class="ll-widget-meta">${escapeHtml(status)}</div></div></div>${groupMarkup}</div>`;
  }

  function textPresetMarkup() {
    const widget = state.widgets.find((item) => item.type === "text" && item.presetKey === "text-note")
      || state.widgets.find((item) => item.type === "text");
    const active = widget && widget.visible !== false;
    return `<div class="ll-preset-source"><div class="ll-preset-group">Other</div><div class="ll-preset-grid"><div class="ll-preset-card ${active ? "active" : ""}"><button class="ll-preset-main" data-action="toggle-text">Text note<span class="ll-preset-status">${active ? "Enabled" : "Click to enable"}</span></button><button class="ll-preset-gear" data-action="edit-text" title="Text note settings">⚙</button></div></div></div>`;
  }

  function legacyWidgetCardsMarkup() {
    const managed = state.widgets.filter((widget) => String(widget.presetKey || "").startsWith("legacy-"));
    if (!managed.length) return "";
    const cards = managed.map((widget) => {
      const record = live.get(widget.id);
      const meta = record?.error ? "Source error" : widget.visible === false ? "Hidden" : "Older custom widget";
      return `<div class="ll-widget-card"><div><div class="ll-widget-name">${escapeHtml(widgetName(widget))}</div><div class="ll-widget-meta">${escapeHtml(meta)}</div></div><div class="ll-card-actions"><button class="ll-button ll-icon" data-action="toggle-widget" data-id="${escapeHtml(widget.id)}" title="${widget.visible === false ? "Show" : "Hide"}">${widget.visible === false ? "○" : "●"}</button><button class="ll-button ll-icon" data-action="edit-widget" data-id="${escapeHtml(widget.id)}" title="Edit">✎</button><button class="ll-button ll-icon danger" data-action="remove-widget" data-id="${escapeHtml(widget.id)}" title="Remove">×</button></div></div>`;
    }).join("");
    return `<div class="ll-section-title">Older widgets</div><div class="ll-widget-list">${cards}</div>`;
  }

  function widgetPageMarkup() {
    const sources = state.sources.filter((source) => source.input);
    const selectedSourceId = sources.some((source) => source.id === state.ui.selectedSourceId) ? state.ui.selectedSourceId : "all";
    const visibleSources = selectedSourceId === "all" ? sources : sources.filter((source) => source.id === selectedSourceId);
    const sourceOptions = [`<option value="all" ${selectedSourceId === "all" ? "selected" : ""}>All sources</option>`, ...sources.map((source) => `<option value="${escapeHtml(source.id)}" ${selectedSourceId === source.id ? "selected" : ""}>${escapeHtml(source.name || source.connectedLabel || sourceTypeLabel(source.type))}</option>`)].join("");
    const navigator = sources.length ? `<div class="ll-source-nav"><div class="ll-field"><label>Widget source</label><select class="ll-input" name="widgetSourceView">${sourceOptions}</select></div><button class="ll-button" data-action="open-layouts">Layouts</button></div>` : `<div class="ll-row ll-space"><span></span><button class="ll-button" data-action="open-layouts">Layouts</button></div>`;
    return `<div class="ll-page-title">Widgets</div><div class="ll-page-subtitle">Choose a source page, then click a tile to show or hide it. Widgets from every source can stay on screen together.</div>${navigator}${sources.length ? visibleSources.map(presetsForSourceMarkup).join("") : '<div class="ll-empty">Add the links above.</div>'}${textPresetMarkup()}${legacyWidgetCardsMarkup()}`;
  }

  function widgetPresetSignature() {
    return JSON.stringify(state.sources.map((source) => {
      const record = sourceLive.get(source.id);
      return {
        id: source.id,
        error: record?.error || "",
        loaded: Boolean(record?.updatedAt),
        connected: record?.data?.connected,
        teamStats: Object.keys(record?.data?.teamStats?.[0]?.stats || {}),
        playerStats: [...new Set((record?.data?.playerStats || []).map((category) => category.key))],
        players: (record?.data?.playerStats || []).flatMap((category) => (category.athletes || []).map((athlete) => `${category.key}:${athlete.id || athlete.name}`)),
        markets: (record?.data?.markets || []).map((market) => `${market.ticker}:${market.title}`),
        items: (record?.data?.items || []).map((item) => item.key)
      };
    }));
  }

  function linksPageMarkup() {
    const saved = state.sources.map(sourceBoxMarkup).join("");
    const draft = sourceEditor?.isNew ? sourceBoxMarkup(sourceEditor.source) : "";
    return `<div class="ll-page-title">Links</div><div class="ll-page-subtitle">Add as many games and markets as you need. Kalshi accepts portfolio pages, individual markets, and sports game/event links.</div><div class="ll-add-grid"><button class="ll-button" data-action="add-source" data-source-type="espn">Add ESPN game</button><button class="ll-button" data-action="add-source" data-source-type="kalshi">Add Kalshi market or game</button><button class="ll-button" data-action="add-source" data-source-type="kalshiAccount">Add Kalshi portfolio</button></div>${draft}${saved || (!draft ? '<div class="ll-empty">Add a source above.</div>' : "")}`;
  }

  function layoutsPageMarkup() {
    const cards = state.layouts.map((layout) => {
      const active = layout.id === state.activeLayoutId;
      const count = Array.isArray(layout.widgets) ? layout.widgets.filter((widget) => widget.visible !== false).length : 0;
      return `<div class="ll-layout-card ${active ? "active" : ""}"><div><div class="ll-widget-name">${escapeHtml(layout.name)}</div><div class="ll-widget-meta">${escapeHtml(count)} visible widget${count === 1 ? "" : "s"}${active ? " · last applied" : ""}</div></div><div class="ll-card-actions"><button class="ll-button" data-action="apply-layout" data-layout-id="${escapeHtml(layout.id)}">Apply</button><button class="ll-button ll-icon" data-action="update-layout" data-layout-id="${escapeHtml(layout.id)}" title="Replace with current layout">↻</button><button class="ll-button ll-icon" data-action="rename-layout" data-layout-id="${escapeHtml(layout.id)}" title="Rename">✎</button><button class="ll-button ll-icon danger" data-action="delete-layout" data-layout-id="${escapeHtml(layout.id)}" title="Delete">×</button></div></div>`;
    }).join("");
    return `<div class="ll-page-title">Layouts</div><div class="ll-page-subtitle">A layout saves widget visibility, placement, size, targets, and styling. Your source links stay connected separately.</div><div class="ll-source-box"><div class="ll-field"><label>Layout name</label><input id="ll-layout-name" class="ll-input" placeholder="Sunday games"></div><button class="ll-button primary" data-action="save-layout">Save current layout</button></div>${cards ? `<div class="ll-layout-list">${cards}</div>` : '<div class="ll-empty">No layouts saved yet.</div>'}`;
  }

  function renderPanel() {
    let panel = stage.querySelector("#ll-panel");
    if (!panelOpen) {
      panel?.remove();
      return;
    }
    if (!panel) {
      panel = document.createElement("section");
      panel.id = "ll-panel";
      stage.append(panel);
      panel.addEventListener("click", onPanelClick);
      panel.addEventListener("input", onPanelInput);
    }

    const pageBody = panelPage === "links" ? linksPageMarkup() : panelPage === "layouts" ? layoutsPageMarkup() : panelPage === "edit" ? editorMarkup() : widgetPageMarkup();
    const headActions = panelPage === "widgets"
      ? `<button class="ll-button" data-action="open-links">Links</button><button class="ll-button" data-action="toggle-fullscreen">Full screen</button><button class="ll-button ${editMode ? "active" : ""}" data-action="toggle-arrange">${editMode ? "Done" : "Arrange"}</button>`
      : `<button class="ll-button" data-action="back-widgets">Back to widgets</button>`;
    panel.innerHTML = `<div class="ll-panel-head"><div class="ll-brand">Live<span>Layer</span></div><div class="ll-head-actions">${headActions}<button class="ll-button ll-icon" data-action="close-panel">×</button></div></div><div class="ll-panel-body">${pageBody}</div>`;
    if (panelPage === "widgets") panelPresetSignature = widgetPresetSignature();
  }

  function newWidget(type) {
    const count = state.widgets.length;
    return {
      id: id(),
      type,
      name: "",
      text: type === "text" ? "" : undefined,
      fields: [],
      bet: type === "kalshi" ? { side: "yes", entryPrice: "", contracts: "" } : undefined,
      refreshSeconds: type === "text" ? 0 : type === "kalshiAccount" ? 2 : 5,
      position: { x: 4 + (count % 3) * 5, y: 7 + (count % 4) * 10 },
      style: { color: state.settings.textColor, accentColor: state.settings.accentColor, fontSize: 18, width: 310, height: 0, visualStyle: "transparent", blockSize: "auto", backgroundOpacity: state.settings.backgroundOpacity, textOpacity: 1, shadow: true, alignment: "left", fontFamily: state.settings.fontFamily, customCss: "" },
      display: { showHeading: false, showSourceTitle: type === "kalshi" },
      card: { mode: "broadcast", title: "", subtitle: "", current: "", currentMode: "row", target: "", unit: "", showProgress: true, showDetails: true, showHeaders: true, showPlayerNumber: false, espnSourceId: "", espnCategoryKey: "", espnAthleteId: "", espnAthleteName: "", espnStatLabel: "", espnStatPart: "" },
      visible: true
    };
  }

  function newPresetWidget(source, preset) {
    return {
      ...newWidget(source.type),
      sourceId: source.id,
      presetKey: preset.key,
      fields: [...preset.fields],
      accountItemKey: preset.accountItemKey,
      accountItemText: preset.accountItemText,
      marketTicker: preset.marketTicker,
      player: preset.player ? { ...preset.player } : undefined,
      style: { ...newWidget(source.type).style, visualStyle: preset.visualStyle || "transparent", blockSize: preset.blockSize || "auto" }
    };
  }

  function espnPlayerCandidates() {
    return state.sources.filter((source) => source.type === "espn").flatMap((source) => {
      const data = sourceLive.get(source.id)?.data;
      return (data?.playerStats || []).flatMap((category) => (category.athletes || []).map((athlete) => ({
        sourceId: source.id,
        categoryKey: category.key,
        categoryLabel: category.label,
        athleteId: athlete.id || "",
        athleteName: athlete.name,
        labels: category.labels || []
      })));
    });
  }

  function configurePortfolioWidget(widget, item) {
    if (widget.autoMappingLocked) return false;
    const before = JSON.stringify({ card: widget.card, autoMatch: widget.autoMatch });
    const match = inferPlayerProp(`${item.title || ""} ${item.text || ""}`, espnPlayerCandidates());
    widget.card = {
      ...widget.card,
      title: widget.card?.title || item.title || "Kalshi bet",
      target: widget.card?.target || match.target,
      unit: widget.card?.unit || match.unit,
      showProgress: true,
      showDetails: true
    };
    if (match.matched) {
      widget.card = {
        ...widget.card,
        currentMode: "espn",
        espnSourceId: match.sourceId,
        espnCategoryKey: match.categoryKey,
        espnAthleteId: match.athleteId,
        espnAthleteName: match.athleteName,
        espnStatLabel: match.statLabel,
        espnStatPart: match.statPart
      };
      widget.autoMatch = { status: "matched", label: `${match.athleteName} · ${match.statLabel}`, confidence: match.confidence };
    } else {
      widget.card.currentMode = "manual";
      widget.card.current = "";
      widget.autoMatch = { status: "needs-match", label: "Choose the ESPN player and stat", confidence: 0 };
    }
    return before !== JSON.stringify({ card: widget.card, autoMatch: widget.autoMatch });
  }

  function placeImportedWidgets(widgets) {
    if (!widgets.length) return;
    const occupied = occupiedWidgetRects();
    for (const widget of widgets) {
      const width = 320;
      const height = 160;
      const placement = findOpenPlacement({
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        width,
        height,
        occupied,
        gap: ARRANGE_GAP,
        gridSize: ARRANGE_GRID_SIZE,
        margin: 32
      });
      widget.position = toPercentPosition(placement.left, placement.top, window.innerWidth, window.innerHeight);
      occupied.push({ left: placement.left, top: placement.top, right: placement.left + width, bottom: placement.top + height });
    }
  }

  function syncAccountBetWidgets() {
    let changed = false;
    const created = [];
    for (const source of state.sources.filter((item) => item.type === "kalshiAccount")) {
      const data = sourceLive.get(source.id)?.data;
      if (!data?.connected || data.authenticated === false || !data.items?.length) continue;
      source.importedAccountItemKeys = Array.isArray(source.importedAccountItemKeys) ? source.importedAccountItemKeys : [];
      const importedKeys = new Set(source.importedAccountItemKeys);
      for (const item of data.items) {
        const presetKey = `account-item-${item.key}`;
        let widget = state.widgets.find((entry) => entry.sourceId === source.id && (entry.accountItemKey === item.key || entry.presetKey === presetKey));
        if (!widget && !importedKeys.has(item.key)) {
          widget = newPresetWidget(source, { key: presetKey, fields: ["accountItem"], accountItemKey: item.key, accountItemText: item.text });
          widget.visible = true;
          widget.autoGenerated = true;
          widget.style = { ...widget.style, visualStyle: "card", blockSize: "wide" };
          state.widgets.push(widget);
          source.importedAccountItemKeys.push(item.key);
          importedKeys.add(item.key);
          created.push(widget);
          changed = true;
        }
        if (widget && !widget.card?.espnSourceId && configurePortfolioWidget(widget, item)) changed = true;
      }
    }
    placeImportedWidgets(created);
    if (created.length) {
      editMode = true;
      arrangeFocusId = created[0].id;
      panelPage = "widgets";
      state.ui.selectedSourceId = created[0].sourceId;
    }
    return { changed, created };
  }

  function startEditor(widget, isNew) {
    sourceEditor = null;
    const draft = structuredClone(widget);
    draft.display = { showHeading: false, showSourceTitle: draft.type === "kalshi", ...(draft.display || {}) };
    draft.style = { ...newWidget(draft.type).style, ...(draft.style || {}) };
    draft.card = { ...newWidget(draft.type).card, ...(draft.card || {}) };
    draft.numberStyle = { ...state.settings.numberStyle, ...(draft.numberStyle || {}) };
    editor = { widget: draft, isNew, message: "", error: false };
    panelPage = "edit";
    render();
  }

  function playerEditorMarkup(widget) {
    const field = widget.fields?.find((item) => item.startsWith("playerCategory:"));
    if (!field) return "";
    const categoryKey = field.slice("playerCategory:".length).toLowerCase();
    const source = sourceForWidget(widget);
    const data = sourceLive.get(source?.id)?.data;
    const categories = (data?.playerStats || []).filter((category) => `${category.key} ${category.label}`.toLowerCase().includes(categoryKey));
    const athletes = categories.flatMap((category) => category.athletes.map((athlete) => ({ ...athlete, team: category.team, labels: category.labels })));
    const labels = [...new Set(categories.flatMap((category) => category.labels || []))];
    return `<div class="ll-section-title">Player stat</div><div class="ll-field"><label>Player</label><select class="ll-input" name="athleteId">${athletes.map((athlete) => `<option value="${escapeHtml(athlete.id || athlete.name)}" ${athlete.id === widget.player?.athleteId || (!athlete.id && athlete.name === widget.player?.athleteName) ? "selected" : ""}>${escapeHtml(`${athlete.jersey ? `#${athlete.jersey} ` : ""}${athlete.name} | ${athlete.team}`)}</option>`).join("")}</select></div><div class="ll-field"><label>Stat shown</label><select class="ll-input" name="statLabel">${labels.map((label) => `<option value="${escapeHtml(label)}" ${label === widget.player?.statLabel ? "selected" : ""}>${escapeHtml(label)}</option>`).join("")}</select></div><label class="ll-toggle"><input type="checkbox" name="showPlayerNumber" ${widget.player?.showNumber ? "checked" : ""}> Show player number before the name</label><div class="ll-field"><label>Card title</label><input class="ll-input" name="cardTitle" value="${escapeHtml(widget.card?.title || "")}" placeholder="Uses the player name"></div><div class="ll-row"><div class="ll-field" style="flex:1"><label>Target</label><input class="ll-input" name="cardTarget" value="${escapeHtml(widget.card?.target || "")}" placeholder="500"></div><div class="ll-field" style="flex:1"><label>Unit</label><input class="ll-input" name="cardUnit" value="${escapeHtml(widget.card?.unit || "")}" placeholder="yards"></div></div><label class="ll-toggle"><input type="checkbox" name="showProgress" ${widget.card?.showProgress === false ? "" : "checked"}> Progress bar when a target is set</label><label class="ll-toggle"><input type="checkbox" name="showDetails" ${widget.card?.showDetails === false ? "" : "checked"}> Team and category detail</label>`;
  }

  function accountItemEditorMarkup(widget) {
    if (!widget.accountItemKey) return "";
    const autoMatchNote = widget.autoMatch?.status === "matched"
      ? `<div class="ll-preview">Automatically matched to ${escapeHtml(widget.autoMatch.label)}. Change the player or stat below to override it.</div>`
      : widget.autoMatch?.status === "manual"
        ? `<div class="ll-preview">Using your manual ESPN player and stat mapping.</div>`
      : `<div class="ll-preview error">This bet has not been matched to a live ESPN player stat yet. Choose the player and stat below, or connect the relevant ESPN game.</div>`;
    const espnOptions = state.sources.filter((source) => source.type === "espn").flatMap((source) => {
      const data = sourceLive.get(source.id)?.data;
      return (data?.playerStats || []).flatMap((category) => category.athletes.map((athlete) => ({ source, category, athlete })));
    });
    const playerOptions = espnOptions.map(({ source, category, athlete }) => {
      const value = `${source.id}::${category.key}::${athlete.id || athlete.name}`;
      const selected = source.id === widget.card?.espnSourceId && category.key === widget.card?.espnCategoryKey && (athlete.id === widget.card?.espnAthleteId || athlete.name === widget.card?.espnAthleteName);
      return `<option value="${escapeHtml(value)}" ${selected ? "selected" : ""}>${escapeHtml(`${athlete.name} | ${category.team} ${category.label}`)}</option>`;
    }).join("");
    const statLabels = [...new Set(espnOptions.flatMap(({ category }) => category.labels || []))];
    const statOptions = statLabels.map((label) => `<option value="${escapeHtml(label)}" ${label === widget.card?.espnStatLabel ? "selected" : ""}>${escapeHtml(label)}</option>`).join("");
    return `<div class="ll-section-title">Position or order card</div>${autoMatchNote}<div class="ll-field"><label>Layout</label><select class="ll-input" name="cardMode"><option value="broadcast" ${widget.card?.mode !== "table" ? "selected" : ""}>Broadcast stat card</option><option value="table" ${widget.card?.mode === "table" ? "selected" : ""}>Table row</option></select></div><div class="ll-field"><label>Card title</label><input class="ll-input" name="cardTitle" value="${escapeHtml(widget.card?.title || "")}" placeholder="Uses the position title"></div><div class="ll-field"><label>Detail line</label><input class="ll-input" name="cardSubtitle" value="${escapeHtml(widget.card?.subtitle || "")}" placeholder="Uses the live row or ESPN player"></div><div class="ll-field"><label>Current value source</label><select class="ll-input" name="cardCurrentMode"><option value="row" ${!widget.card?.currentMode || widget.card?.currentMode === "row" ? "selected" : ""}>Infer from live Kalshi row</option><option value="manual" ${widget.card?.currentMode === "manual" ? "selected" : ""}>Manual value</option><option value="espn" ${widget.card?.currentMode === "espn" ? "selected" : ""}>Live ESPN player stat</option></select></div><div class="ll-field"><label>ESPN player</label><select class="ll-input" name="cardEspnPlayer"><option value="">Choose a player statistic</option>${playerOptions}</select>${espnOptions.length ? "" : '<div class="ll-note">Save an ESPN game link first to bind this card to a live player stat.</div>'}</div><div class="ll-field"><label>ESPN stat</label><select class="ll-input" name="cardEspnStatLabel"><option value="">Choose a stat</option>${statOptions}</select></div><div class="ll-row"><div class="ll-field" style="flex:1"><label>Manual current</label><input class="ll-input" name="cardCurrent" value="${escapeHtml(widget.card?.current ?? "")}" placeholder="376"></div><div class="ll-field" style="flex:1"><label>Target</label><input class="ll-input" name="cardTarget" value="${escapeHtml(widget.card?.target || "")}" placeholder="500"></div><div class="ll-field" style="flex:1"><label>Unit</label><input class="ll-input" name="cardUnit" value="${escapeHtml(widget.card?.unit || "")}" placeholder="yards"></div></div><label class="ll-toggle"><input type="checkbox" name="showPlayerNumber" ${widget.card?.showPlayerNumber ? "checked" : ""}> Show ESPN player number when available</label><label class="ll-toggle"><input type="checkbox" name="showProgress" ${widget.card?.showProgress === false ? "" : "checked"}> Progress bar</label><label class="ll-toggle"><input type="checkbox" name="showDetails" ${widget.card?.showDetails === false ? "" : "checked"}> Detail line</label><label class="ll-toggle"><input type="checkbox" name="showHeaders" ${widget.card?.showHeaders === false ? "" : "checked"}> Table headers</label>`;
  }

  function genericTargetEditorMarkup(widget) {
    const hasPlayerCard = widget.fields?.some((field) => field.startsWith("playerCategory:"));
    if (widget.type === "text" || widget.accountItemKey || hasPlayerCard) return "";
    return `<div class="ll-section-title">Target progress</div><div class="ll-row"><div class="ll-field" style="flex:1"><label>Target</label><input class="ll-input" name="cardTarget" value="${escapeHtml(widget.card?.target || "")}" placeholder="4"></div><div class="ll-field" style="flex:1"><label>Unit, optional</label><input class="ll-input" name="cardUnit" value="${escapeHtml(widget.card?.unit || "")}" placeholder="turnovers"></div></div><label class="ll-toggle"><input type="checkbox" name="showProgress" ${widget.card?.showProgress === false ? "" : "checked"}> Show progress bar when a numeric live value is available</label><div class="ll-note">Leave Target blank to hide the bar. At the target, the bar reaches 100% and uses the widget accent color.</div>`;
  }

  function numberColorEditorMarkup(widget) {
    if (widget.type === "text") return "";
    const numberStyle = numberStyleFor(widget);
    return `<div class="ll-section-title">Number color</div><div class="ll-field"><label>Formatting</label><select class="ll-input" name="numberColorMode"><option value="inherit" ${numberStyle.mode === "inherit" ? "selected" : ""}>Match widget text</option><option value="solid" ${numberStyle.mode === "solid" ? "selected" : ""}>One color</option><option value="spectrum" ${numberStyle.mode === "spectrum" ? "selected" : ""}>Spectrum toward target</option><option value="threshold" ${numberStyle.mode === "threshold" ? "selected" : ""}>Switch color at target</option></select></div><div class="ll-color-grid"><label class="ll-color-field">Solid<input name="numberSolidColor" type="color" value="${escapeHtml(numberStyle.solidColor)}"></label><label class="ll-color-field">Far away<input name="numberFarColor" type="color" value="${escapeHtml(numberStyle.farColor)}"></label><label class="ll-color-field">Near target<input name="numberNearColor" type="color" value="${escapeHtml(numberStyle.nearColor)}"></label><label class="ll-color-field">Target reached<input name="numberReachedColor" type="color" value="${escapeHtml(numberStyle.reachedColor)}"></label></div><div class="ll-note">Spectrum and target-switch colors use the widget target. Pick any direction, including red to green or green to red.</div>`;
  }

  function editorMarkup() {
    if (!editor) return '<div class="ll-empty">No widget is selected.</div>';
    const widget = editor.widget;
    const style = widget.style || {};
    const source = sourceForWidget(widget);
    const isTeamStat = widget.fields?.some((field) => field.startsWith("teamStat:"));
    const specificSettings = widget.type === "text"
      ? `<div class="ll-field"><label>Text</label><textarea class="ll-input" name="text" placeholder="Type anything">${escapeHtml(widget.text || "")}</textarea></div>`
      : widget.type === "kalshi" && widget.fields?.includes("bet")
        ? `<div class="ll-row"><div class="ll-field" style="flex:1"><label>Side</label><select class="ll-input" name="betSide"><option value="yes" ${widget.bet?.side !== "no" ? "selected" : ""}>YES</option><option value="no" ${widget.bet?.side === "no" ? "selected" : ""}>NO</option></select></div><div class="ll-field" style="flex:1"><label>Entry, cents</label><input class="ll-input" name="entryPrice" type="number" min="0" max="100" step="0.1" value="${escapeHtml(widget.bet?.entryPrice ?? "")}"></div><div class="ll-field" style="flex:1"><label>Contracts</label><input class="ll-input" name="contracts" type="number" min="0" step="0.01" value="${escapeHtml(widget.bet?.contracts ?? "")}"></div></div>`
        : "";
    const refreshOptions = [.5, 1, 2, 5, 10, 15, 30, 60, 120].map((seconds) => `<option value="${seconds}" ${Number(widget.refreshSeconds) === seconds ? "selected" : ""}>${seconds === .5 ? "0.5 second" : `${seconds} seconds`}</option>`).join("");
    return `<div class="ll-page-title">Edit widget</div><div class="ll-page-subtitle">Every change updates the overlay and saves automatically.</div><form id="ll-editor" class="ll-form">
      ${source ? `<div class="ll-note">Data source: ${escapeHtml(source.name || source.connectedLabel || sourceTypeLabel(source.type))}</div>` : ""}
      <div class="ll-section-title">Heading</div><label class="ll-toggle"><input type="checkbox" name="showHeading" ${widget.display?.showHeading ? "checked" : ""}> Show heading</label><div class="ll-field"><label>Heading text</label><input class="ll-input" name="name" value="${escapeHtml(widget.name || "")}" placeholder="Type any heading"></div>
      ${widget.type !== "text" ? `<label class="ll-toggle"><input type="checkbox" name="showSourceTitle" ${widget.display?.showSourceTitle ? "checked" : ""}> Show source or market title</label>` : ""}
      ${specificSettings}${isTeamStat ? `<div class="ll-field"><label>Teams shown</label><select class="ll-input" name="teamSide"><option value="both" ${!widget.teamSide || widget.teamSide === "both" ? "selected" : ""}>Both teams</option><option value="away" ${widget.teamSide === "away" ? "selected" : ""}>Away team</option><option value="home" ${widget.teamSide === "home" ? "selected" : ""}>Home team</option></select></div>` : ""}${playerEditorMarkup(widget)}${accountItemEditorMarkup(widget)}${genericTargetEditorMarkup(widget)}${numberColorEditorMarkup(widget)}
      ${widget.type !== "text" ? `<div class="ll-field"><label>Refresh rate</label><select class="ll-input" name="refreshSeconds">${refreshOptions}</select><div class="ll-note">Half-second refresh is aggressive and may be rate-limited by ESPN, Kalshi, or the browser.</div></div>` : ""}
      <div class="ll-section-title">Layer size and style</div><div class="ll-row"><div class="ll-field" style="flex:1"><label>Visual style</label><select class="ll-input" name="visualStyle"><option value="transparent" ${!style.visualStyle || style.visualStyle === "transparent" ? "selected" : ""}>Transparent</option><option value="card" ${style.visualStyle === "card" ? "selected" : ""}>Soft card</option><option value="square" ${style.visualStyle === "square" ? "selected" : ""}>Square stat</option><option value="scorebug" ${style.visualStyle === "scorebug" ? "selected" : ""}>Score bug</option><option value="block" ${style.visualStyle === "block" ? "selected" : ""}>Block</option><option value="marketChart" ${style.visualStyle === "marketChart" ? "selected" : ""}>Market chart</option></select></div><div class="ll-field" style="flex:1"><label>Block size</label><select class="ll-input" name="blockSize"><option value="auto" ${!style.blockSize || style.blockSize === "auto" ? "selected" : ""}>Custom / auto</option><option value="smallSquare" ${style.blockSize === "smallSquare" ? "selected" : ""}>Square 160 × 160</option><option value="wide" ${style.blockSize === "wide" ? "selected" : ""}>Wide 320 × 160</option><option value="largeSquare" ${style.blockSize === "largeSquare" ? "selected" : ""}>Large 320 × 320</option><option value="banner" ${style.blockSize === "banner" ? "selected" : ""}>Banner 480 × 160</option></select></div></div><div class="ll-row"><div class="ll-field" style="flex:1"><label>Width</label><input class="ll-input" name="width" type="number" min="120" max="720" value="${escapeHtml(style.width || 310)}"></div><div class="ll-field" style="flex:1"><label>Height</label><input class="ll-input" name="height" type="number" min="0" max="720" value="${escapeHtml(style.height || 0)}"><div class="ll-note">0 uses automatic height</div></div><div class="ll-field" style="flex:1"><label>Font size</label><input class="ll-input" name="fontSize" type="number" min="11" max="54" value="${escapeHtml(style.fontSize || 18)}"></div></div><div class="ll-note">Fixed block sizes use the same 160-pixel system, so they snap together cleanly in Arrange mode.</div>
      <div class="ll-section-title">Appearance</div><div class="ll-row"><div class="ll-field" style="flex:1"><label>Text color</label><input name="color" type="color" value="${escapeHtml(style.color || state.settings.textColor)}"></div><div class="ll-field" style="flex:1"><label>Accent</label><input name="accentColor" type="color" value="${escapeHtml(style.accentColor || state.settings.accentColor)}"></div></div>
      <div class="ll-field"><label>Font</label><select class="ll-input" name="fontFamily"><option value="Inter, ui-sans-serif, system-ui, sans-serif" ${String(style.fontFamily || "").startsWith("Inter") ? "selected" : ""}>Inter / system</option><option value="Arial, Helvetica, sans-serif" ${String(style.fontFamily || "").startsWith("Arial") ? "selected" : ""}>Arial</option><option value="Roboto, Arial, sans-serif" ${String(style.fontFamily || "").startsWith("Roboto") ? "selected" : ""}>Roboto</option><option value="Montserrat, Arial, sans-serif" ${String(style.fontFamily || "").startsWith("Montserrat") ? "selected" : ""}>Montserrat</option><option value="Georgia, serif" ${String(style.fontFamily || "").startsWith("Georgia") ? "selected" : ""}>Georgia</option><option value="ui-monospace, SFMono-Regular, Consolas, monospace" ${String(style.fontFamily || "").startsWith("ui-monospace") ? "selected" : ""}>Monospace</option></select></div>
      <div class="ll-field"><label>Text opacity: <span id="ll-text-opacity-label">${Math.round(Number(style.textOpacity ?? 1) * 100)}</span>%</label><input name="textOpacity" type="range" min="5" max="100" step="5" value="${Math.round(Number(style.textOpacity ?? 1) * 100)}"></div><div class="ll-field"><label>Background opacity: <span id="ll-opacity-label">${Math.round((Number(style.backgroundOpacity) || 0) * 100)}</span>%</label><input name="backgroundOpacity" type="range" min="0" max="90" step="5" value="${Math.round((Number(style.backgroundOpacity) || 0) * 100)}"></div>
      <div class="ll-row ll-space"><label class="ll-toggle"><input type="checkbox" name="shadow" ${style.shadow === false ? "" : "checked"}> Text drop shadow</label><select class="ll-input" name="alignment" style="width:120px"><option value="left" ${style.alignment !== "center" && style.alignment !== "right" ? "selected" : ""}>Left</option><option value="center" ${style.alignment === "center" ? "selected" : ""}>Center</option><option value="right" ${style.alignment === "right" ? "selected" : ""}>Right</option></select></div>
      <div class="ll-field"><label>Custom CSS declarations</label><textarea class="ll-input ll-code" name="customCss" placeholder="border-radius: 0; letter-spacing: 1px;">${escapeHtml(style.customCss || "")}</textarea><div class="ll-note">Declarations apply only to this widget container. Bad CSS can make the widget hard to recover.</div></div>
      ${editor.message ? `<div class="ll-preview ${editor.error ? "error" : ""}">${escapeHtml(editor.message)}</div>` : ""}<div class="ll-preview">Saved automatically. Use Back to widgets when you are finished.</div></form>`;
  }

  function collectDraft() {
    const form = stage.querySelector("#ll-editor");
    if (!form || !editor) return null;
    const data = new FormData(form);
    const draft = structuredClone(editor.widget);
    draft.name = String(data.get("name") || "").trim();
    draft.text = draft.type === "text" ? String(data.get("text") || "").trim() : draft.text;
    draft.refreshSeconds = draft.type === "text" ? 0 : clamp(Number(data.get("refreshSeconds")) || 5, .5, 120);
    draft.display = {
      ...(draft.display || {}),
      showHeading: data.get("showHeading") === "on",
      showSourceTitle: form.elements.namedItem("showSourceTitle") ? data.get("showSourceTitle") === "on" : false
    };
    draft.style = {
      color: String(data.get("color") || state.settings.textColor),
      accentColor: String(data.get("accentColor") || state.settings.accentColor),
      fontSize: clamp(Number(data.get("fontSize")) || 18, 11, 54),
      width: clamp(Number(data.get("width")) || 310, 120, 720),
      height: clamp(Number(data.get("height")) || 0, 0, 720),
      visualStyle: ["transparent", "card", "square", "scorebug", "block", "marketChart"].includes(data.get("visualStyle")) ? data.get("visualStyle") : "transparent",
      blockSize: ["smallSquare", "wide", "largeSquare", "banner"].includes(data.get("blockSize")) ? data.get("blockSize") : "auto",
      backgroundOpacity: clamp((Number(data.get("backgroundOpacity")) || 0) / 100, 0, .9),
      textOpacity: clamp((Number(data.get("textOpacity")) || 100) / 100, .05, 1),
      shadow: data.get("shadow") === "on",
      alignment: ["left", "center", "right"].includes(data.get("alignment")) ? data.get("alignment") : "left",
      fontFamily: String(data.get("fontFamily") || state.settings.fontFamily),
      customCss: String(data.get("customCss") || "").trim()
    };
    if (form.elements.namedItem("numberColorMode")) {
      draft.numberStyle = {
        mode: ["inherit", "solid", "spectrum", "threshold"].includes(data.get("numberColorMode")) ? data.get("numberColorMode") : "inherit",
        solidColor: String(data.get("numberSolidColor") || state.settings.numberStyle.solidColor),
        farColor: String(data.get("numberFarColor") || state.settings.numberStyle.farColor),
        nearColor: String(data.get("numberNearColor") || state.settings.numberStyle.nearColor),
        reachedColor: String(data.get("numberReachedColor") || state.settings.numberStyle.reachedColor)
      };
    }
    if (draft.type === "kalshi" && draft.fields?.includes("bet")) {
      draft.bet = { side: data.get("betSide") === "no" ? "no" : "yes", entryPrice: String(data.get("entryPrice") || ""), contracts: String(data.get("contracts") || "") };
    }
    if (form.elements.namedItem("teamSide")) draft.teamSide = ["away", "home"].includes(data.get("teamSide")) ? data.get("teamSide") : "both";
    if (form.elements.namedItem("athleteId")) {
      const selected = String(data.get("athleteId") || "");
      const source = sourceForWidget(draft);
      const categories = sourceLive.get(source?.id)?.data?.playerStats || [];
      const athlete = categories.flatMap((category) => category.athletes || []).find((item) => item.id === selected || item.name === selected);
      draft.player = { athleteId: athlete?.id || "", athleteName: athlete?.name || selected, statLabel: String(data.get("statLabel") || ""), showNumber: data.get("showPlayerNumber") === "on" };
    }
    if (form.elements.namedItem("cardMode") || form.elements.namedItem("cardTarget")) {
      const currentMode = ["manual", "espn"].includes(data.get("cardCurrentMode")) ? data.get("cardCurrentMode") : "row";
      const bindingValue = String(data.get("cardEspnPlayer") || "");
      const [espnSourceId, espnCategoryKey, espnAthleteValue] = bindingValue.split("::");
      const espnData = sourceLive.get(espnSourceId)?.data;
      const espnCategory = (espnData?.playerStats || []).find((category) => category.key === espnCategoryKey);
      const espnAthlete = (espnCategory?.athletes || []).find((athlete) => athlete.id === espnAthleteValue || athlete.name === espnAthleteValue);
      const hasPlayerBindingControl = Boolean(form.elements.namedItem("cardEspnPlayer"));
      const selectedEspnStatLabel = form.elements.namedItem("cardEspnStatLabel") ? String(data.get("cardEspnStatLabel") || draft.card?.espnStatLabel || "") : draft.card?.espnStatLabel || "";
      draft.card = {
        ...(draft.card || {}),
        mode: data.get("cardMode") === "table" ? "table" : "broadcast",
        title: String(data.get("cardTitle") || "").trim(),
        subtitle: String(data.get("cardSubtitle") || "").trim(),
        current: String(data.get("cardCurrent") || "").trim(),
        currentMode,
        target: String(data.get("cardTarget") || "").trim(),
        unit: String(data.get("cardUnit") || "").trim(),
        showProgress: form.elements.namedItem("showProgress") ? data.get("showProgress") === "on" : draft.card?.showProgress !== false,
        showDetails: form.elements.namedItem("showDetails") ? data.get("showDetails") === "on" : draft.card?.showDetails !== false,
        showHeaders: form.elements.namedItem("showHeaders") ? data.get("showHeaders") === "on" : draft.card?.showHeaders !== false,
        showPlayerNumber: form.elements.namedItem("showPlayerNumber") ? data.get("showPlayerNumber") === "on" : Boolean(draft.card?.showPlayerNumber),
        espnSourceId: hasPlayerBindingControl ? (bindingValue ? espnSourceId : "") : draft.card?.espnSourceId || "",
        espnCategoryKey: hasPlayerBindingControl ? (bindingValue ? espnCategoryKey : "") : draft.card?.espnCategoryKey || "",
        espnAthleteId: hasPlayerBindingControl ? (bindingValue ? espnAthlete?.id || "" : "") : draft.card?.espnAthleteId || "",
        espnAthleteName: hasPlayerBindingControl ? (bindingValue ? espnAthlete?.name || espnAthleteValue || "" : "") : draft.card?.espnAthleteName || "",
        espnStatLabel: selectedEspnStatLabel,
        espnStatPart: selectedEspnStatLabel === draft.card?.espnStatLabel ? draft.card?.espnStatPart || "" : ""
      };
    }
    return draft;
  }

  async function checkSourceEditor(sourceId) {
    const source = collectSourceDraft(sourceId);
    if (!source) return { ok: false };
    const currentEditor = { source, isNew: !sourceById(sourceId), preview: sourceEditor?.source?.id === sourceId ? sourceEditor.preview : null, message: "Checking live source…", error: false };
    sourceEditor = currentEditor;
    renderPanel();
    try {
      const response = await chrome.runtime.sendMessage({ type: "LIVELAYER_FETCH_WIDGET", widget: { type: source.type, sourceInput: source.input, sourceMeta: source.meta || {} } });
      if (sourceEditor !== currentEditor) return { ok: false, canceled: true };
      if (!response?.ok) throw new Error(response?.error || "The source could not be loaded.");
      currentEditor.preview = response.data;
      if (response.data.kind === "scoreboard") {
        currentEditor.source.meta = {};
        currentEditor.message = response.data.choices.length ? "Choose a game, then save the source." : "No games were returned for that scoreboard and date.";
        currentEditor.error = !response.data.choices.length;
        renderPanel();
        return { ok: false, needsChoice: Boolean(response.data.choices.length) };
      } else if (response.data.kind === "game") {
        currentEditor.source.meta = response.data.source;
        currentEditor.source.connectedLabel = response.data.teams.map((team) => team.abbreviation).join(" vs. ");
        currentEditor.message = `${currentEditor.source.connectedLabel} loaded successfully.`;
      } else if (response.data.kind === "market") {
        currentEditor.source.meta = { ticker: response.data.ticker };
        currentEditor.source.connectedLabel = response.data.title;
        currentEditor.message = `${response.data.title} loaded successfully.`;
      } else if (response.data.kind === "event") {
        currentEditor.source.meta = { eventTicker: response.data.eventTicker };
        currentEditor.source.connectedLabel = response.data.title;
        currentEditor.message = `${response.data.title} loaded with ${response.data.markets.length} separate market${response.data.markets.length === 1 ? "" : "s"}.`;
      } else if (response.data.kind === "account") {
        currentEditor.source.meta = response.data.source;
        currentEditor.source.connectedLabel = response.data.title || "Kalshi account";
        currentEditor.message = response.data.connected
          ? `Connected to ${response.data.title || "the open Kalshi account page"}.`
          : "Link accepted. Open that Kalshi page in another tab and stay logged in for live updates.";
      }
      const previousRecord = sourceLive.get(source.id) || {};
      sourceLive.set(source.id, { data: response.data, history: appendKalshiHistory(previousRecord.history, response.data), error: "", updatedAt: Date.now(), nextDue: 0 });
      renderPanel();
      return { ok: true, source: currentEditor.source, data: response.data };
    } catch (error) {
      if (sourceEditor !== currentEditor) return { ok: false, canceled: true };
      currentEditor.message = error?.message || "The source could not be loaded.";
      currentEditor.error = true;
      renderPanel();
      return { ok: false };
    }
  }

  async function saveSourceEditor(sourceId) {
    const checked = await checkSourceEditor(sourceId);
    const currentEditor = sourceEditor;
    if (!checked.ok || sourceEditor !== currentEditor) return;
    const source = structuredClone(currentEditor.source);
    const index = state.sources.findIndex((item) => item.id === source.id);
    if (index >= 0) state.sources[index] = source;
    else state.sources.push(source);
    for (const widget of state.widgets.filter((item) => item.sourceId === source.id)) live.delete(widget.id);
    const imported = syncAccountBetWidgets();
    sourceEditor = null;
    await saveState();
    render();
    if (source.type === "kalshiAccount" && checked.data?.connected === false) {
      chrome.runtime.sendMessage({ type: "LIVELAYER_OPEN_KALSHI_PAGE", url: source.input }).catch(() => null);
      showToast("Kalshi portfolio opened. Log in and leave that tab open while LiveLayer imports your bets.");
    } else if (imported.created.length) {
      showToast(`Imported ${imported.created.length} Kalshi bet widget${imported.created.length === 1 ? "" : "s"}.`);
    }
    tick(true);
  }

  function autoSaveEditor(draft) {
    if (!draft) return;
    if (draft.accountItemKey && editor?.widget) {
      const fields = ["currentMode", "target", "unit", "espnSourceId", "espnCategoryKey", "espnAthleteId", "espnAthleteName", "espnStatLabel", "espnStatPart"];
      const before = JSON.stringify(Object.fromEntries(fields.map((field) => [field, editor.widget.card?.[field] ?? ""])));
      const after = JSON.stringify(Object.fromEntries(fields.map((field) => [field, draft.card?.[field] ?? ""])));
      if (before !== after) {
        draft.autoMappingLocked = true;
        draft.autoMatch = { status: "manual", label: "Manual ESPN mapping", confidence: 100 };
      }
    }
    const index = state.widgets.findIndex((item) => item.id === draft.id);
    if (index >= 0) state.widgets[index] = draft;
    else state.widgets.push(draft);
    live.delete(draft.id);
    editor.widget = draft;
    editor.isNew = false;
    clearTimeout(editorSaveTimer);
    editorSaveTimer = setTimeout(() => {
      saveState();
      tick(true);
    }, 120);
  }

  async function onPanelClick(event) {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const action = button.dataset.action;
    if (action === "close-panel") { panelOpen = false; editor = null; sourceEditor = null; panelPage = "widgets"; render(); return; }
    if (action === "open-links") { editor = null; sourceEditor = null; panelPage = "links"; render(); return; }
    if (action === "open-layouts") { editor = null; sourceEditor = null; panelPage = "layouts"; render(); return; }
    if (action === "back-widgets") { editor = null; sourceEditor = null; panelPage = "widgets"; render(); return; }
    if (action === "add-source") {
      sourceEditor = { source: newSource(button.dataset.sourceType), isNew: true, preview: null, message: "", error: false };
      renderPanel();
      return;
    }
    if (action === "save-layout") {
      const nameInput = stage.querySelector("#ll-layout-name");
      const name = String(nameInput?.value || "").trim() || `Layout ${state.layouts.length + 1}`;
      const layout = { id: id(), name, widgets: structuredClone(state.widgets), createdAt: Date.now(), updatedAt: Date.now() };
      state.layouts.push(layout);
      state.activeLayoutId = layout.id;
      await saveState();
      renderPanel();
      return;
    }
    if (["apply-layout", "update-layout", "rename-layout", "delete-layout"].includes(action)) {
      const layout = state.layouts.find((item) => item.id === button.dataset.layoutId);
      if (!layout) return;
      if (action === "apply-layout") {
        const sourceIds = new Set(state.sources.map((source) => source.id));
        state.widgets = structuredClone(layout.widgets || []).filter((widget) => widget.type === "text" || !widget.sourceId || sourceIds.has(widget.sourceId));
        state.activeLayoutId = layout.id;
        live.clear();
        await saveState();
        render();
        tick(true);
        return;
      }
      if (action === "update-layout") {
        layout.widgets = structuredClone(state.widgets);
        layout.updatedAt = Date.now();
        state.activeLayoutId = layout.id;
      }
      if (action === "rename-layout") {
        const name = globalThis.prompt("Layout name", layout.name);
        if (name === null || !name.trim()) return;
        layout.name = name.trim();
        layout.updatedAt = Date.now();
      }
      if (action === "delete-layout") {
        if (!globalThis.confirm(`Delete layout “${layout.name}”?`)) return;
        state.layouts = state.layouts.filter((item) => item.id !== layout.id);
        if (state.activeLayoutId === layout.id) state.activeLayoutId = "";
      }
      await saveState();
      renderPanel();
      return;
    }
    if (action === "toggle-arrange") {
      editMode = !editMode;
      if (!editMode) arrangeFocusId = "";
      render();
      return;
    }
    if (action === "toggle-fullscreen") {
      await toggleLiveLayerFullscreen();
      if (document.fullscreenElement) {
        panelOpen = false;
        editor = null;
        sourceEditor = null;
        renderPanel();
      }
      return;
    }
    if (action === "remove-source") {
      const source = state.sources.find((item) => item.id === button.dataset.sourceId);
      if (!source || !globalThis.confirm(`Remove ${source.name || sourceTypeLabel(source.type)} and its widgets?`)) return;
      const removedIds = new Set(state.widgets.filter((widget) => widget.sourceId === source.id).map((widget) => widget.id));
      state.sources = state.sources.filter((item) => item.id !== source.id);
      state.widgets = state.widgets.filter((widget) => widget.sourceId !== source.id);
      if (state.ui.selectedSourceId === source.id) state.ui.selectedSourceId = "all";
      if (removedIds.has(arrangeFocusId)) arrangeFocusId = "";
      for (const widgetId of removedIds) live.delete(widgetId);
      sourceLive.delete(source.id);
      if (sourceEditor?.source?.id === source.id) sourceEditor = null;
      await saveState();
      render();
      return;
    }
    if (action === "check-source") { await checkSourceEditor(button.dataset.sourceId); return; }
    if (action === "save-source") { await saveSourceEditor(button.dataset.sourceId); return; }
    if (action === "open-kalshi-page") {
      const draft = collectSourceDraft(button.dataset.sourceId);
      const response = await chrome.runtime.sendMessage({ type: "LIVELAYER_OPEN_KALSHI_PAGE", url: draft?.input || "" });
      if (!response?.ok) {
        sourceEditor ||= { source: draft, isNew: !sourceById(button.dataset.sourceId), preview: null, message: "", error: false };
        sourceEditor.message = response?.error || "The Kalshi page could not be opened.";
        sourceEditor.error = true;
      } else {
        sourceEditor = { source: draft, isNew: !sourceById(button.dataset.sourceId), preview: null, message: "Kalshi page opened. Log in if needed, leave that tab open, then check the connection.", error: false };
      }
      renderPanel();
      return;
    }
    if (action === "toggle-text" || action === "edit-text") {
      let widget = state.widgets.find((item) => item.type === "text" && item.presetKey === "text-note") || state.widgets.find((item) => item.type === "text");
      if (action === "edit-text") {
        if (!widget) {
          widget = newWidget("text");
          widget.presetKey = "text-note";
        }
        startEditor(widget, !state.widgets.some((item) => item.id === widget.id));
        return;
      }
      let newlyEnabled = false;
      let newlyCreated = false;
      if (widget) {
        widget.visible = widget.visible === false;
        newlyEnabled = widget.visible !== false;
      } else {
        widget = newWidget("text");
        widget.presetKey = "text-note";
        widget.text = "Text note";
        state.widgets.push(widget);
        newlyEnabled = true;
        newlyCreated = true;
      }
      if (newlyEnabled) await arrangeWidgetNow(widget, newlyCreated);
      else { await saveState(); render(); }
      return;
    }
    if (action === "toggle-preset" || action === "edit-preset") {
      const source = state.sources.find((item) => item.id === button.dataset.sourceId);
      const preset = source ? presetsForSource(source).find((item) => item.key === button.dataset.presetKey) : null;
      if (!source || !preset) return;
      let widget = widgetForPreset(source.id, preset.key);
      if (action === "edit-preset") {
        startEditor(widget || newPresetWidget(source, preset), !widget);
        return;
      }
      let newlyEnabled = false;
      let newlyCreated = false;
      if (widget) {
        widget.visible = widget.visible === false;
        live.delete(widget.id);
        newlyEnabled = widget.visible !== false;
      } else {
        widget = newPresetWidget(source, preset);
        state.widgets.push(widget);
        newlyEnabled = true;
        newlyCreated = true;
      }
      if (newlyEnabled) await arrangeWidgetNow(widget, newlyCreated);
      else { await saveState(); render(); }
      tick(true);
      return;
    }
    const widget = state.widgets.find((item) => item.id === button.dataset.id);
    if (!widget) return;
    if (action === "edit-widget") { startEditor(widget, false); return; }
    if (action === "toggle-widget") {
      widget.visible = widget.visible === false;
      if (widget.visible !== false) await arrangeWidgetNow(widget, false);
      else { await saveState(); render(); }
      return;
    }
    if (action === "remove-widget") {
      state.widgets = state.widgets.filter((item) => item.id !== widget.id);
      live.delete(widget.id);
      if (arrangeFocusId === widget.id) arrangeFocusId = "";
      if (editor?.widget?.id === widget.id) editor = null;
      await saveState();
      render();
    }
  }

  async function onPanelInput(event) {
    if (event.target.name === "widgetSourceView") {
      state.ui.selectedSourceId = event.target.value || "all";
      await saveState();
      renderPanel();
      return;
    }
    if (event.target.name === "backgroundOpacity") {
      const label = stage.querySelector("#ll-opacity-label");
      if (label) label.textContent = event.target.value;
    }
    if (event.target.name === "textOpacity") {
      const label = stage.querySelector("#ll-text-opacity-label");
      if (label) label.textContent = event.target.value;
    }
    if (panelPage === "edit" && editor) {
      const draft = collectDraft();
      if (draft) autoSaveEditor(draft);
      renderWidgets();
    }
  }

  function sourceRefreshSeconds(source) {
    const rates = state.widgets
      .filter((widget) => widget.sourceId === source.id && widget.visible !== false)
      .map((widget) => Number(widget.refreshSeconds))
      .filter((value) => Number.isFinite(value) && value >= .5);
    return rates.length ? Math.min(...rates) : source.type === "kalshiAccount" ? 2 : 5;
  }

  function appendKalshiHistory(previousHistory = {}, data) {
    if (!data || !["market", "event"].includes(data.kind)) return previousHistory;
    const next = Object.fromEntries(Object.entries(previousHistory).map(([key, points]) => [key, [...points]]));
    const markets = data.kind === "event" ? data.markets || [] : [data];
    const now = Date.now();
    for (const market of markets) {
      const value = Number(market?.yesPercent);
      if (!market?.ticker || !Number.isFinite(value)) continue;
      const points = next[market.ticker] || [];
      points.push({ time: now, value });
      next[market.ticker] = points.slice(-60);
    }
    return next;
  }

  async function fetchSource(source, force = false) {
    if (!source?.input || !["espn", "kalshi", "kalshiAccount"].includes(source.type)) return;
    const record = sourceLive.get(source.id) || {};
    const due = record.nextDue || 0;
    if (record.inflight || (!force && Date.now() < due)) return;
    const refreshMs = clamp(sourceRefreshSeconds(source), .5, 120) * 1000;
    sourceLive.set(source.id, { ...record, inflight: true, nextDue: Date.now() + refreshMs });
    try {
      const runtimeWidget = { type: source.type, sourceInput: source.input, sourceMeta: source.meta || {} };
      const sourceFingerprint = stableKey(`${source.input}|${JSON.stringify(source.meta || {})}`);
      const requestKey = `${source.type}:${source.id}:${sourceFingerprint}`;
      let request = sourceRequests.get(requestKey);
      if (!request) {
        request = chrome.runtime.sendMessage({ type: "LIVELAYER_FETCH_WIDGET", widget: runtimeWidget });
        sourceRequests.set(requestKey, request);
        request.then(() => sourceRequests.delete(requestKey), () => sourceRequests.delete(requestKey));
      }
      const response = await request;
      const currentSource = state.sources.find((item) => item.id === source.id);
      if (!currentSource || stableKey(`${currentSource.input}|${JSON.stringify(currentSource.meta || {})}`) !== sourceFingerprint) {
        sourceLive.set(source.id, { nextDue: 0, inflight: false });
        return;
      }
      if (!response?.ok) throw new Error(response?.error || "The source could not be refreshed.");
      if (response.data?.kind === "scoreboard") throw new Error("Edit the ESPN source and choose a specific game.");
      sourceLive.set(source.id, { data: response.data, history: appendKalshiHistory(record.history, response.data), error: "", inflight: false, updatedAt: Date.now(), nextDue: Date.now() + refreshMs });
      const imported = syncAccountBetWidgets();
      if (imported.changed) {
        await saveState();
        if (imported.created.length) showToast(`Imported ${imported.created.length} Kalshi bet widget${imported.created.length === 1 ? "" : "s"}.`);
      }
    } catch (error) {
      sourceLive.set(source.id, { ...record, error: error?.message || "Refresh failed.", inflight: false, updatedAt: Date.now(), nextDue: Date.now() + refreshMs });
    }
    if (!widgetsRoot.querySelector(".dragging")) renderWidgets();
    if (panelOpen && panelPage === "widgets" && !editor && panelPresetSignature !== widgetPresetSignature()) renderPanel();
  }

  function tick(force = false) {
    if (!activeForTab || !state.enabled) return;
    for (const source of state.sources) fetchSource(source, force);
  }

  async function removeWidget(widgetId) {
    state.widgets = state.widgets.filter((item) => item.id !== widgetId);
    live.delete(widgetId);
    if (arrangeFocusId === widgetId) arrangeFocusId = "";
    await saveState();
    render();
  }

  widgetsRoot.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-widget-action]");
    if (!button) return;
    event.stopPropagation();
    const element = button.closest(".ll-widget");
    const widgetId = element?.dataset.widgetId;
    if (button.dataset.widgetAction === "remove") await removeWidget(widgetId);
    if (button.dataset.widgetAction === "edit") {
      const widget = state.widgets.find((item) => item.id === widgetId);
      if (widget) { panelOpen = true; startEditor(widget, false); }
    }
  });

  widgetsRoot.addEventListener("pointerdown", (event) => {
    if (!editMode || event.target.closest("button")) return;
    const element = event.target.closest(".ll-widget");
    if (!element) return;
    const widget = state.widgets.find((item) => item.id === element.dataset.widgetId);
    if (!widget) return;
    arrangeFocusId = widget.id;
    widgetsRoot.querySelectorAll(".ll-widget.arrange-focus").forEach((item) => item.classList.remove("arrange-focus"));
    element.classList.add("arrange-focus");
    const resizeHandle = event.target.closest("[data-resize]");
    if (resizeHandle) {
      event.preventDefault();
      event.stopPropagation();
      resizeHandle.setPointerCapture(event.pointerId);
      element.classList.add("dragging");
      const mode = resizeHandle.dataset.resize;
      const look = styleFor(widget);
      const start = { x: event.clientX, y: event.clientY, width: look.width, height: look.height || element.offsetHeight, explicitHeight: Boolean(look.height), fontSize: look.fontSize };
      let width = look.width;
      let height = look.height;
      let fontSize = look.fontSize;
      const resizeMove = (moveEvent) => {
        if (mode === "width") {
          width = clamp(start.width + moveEvent.clientX - start.x, 120, 720);
        } else if (mode === "height") {
          height = clamp(start.height + moveEvent.clientY - start.y, 80, 720);
          element.style.height = `${Math.round(height)}px`;
        } else {
          const delta = ((moveEvent.clientX - start.x) + (moveEvent.clientY - start.y)) / 2;
          const factor = clamp(1 + delta / 160, .45, 2.4);
          width = clamp(start.width * factor, 120, 720);
          if (start.explicitHeight) {
            height = clamp(start.height * factor, 80, 720);
            element.style.height = `${Math.round(height)}px`;
          }
          fontSize = clamp(start.fontSize * factor, 11, 54);
          element.style.fontSize = `${Math.round(fontSize)}px`;
        }
        element.style.width = `${Math.round(width)}px`;
      };
      const resizeUp = async () => {
        element.classList.remove("dragging");
        resizeHandle.removeEventListener("pointermove", resizeMove);
        resizeHandle.removeEventListener("pointerup", resizeUp);
        resizeHandle.removeEventListener("pointercancel", resizeUp);
        widget.style = { ...(widget.style || {}), width: Math.round(width), height: height ? Math.round(height) : 0, fontSize: Math.round(fontSize), blockSize: "auto" };
        await saveState();
        renderWidgets();
      };
      resizeHandle.addEventListener("pointermove", resizeMove);
      resizeHandle.addEventListener("pointerup", resizeUp);
      resizeHandle.addEventListener("pointercancel", resizeUp);
      return;
    }
    event.preventDefault();
    element.setPointerCapture(event.pointerId);
    element.classList.add("dragging");
    const start = { x: event.clientX, y: event.clientY, left: element.offsetLeft, top: element.offsetTop };

    const move = (moveEvent) => {
      const maxLeft = Math.max(0, window.innerWidth - element.offsetWidth);
      const maxTop = Math.max(0, window.innerHeight - element.offsetHeight);
      const left = clamp(Math.round((start.left + moveEvent.clientX - start.x) / ARRANGE_GRID_SIZE) * ARRANGE_GRID_SIZE, 0, maxLeft);
      const top = clamp(Math.round((start.top + moveEvent.clientY - start.y) / ARRANGE_GRID_SIZE) * ARRANGE_GRID_SIZE, 0, maxTop);
      element.style.left = `${left}px`;
      element.style.top = `${top}px`;
    };
    const up = async () => {
      element.classList.remove("dragging");
      element.removeEventListener("pointermove", move);
      element.removeEventListener("pointerup", up);
      element.removeEventListener("pointercancel", up);
      const left = clamp((element.offsetLeft / Math.max(1, window.innerWidth)) * 100, 0, 96);
      const top = clamp((element.offsetTop / Math.max(1, window.innerHeight)) * 100, 0, 96);
      widget.position = { x: Math.round(left * 100) / 100, y: Math.round(top * 100) / 100 };
      await saveState();
      renderWidgets();
    };
    element.addEventListener("pointermove", move);
    element.addEventListener("pointerup", up);
    element.addEventListener("pointercancel", up);
  });

  gear.addEventListener("click", () => {
    panelOpen = !panelOpen;
    if (!panelOpen) { editor = null; sourceEditor = null; panelPage = "widgets"; }
    render();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes[STORAGE_KEY]?.newValue) return;
    state = normalizeState(changes[STORAGE_KEY].newValue);
    migrateSources();
    renderWidgets();
    if (panelPage !== "edit" || !editor) renderPanel();
    tick(true);
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === "LIVELAYER_TAB_ACTIVE") {
      activeForTab = Boolean(message.active);
      if (activeForTab) {
        state.enabled = true;
        saveState();
        mount();
        render();
        tick(true);
      } else {
        if (document.fullscreenElement && liveLayerFullscreenTarget) document.exitFullscreen().catch(() => restoreLiveLayerFullscreenTarget());
        else restoreLiveLayerFullscreenTarget();
        panelOpen = false;
        editor = null;
        sourceEditor = null;
        panelPage = "widgets";
        renderWidgets();
        unmount();
      }
    }
    if (message?.type === "LIVELAYER_OPEN_CONTROLS") {
      if (!activeForTab) return;
      state.controlsVisible = true;
      panelOpen = true;
      panelPage = "widgets";
      saveState();
      render();
    }
    if (message?.type === "LIVELAYER_TOGGLE") {
      if (!activeForTab) return;
      state.enabled = !state.enabled;
      saveState();
      render();
    }
  });

  document.addEventListener("fullscreenchange", () => {
    if (!document.fullscreenElement) restoreLiveLayerFullscreenTarget();
    if (activeForTab) mount();
    requestAnimationFrame(renderWidgets);
  });
  window.addEventListener("resize", renderWidgets, { passive: true });

  Promise.all([
    loadState(),
    chrome.runtime.sendMessage({ type: "LIVELAYER_GET_TAB_STATUS" }).catch(() => ({ active: false }))
  ]).then(([, status]) => {
    activeForTab = Boolean(status?.active);
    if (activeForTab) mount();
    render();
    tick(true);
  });
  setInterval(() => tick(false), 250);
  if (/(^|\.)kalshi\.com$/i.test(location.hostname)) {
    setTimeout(() => publishKalshiSnapshot(true), 800);
    setInterval(() => publishKalshiSnapshot(true), 2000);
    new MutationObserver(queueKalshiSnapshot).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  }
})();
