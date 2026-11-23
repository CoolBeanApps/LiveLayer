import test from "node:test";
import assert from "node:assert/strict";

await import("../lib/widget-utils.js");
const { conditionalColor, findOpenPlacement, inferPlayerProp, mixHex, progressInfo, rectsOverlap, toPercentPosition } = globalThis.LiveLayerWidgetUtils;

test("calculates target progress and caps a completed target at 100 percent", () => {
  assert.deepEqual(progressInfo("1 turnover", "4"), {
    currentNumber: 1,
    targetNumber: 4,
    percentage: 25,
    roundedPercentage: 25,
    complete: false
  });
  assert.equal(progressInfo("6", "4").percentage, 100);
  assert.equal(progressInfo("6", "4").complete, true);
  assert.equal(progressInfo("N/A", "4"), null);
});

test("places a new widget to the right of the last widget when space is open", () => {
  const placement = findOpenPlacement({
    viewportWidth: 1200,
    viewportHeight: 800,
    width: 280,
    height: 120,
    occupied: [{ left: 24, top: 24, right: 304, bottom: 144 }],
    gap: 16,
    gridSize: 16,
    margin: 24
  });
  assert.deepEqual(placement, { left: 320, top: 32 });
});

test("uses the next free grid slot instead of overlapping existing widgets", () => {
  const occupied = [
    { left: 24, top: 24, right: 324, bottom: 164 },
    { left: 344, top: 24, right: 644, bottom: 164 }
  ];
  const placement = findOpenPlacement({ viewportWidth: 720, viewportHeight: 600, width: 300, height: 140, occupied, gap: 12, gridSize: 16, margin: 24 });
  const candidate = { left: placement.left, top: placement.top, right: placement.left + 300, bottom: placement.top + 140 };
  assert.equal(occupied.some((rect) => rectsOverlap(candidate, rect, 12)), false);
  assert.ok(placement.top >= 176);
});

test("converts pixel placement to persistent viewport percentages", () => {
  assert.deepEqual(toPercentPosition(192, 108, 1920, 1080), { x: 10, y: 10 });
});

test("colors numbers across a customizable target spectrum", () => {
  assert.equal(mixHex("#ff0000", "#00ff00", 0.5), "#808000");
  assert.equal(conditionalColor({ mode: "spectrum", current: 0, target: 4, farColor: "#ff0000", nearColor: "#ffff00", reachedColor: "#00ff00" }), "#ff0000");
  assert.equal(conditionalColor({ mode: "spectrum", current: 2, target: 4, farColor: "#ff0000", nearColor: "#ffff00", reachedColor: "#00ff00" }), "#ff8000");
  assert.equal(conditionalColor({ mode: "spectrum", current: 4, target: 4, farColor: "#ff0000", nearColor: "#ffff00", reachedColor: "#00ff00" }), "#00ff00");
});

test("supports solid and threshold number colors", () => {
  assert.equal(conditionalColor({ mode: "solid", solidColor: "#123456" }), "#123456");
  assert.equal(conditionalColor({ mode: "threshold", current: 3, target: 4, farColor: "#00ff00", reachedColor: "#ff0000" }), "#00ff00");
  assert.equal(conditionalColor({ mode: "threshold", current: 5, target: 4, farColor: "#00ff00", reachedColor: "#ff0000" }), "#ff0000");
});

test("matches a Kalshi player prop to the correct ESPN player category and target", () => {
  const candidates = [
    { sourceId: "game-1", categoryKey: "passing", categoryLabel: "Passing", athleteId: "10", athleteName: "Jordan Love", labels: ["C/ATT", "YDS", "TD"] },
    { sourceId: "game-1", categoryKey: "rushing", categoryLabel: "Rushing", athleteId: "10", athleteName: "Jordan Love", labels: ["CAR", "YDS", "TD"] },
    { sourceId: "game-1", categoryKey: "receiving", categoryLabel: "Receiving", athleteId: "18", athleteName: "Justin Jefferson", labels: ["REC", "YDS", "TD"] }
  ];
  assert.deepEqual(inferPlayerProp("Jordan Love 200+ passing yards", candidates), {
    matched: true,
    target: "200",
    unit: "yards",
    statLabel: "YDS",
    statPart: "",
    sourceId: "game-1",
    categoryKey: "passing",
    athleteId: "10",
    athleteName: "Jordan Love",
    confidence: 100
  });
  const receiver = inferPlayerProp("Justin Jefferson 75+ receiving yards", candidates);
  assert.equal(receiver.athleteName, "Justin Jefferson");
  assert.equal(receiver.categoryKey, "receiving");
  assert.equal(receiver.target, "75");
});

test("does not guess an ESPN player when the portfolio wording is ambiguous", () => {
  const result = inferPlayerProp("Team total over 24.5 points", [{ sourceId: "g", categoryKey: "passing", athleteId: "1", athleteName: "Test Player", labels: ["YDS"] }]);
  assert.equal(result.matched, false);
  assert.equal(result.sourceId, "");
});
