import test from "node:test";
import assert from "node:assert/strict";
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
} from "../lib/sources.js";

test("parses an ESPN college football game link", () => {
  const source = parseEspnInput("https://www.espn.com/college-football/game?gameId=401856766");
  assert.deepEqual(source, {
    sport: "football",
    league: "college-football",
    eventId: "401856766",
    date: "",
    input: "https://www.espn.com/college-football/game?gameId=401856766"
  });
  assert.equal(espnApiUrl(source), "https://site.api.espn.com/apis/site/v2/sports/football/college-football/summary?event=401856766");
});

test("parses ESPN scoreboard dates and soccer leagues", () => {
  const source = parseEspnInput("https://www.espn.com/soccer/scoreboard/_/league/eng.1/date/20260829");
  assert.equal(source.sport, "soccer");
  assert.equal(source.league, "eng.1");
  assert.equal(source.date, "20260829");
  assert.match(espnApiUrl(source), /scoreboard\?limit=100&dates=20260829$/);
});

test("keeps women's college basketball separate from men's", () => {
  const source = parseEspnInput("https://www.espn.com/womens-college-basketball/game/_/gameId/401999999");
  assert.equal(source.sport, "basketball");
  assert.equal(source.league, "womens-college-basketball");
  assert.equal(source.eventId, "401999999");
});

test("normalizes an ESPN scoreboard into selectable games", () => {
  const source = { sport: "basketball", league: "nba", eventId: "", date: "" };
  const result = normalizeEspnScoreboard({ events: [{
    id: "123456789",
    name: "Away at Home",
    status: { type: { shortDetail: "7:30 PM" } },
    competitions: [{ competitors: [
      { homeAway: "home", score: "20", team: { abbreviation: "HOM", displayName: "Home" } },
      { homeAway: "away", score: "18", team: { abbreviation: "AWY", displayName: "Away" } }
    ] }]
  }] }, source);
  assert.equal(result.kind, "scoreboard");
  assert.equal(result.choices[0].eventId, "123456789");
  assert.equal(result.choices[0].score, "AWY 18 · HOM 20");
});

test("normalizes ESPN summary scores and win probability", () => {
  const result = normalizeEspnSummary({
    header: { competitions: [{ id: "123", status: { displayClock: "2:10", displayPeriod: "4th", type: { state: "in", shortDetail: "2:10 - 4th" } }, competitors: [
      { homeAway: "home", score: "24", team: { abbreviation: "HOM", displayName: "Home Team" }, record: [{ type: "total", summary: "5-1" }] },
      { homeAway: "away", score: "27", team: { abbreviation: "AWY", displayName: "Away Team" }, record: [{ type: "total", summary: "4-2" }], possession: true }
    ] }] },
    gameInfo: { venue: { fullName: "Test Stadium" } },
    drives: { current: { description: "3 plays, 21 yards", plays: [{ text: "A 12-yard pass." }] } },
    winprobability: [{ homeWinPercentage: 0.32 }]
  }, { sport: "football", league: "nfl", eventId: "123" });
  assert.equal(result.teams[0].abbreviation, "AWY");
  assert.equal(result.venue, "Test Stadium");
  assert.equal(result.lastPlay, "A 12-yard pass.");
  assert.deepEqual(result.winProbability, { homeTeam: "HOM", homePercent: 32, awayTeam: "AWY", awayPercent: 68 });
});

test("normalizes granular ESPN team and player box-score stats", () => {
  const result = normalizeEspnSummary({
    header: { competitions: [{ id: "456", competitors: [
      { homeAway: "away", score: "7", team: { id: "1", abbreviation: "AWY", displayName: "Away" } },
      { homeAway: "home", score: "10", team: { id: "2", abbreviation: "HOM", displayName: "Home" } }
    ] }] },
    boxscore: {
      teams: [{ team: { id: "1", abbreviation: "AWY" }, statistics: [
        { name: "netPassingYards", label: "Passing Yards", displayValue: "245" },
        { name: "rushingYards", label: "Rushing Yards", displayValue: "101" }
      ] }],
      players: [{ team: { abbreviation: "AWY" }, statistics: [{
        name: "passing",
        displayName: "Passing",
        labels: ["C/ATT", "YDS", "TD"],
        athletes: [{ athlete: { id: "99", displayName: "Test Quarterback", jersey: "12" }, stats: ["20/30", "245", "2"] }]
      }] }]
    }
  }, { sport: "football", league: "nfl", eventId: "456" });
  assert.equal(result.teamStats[0].stats.netPassingYards.value, "245");
  assert.equal(result.playerStats[0].athletes[0].stats.YDS, "245");
  assert.equal(result.playerStats[0].athletes[0].jersey, "12");
});

test("parses Kalshi market links and exact tickers", () => {
  assert.equal(parseKalshiTicker("KXHIGHNY-26AUG29-T84"), "KXHIGHNY-26AUG29-T84");
  assert.equal(parseKalshiTicker("https://kalshi.com/markets/kxhighny/high-temp/kxhighny-26aug29-t84"), "KXHIGHNY-26AUG29-T84");
  assert.equal(kalshiApiUrl("ABC-123"), "https://external-api.kalshi.com/trade-api/v2/markets/ABC-123");
  assert.equal(kalshiEventApiUrl("EVT-123"), "https://external-api.kalshi.com/trade-api/v2/events/EVT-123?with_nested_markets=true");
});

test("accepts Kalshi account pages and rejects public market pages", () => {
  const source = parseKalshiAccountPage("https://kalshi.com/portfolio?tab=open-orders");
  assert.equal(source.pageKey, "https://kalshi.com/portfolio");
  assert.equal(source.pathname, "/portfolio");
  assert.throws(() => parseKalshiAccountPage("https://kalshi.com/markets/kxnfl"), /not a public market page/);
  assert.throws(() => parseKalshiAccountPage("https://example.com/portfolio"), /not a Kalshi link/);
});

test("normalizes Kalshi midpoint as market-implied percentage", () => {
  const result = normalizeKalshiMarket({ market: {
    ticker: "ABC-123",
    title: "Will the test pass?",
    status: "open",
    yes_bid_dollars: "0.4200",
    yes_ask_dollars: "0.4600",
    no_bid_dollars: "0.5400",
    no_ask_dollars: "0.5800",
    last_price_dollars: "0.4500",
    volume_fp: "101.00",
    open_interest_fp: "55.00"
  } }, "ABC-123");
  assert.equal(result.yesPercent, 44);
  assert.equal(result.noPercent, 56);
  assert.equal(result.yesBid, 42);
  assert.equal(result.yesAsk, 46);
});

test("normalizes every nested market in a Kalshi event", () => {
  const result = normalizeKalshiEvent({ event: {
    event_ticker: "KXGAME-26SEP22",
    title: "Miami vs. Las Vegas",
    category: "Sports",
    markets: [
      { ticker: "KXGAME-26SEP22-MIA", title: "Miami to win", status: "open", yes_bid_dollars: "0.4100", yes_ask_dollars: "0.4300" },
      { ticker: "KXGAME-26SEP22-LV", title: "Las Vegas to win", status: "open", yes_bid_dollars: "0.5700", yes_ask_dollars: "0.5900" }
    ]
  } }, "KXGAME-26SEP22");
  assert.equal(result.kind, "event");
  assert.equal(result.eventTicker, "KXGAME-26SEP22");
  assert.equal(result.markets.length, 2);
  assert.equal(result.markets[0].yesPercent, 42);
  assert.equal(result.markets[1].ticker, "KXGAME-26SEP22-LV");
});

test("rejects unsupported ESPN links and Kalshi category prose", () => {
  assert.throws(() => parseEspnInput("https://example.com/video"), /not recognized/);
  assert.throws(() => parseKalshiTicker("not a ticker"), /could not find/);
});
