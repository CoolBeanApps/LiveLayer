const ESPN_ROUTES = [
  ["college-football", "football", "college-football"],
  ["womens-college-basketball", "basketball", "womens-college-basketball"],
  ["mens-college-basketball", "basketball", "mens-college-basketball"],
  ["college-basketball", "basketball", "mens-college-basketball"],
  ["nfl", "football", "nfl"],
  ["nba", "basketball", "nba"],
  ["wnba", "basketball", "wnba"],
  ["mlb", "baseball", "mlb"],
  ["nhl", "hockey", "nhl"],
  ["soccer", "soccer", "all"]
];

function safeUrl(input) {
  const trimmed = String(input || "").trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }
}

function compactDate(value) {
  const match = String(value || "").match(/(20\d{2})-?(\d{2})-?(\d{2})/);
  return match ? `${match[1]}${match[2]}${match[3]}` : "";
}

export function parseEspnInput(input, override = {}) {
  const raw = String(input || "").trim();
  if (!raw) throw new Error("Paste an ESPN game or scoreboard link.");

  const url = safeUrl(raw);
  const path = url?.pathname || raw;
  const lowerPath = path.toLowerCase();
  let sport = override.sport || "";
  let league = override.league || "";

  if (!sport || !league) {
    for (const [needle, mappedSport, mappedLeague] of ESPN_ROUTES) {
      if (lowerPath.includes(`/${needle}`) || lowerPath.startsWith(needle)) {
        sport ||= mappedSport;
        league ||= mappedLeague;
        break;
      }
    }
  }

  if (sport === "soccer" && url) {
    const leagueMatch = path.match(/\/(?:league|leagues)\/([^/?#]+)/i);
    if (leagueMatch) league = decodeURIComponent(leagueMatch[1]);
  }

  let eventId = String(override.eventId || "").trim();
  if (!eventId && url) eventId = url.searchParams.get("gameId") || url.searchParams.get("event") || "";
  if (!eventId) {
    eventId = path.match(/\/(?:gameId|event)\/(\d{6,})/i)?.[1]
      || path.match(/\/(?:game|match)\/(\d{6,})/i)?.[1]
      || "";
  }
  if (!eventId && /^\d{6,}$/.test(raw)) eventId = raw;

  let date = compactDate(override.date);
  if (!date && url) date = compactDate(url.searchParams.get("dates") || url.searchParams.get("date"));
  if (!date) date = compactDate(path.match(/\/(?:date|dates)\/(20\d{6})/i)?.[1]);

  if (!sport || !league) {
    throw new Error("That ESPN link is not recognized yet. Supported sources include NFL, college football, NBA, WNBA, college basketball, MLB, NHL, and soccer.");
  }

  return { sport, league, eventId, date, input: raw };
}

export function espnApiUrl(source) {
  const base = `https://site.api.espn.com/apis/site/v2/sports/${encodeURIComponent(source.sport)}/${encodeURIComponent(source.league)}`;
  if (source.eventId) return `${base}/summary?event=${encodeURIComponent(source.eventId)}`;
  const query = new URLSearchParams({ limit: "100" });
  if (source.date) query.set("dates", source.date);
  return `${base}/scoreboard?${query.toString()}`;
}

function totalRecord(competitor) {
  const records = competitor?.record || competitor?.records || [];
  const record = records.find((item) => item.type === "total") || records[0];
  return record?.summary || record?.displayValue || "";
}

function normalizeTeam(competitor) {
  return {
    id: competitor?.id || competitor?.team?.id || "",
    homeAway: competitor?.homeAway || "",
    abbreviation: competitor?.team?.abbreviation || competitor?.team?.shortDisplayName || "Team",
    name: competitor?.team?.displayName || competitor?.team?.shortDisplayName || "Team",
    score: String(competitor?.score ?? "0"),
    record: totalRecord(competitor),
    possession: Boolean(competitor?.possession)
  };
}

function latestPlay(data) {
  const currentPlays = data?.drives?.current?.plays || [];
  if (currentPlays.length) return currentPlays.at(-1);
  const previousDrives = data?.drives?.previous || [];
  const previousPlays = previousDrives.at(-1)?.plays || [];
  if (previousPlays.length) return previousPlays.at(-1);
  const scoringPlays = data?.scoringPlays || [];
  return scoringPlays.at(-1) || null;
}

export function normalizeEspnSummary(data, source) {
  const competition = data?.header?.competitions?.[0];
  if (!competition) throw new Error("ESPN did not return a game for that link.");

  const teams = (competition.competitors || [])
    .map(normalizeTeam)
    .sort((a, b) => (a.homeAway === "away" ? -1 : 1) - (b.homeAway === "away" ? -1 : 1));
  if (!teams.length) throw new Error("ESPN returned a game without team data.");

  const status = competition.status || {};
  const statusType = status.type || {};
  const play = latestPlay(data);
  const currentDrive = data?.drives?.current;
  const win = (data?.winprobability || []).at(-1);
  const home = teams.find((team) => team.homeAway === "home");
  const away = teams.find((team) => team.homeAway === "away");
  const homePercent = Number.isFinite(Number(win?.homeWinPercentage))
    ? Math.round(Number(win.homeWinPercentage) * 1000) / 10
    : null;

  const leaders = (data?.leaders || []).map((teamBlock) => ({
    team: teamBlock?.team?.abbreviation || teamBlock?.team?.displayName || "Team",
    items: (teamBlock?.leaders || []).slice(0, 3).map((category) => ({
      label: category?.displayName || category?.name || "Leader",
      athlete: category?.leaders?.[0]?.athlete?.displayName || "",
      value: category?.leaders?.[0]?.displayValue || ""
    })).filter((item) => item.athlete || item.value)
  })).filter((item) => item.items.length);

  const teamStats = (data?.boxscore?.teams || []).map((teamBlock) => ({
    team: teamBlock?.team?.abbreviation || teamBlock?.team?.shortDisplayName || teamBlock?.team?.displayName || "Team",
    teamId: String(teamBlock?.team?.id || ""),
    stats: Object.fromEntries((teamBlock?.statistics || []).map((stat) => [
      stat?.name || stat?.label || stat?.abbreviation || "stat",
      {
        label: stat?.label || stat?.displayName || stat?.name || "Stat",
        abbreviation: stat?.abbreviation || "",
        value: stat?.displayValue ?? stat?.value ?? ""
      }
    ]))
  })).filter((team) => Object.keys(team.stats).length);

  const playerStats = (data?.boxscore?.players || []).flatMap((teamBlock) => {
    const team = teamBlock?.team?.abbreviation || teamBlock?.team?.shortDisplayName || teamBlock?.team?.displayName || "Team";
    return (teamBlock?.statistics || []).map((category) => {
      const labels = category?.labels || category?.keys || [];
      return {
        team,
        key: category?.name || category?.type || category?.displayName || "players",
        label: category?.displayName || category?.label || category?.name || "Players",
        labels,
        athletes: (category?.athletes || []).map((entry) => ({
          id: String(entry?.athlete?.id || ""),
          name: entry?.athlete?.displayName || entry?.athlete?.shortName || "Player",
          shortName: entry?.athlete?.shortName || entry?.athlete?.displayName || "Player",
          jersey: String(entry?.athlete?.jersey || entry?.jersey || ""),
          values: entry?.stats || [],
          stats: Object.fromEntries(labels.map((label, index) => [label, entry?.stats?.[index] ?? ""]))
        })).filter((athlete) => athlete.name)
      };
    });
  }).filter((category) => category.athletes.length);

  return {
    kind: "game",
    source,
    id: competition.id || source.eventId,
    title: teams.map((team) => team.name).join(" vs. "),
    teams,
    status: statusType.shortDetail || statusType.detail || statusType.description || "Scheduled",
    state: statusType.state || "pre",
    clock: status.displayClock || "",
    period: status.displayPeriod || (status.period ? String(status.period) : ""),
    situation: competition?.situation?.downDistanceText
      || competition?.situation?.possessionText
      || currentDrive?.description
      || "",
    venue: data?.gameInfo?.venue?.fullName || competition?.venue?.fullName || "",
    lastPlay: play?.text || play?.shortText || "",
    winProbability: homePercent === null ? null : {
      homeTeam: home?.abbreviation || "Home",
      homePercent,
      awayTeam: away?.abbreviation || "Away",
      awayPercent: Math.round((100 - homePercent) * 10) / 10
    },
    leaders,
    teamStats,
    playerStats
  };
}

export function normalizeEspnScoreboard(data, source) {
  const choices = (data?.events || []).map((event) => {
    const competition = event?.competitions?.[0] || {};
    const teams = (competition.competitors || [])
      .map(normalizeTeam)
      .sort((a, b) => (a.homeAway === "away" ? -1 : 1) - (b.homeAway === "away" ? -1 : 1));
    return {
      eventId: String(event?.id || ""),
      title: event?.shortName || event?.name || teams.map((team) => team.name).join(" vs. "),
      status: event?.status?.type?.shortDetail || event?.status?.type?.detail || "Scheduled",
      score: teams.map((team) => `${team.abbreviation} ${team.score}`).join(" · ")
    };
  }).filter((event) => event.eventId);

  return { kind: "scoreboard", source, choices };
}

export function parseKalshiTicker(input) {
  const raw = String(input || "").trim();
  if (!raw) throw new Error("Paste a Kalshi market link or enter its market ticker.");
  const url = safeUrl(raw);
  let ticker = "";
  if (url && /(^|\.)kalshi\.com$/i.test(url.hostname)) {
    ticker = url.searchParams.get("ticker") || "";
    if (!ticker) {
      const parts = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
      ticker = parts.at(-1) || "";
    }
  } else if (!raw.includes("/") && !raw.includes(" ")) {
    ticker = raw;
  }
  ticker = ticker.toUpperCase();
  if (!/^[A-Z0-9._-]{3,200}$/.test(ticker)) {
    throw new Error("I could not find a valid Kalshi market ticker in that value. Paste a specific market page, not a category page.");
  }
  return ticker;
}

export function kalshiApiUrl(ticker) {
  return `https://external-api.kalshi.com/trade-api/v2/markets/${encodeURIComponent(ticker)}`;
}

export function kalshiEventApiUrl(eventTicker) {
  return `https://external-api.kalshi.com/trade-api/v2/events/${encodeURIComponent(eventTicker)}?with_nested_markets=true`;
}

export function parseKalshiAccountPage(input) {
  const raw = String(input || "").trim();
  if (!raw) throw new Error("Paste your Kalshi portfolio or order-history link.");
  const url = safeUrl(raw);
  if (!url || !/(^|\.)kalshi\.com$/i.test(url.hostname)) {
    throw new Error("That is not a Kalshi link.");
  }
  const pageText = `${url.pathname} ${url.search}`.toLowerCase();
  if (!/(portfolio|position|order|history|activity|fill|document|account|trade)/.test(pageText)) {
    throw new Error("Paste a Kalshi portfolio, positions, orders, fills, or history page, not a public market page.");
  }
  url.hash = "";
  const pageKey = `${url.origin}${url.pathname}`.replace(/\/$/, "") || url.origin;
  return { input: raw, url: url.href, pageKey, pathname: url.pathname };
}

function dollars(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function cents(value) {
  return value === null ? null : Math.round(value * 1000) / 10;
}

export function normalizeKalshiMarket(data, ticker) {
  const market = data?.market;
  if (!market) throw new Error("Kalshi did not return a market for that ticker.");
  const yesBid = dollars(market.yes_bid_dollars);
  const yesAsk = dollars(market.yes_ask_dollars);
  const noBid = dollars(market.no_bid_dollars);
  const noAsk = dollars(market.no_ask_dollars);
  const last = dollars(market.last_price_dollars);
  let yes = yesBid !== null && yesAsk !== null ? (yesBid + yesAsk) / 2 : last ?? yesBid ?? (noAsk === null ? null : 1 - noAsk);
  if (market.status === "settled" && market.result) yes = market.result === "yes" ? 1 : 0;

  return {
    kind: "market",
    ticker: market.ticker || ticker,
    title: market.title || market.subtitle || market.yes_sub_title || ticker,
    subtitle: market.subtitle || market.yes_sub_title || "",
    status: market.status || "unknown",
    result: market.result || "",
    yesPercent: cents(yes),
    noPercent: yes === null ? null : Math.round((100 - yes * 100) * 10) / 10,
    yesBid: cents(yesBid),
    yesAsk: cents(yesAsk),
    noBid: cents(noBid),
    noAsk: cents(noAsk),
    last: cents(last),
    volume: String(market.volume_fp ?? market.volume ?? ""),
    openInterest: String(market.open_interest_fp ?? market.open_interest ?? "")
  };
}

export function normalizeKalshiEvent(data, eventTicker) {
  const event = data?.event || data?.events?.[0];
  if (!event) throw new Error("Kalshi did not return an event for that link.");
  const rawMarkets = event.markets?.length ? event.markets : data?.markets || [];
  const markets = rawMarkets.map((market) => normalizeKalshiMarket({ market }, market?.ticker));
  if (!markets.length) throw new Error("That Kalshi event did not return any markets.");
  return {
    kind: "event",
    eventTicker: event.event_ticker || event.ticker || eventTicker,
    title: event.title || event.sub_title || eventTicker,
    subtitle: event.sub_title || "",
    category: event.category || "",
    markets
  };
}
