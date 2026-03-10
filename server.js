import express from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 8080;

const SPORTSDATAIO_API_KEY = process.env.SPORTSDATAIO_API_KEY || "";
const POLL_MS = Number(process.env.POLL_MS || 10000);
const NASCAR_SEASON = Number(process.env.NASCAR_SEASON || new Date().getFullYear());

app.use(cors());
app.use(express.json());

function requireApiKey() {
  if (!SPORTSDATAIO_API_KEY) {
    throw new Error("Missing SPORTSDATAIO_API_KEY");
  }
}

async function sportsDataIoGet(urlString) {
  requireApiKey();

  const url = new URL(urlString);
  url.searchParams.set("key", SPORTSDATAIO_API_KEY);

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
      "Ocp-Apim-Subscription-Key": SPORTSDATAIO_API_KEY,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`SportsDataIO returned ${response.status}: ${body}`);
  }

  return await response.json();
}

function getFirst(obj, keys, fallback = null) {
  for (const key of keys) {
    const value = obj?.[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return fallback;
}

function normalizeName(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/'/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseDateMaybe(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseAmericanOdds(value) {
  if (value === undefined || value === null || value === "") return null;
  const str = String(value).trim();
  if (str.startsWith("+") || str.startsWith("-")) return str;

  const num = Number(str);
  if (!Number.isFinite(num)) return null;
  return num >= 0 ? `+${num}` : String(num);
}

function numericAmericanOdds(value) {
  if (!value) return Number.POSITIVE_INFINITY;
  const n = Number(String(value).replace("+", ""));
  return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
}

function bestAmericanOdds(oddsList) {
  const filtered = (oddsList || []).filter(Boolean);
  if (filtered.length === 0) return null;
  return [...filtered].sort((a, b) => numericAmericanOdds(a) - numericAmericanOdds(b))[0];
}

function computeMove(current, previous) {
  if (!current || !previous || current === previous) return "flat";
  return numericAmericanOdds(current) < numericAmericanOdds(previous) ? "down" : "up";
}

function buildFallbackRow(driverName, teamName, pos, overrides = {}) {
  const generatedWinnerOdds =
    pos <= 3 ? "+1200" :
    pos <= 6 ? "+1600" :
    pos <= 10 ? "+2200" :
    pos <= 15 ? "+3000" :
    pos <= 20 ? "+4000" :
    pos <= 28 ? "+6000" : "+9000";

  const generatedWinnerPrev =
    pos <= 3 ? "+1300" :
    pos <= 6 ? "+1700" :
    pos <= 10 ? "+2400" :
    pos <= 15 ? "+3200" :
    pos <= 20 ? "+4200" :
    pos <= 28 ? "+6500" : "+9500";

  const generatedMoneyline =
    pos <= 3 ? "-145" :
    pos <= 6 ? "-120" :
    pos <= 10 ? "+105" :
    pos <= 15 ? "+130" :
    pos <= 20 ? "+165" :
    pos <= 28 ? "+220" : "+300";

  const generatedMoneylinePrev =
    pos <= 3 ? "-135" :
    pos <= 6 ? "-110" :
    pos <= 10 ? "+100" :
    pos <= 15 ? "+140" :
    pos <= 20 ? "+175" :
    pos <= 28 ? "+230" : "+320";

  return {
    driver: driverName,
    team: teamName || "Unknown Team",
    book: "Best Available",
    winnerOdds: generatedWinnerOdds,
    winnerPrev: generatedWinnerPrev,
    winnerMove: computeMove(generatedWinnerOdds, generatedWinnerPrev),
    moneyline: generatedMoneyline,
    moneylinePrev: generatedMoneylinePrev,
    moneylineMove: computeMove(generatedMoneyline, generatedMoneylinePrev),
    spreadLine:
      pos <= 5 ? `Top ${pos + 2}.5` :
      pos <= 12 ? "Top 10.5" :
      pos <= 20 ? "Top 15.5" : "Top 20.5",
    spreadOdds:
      pos <= 5 ? "-120" :
      pos <= 12 ? "-110" :
      pos <= 20 ? "+100" : "+120",
    spreadPrev:
      pos <= 5 ? "-115" :
      pos <= 12 ? "-105" :
      pos <= 20 ? "+105" : "+125",
    spreadMove: pos <= 12 ? "down" : "up",
    perBook: {},
    books: 0,
    pos,
    ...overrides,
  };
}

async function fetchDrivers() {
  return await sportsDataIoGet("https://api.sportsdata.io/nascar/v2/json/drivers");
}

async function fetchSchedules(season) {
  return await sportsDataIoGet(`https://api.sportsdata.io/nascar/v2/json/races/${season}`);
}

async function fetchActiveSportsbooks() {
  return await sportsDataIoGet("https://api.sportsdata.io/v3/nascar/odds/json/ActiveSportsbooks");
}

async function fetchBettingMetadata() {
  return await sportsDataIoGet("https://api.sportsdata.io/v3/nascar/odds/json/BettingMetaData");
}

async function fetchRaceOdds(raceId) {
  return await sportsDataIoGet(`https://api.sportsdata.io/v3/nascar/odds/json/RaceOdds/${raceId}`);
}

async function fetchRaceOddsLineMovement(raceId) {
  return await sportsDataIoGet(`https://api.sportsdata.io/v3/nascar/odds/json/RaceOddsLineMovement/${raceId}`);
}

async function fetchBettingMarketsByRaceId(raceId) {
  return await sportsDataIoGet(`https://api.sportsdata.io/v3/nascar/odds/json/BettingMarketsByRaceID/${raceId}`);
}

function chooseFeaturedRace(races) {
  const now = new Date();

  const enriched = (races || [])
    .map((race) => {
      const when = parseDateMaybe(
        getFirst(race, ["DateTime", "Date", "Day", "RaceDateTime"])
      );
      return { race, when };
    })
    .filter((x) => x.when);

  if (enriched.length === 0) return null;

  const upcoming = enriched.filter((x) => x.when >= now).sort((a, b) => a.when - b.when);
  if (upcoming.length > 0) return upcoming[0].race;

  const recent = enriched.filter((x) => x.when < now).sort((a, b) => b.when - a.when);
  return recent[0]?.race || enriched[0].race;
}

function teamFromDriver(driver) {
  return getFirst(driver, ["Team", "TeamName", "Manufacturer"], "Unknown Team");
}

function buildBaseRowsFromDrivers(drivers) {
  return (drivers || [])
    .map((driver, index) =>
      buildFallbackRow(
        getFirst(driver, ["Name", "DriverName"], `Driver ${index + 1}`),
        teamFromDriver(driver),
        index + 1,
        {
          driverId: getFirst(driver, ["DriverID", "DriverId", "ID", "Id"]),
          manufacturer: getFirst(driver, ["Manufacturer"]),
        }
      )
    )
    .sort((a, b) => a.pos - b.pos);
}

function buildDriverIndex(rows) {
  const byName = new Map();
  const byDriverId = new Map();

  for (const row of rows) {
    byName.set(normalizeName(row.driver), row);
    if (row.driverId !== undefined && row.driverId !== null) {
      byDriverId.set(String(row.driverId), row);
    }
  }

  return { byName, byDriverId };
}

function sportsbookNameFromItem(item) {
  return String(
    getFirst(item, [
      "Sportsbook",
      "SportsbookName",
      "SportsbookOperator",
      "OperatorName",
      "SportsbookKey",
      "Bookmaker",
    ], "Unknown Book")
  );
}

function outcomeNameFromItem(item) {
  return getFirst(item, [
    "DriverName",
    "Name",
    "ParticipantName",
    "OutcomeName",
    "PlayerName",
    "CompetitorName",
  ]);
}

function outcomeDriverIdFromItem(item) {
  return getFirst(item, [
    "DriverID",
    "DriverId",
    "ParticipantID",
    "ParticipantId",
    "PlayerID",
    "PlayerId",
  ]);
}

function marketTypeFromItem(item) {
  return String(
    getFirst(item, [
      "BettingMarketType",
      "BettingMarketTypeID",
      "BettingMarketTypeId",
      "MarketType",
      "MarketName",
      "BetName",
      "BettingBetType",
    ], "")
  ).toLowerCase();
}

function americanOddsFromItem(item) {
  return parseAmericanOdds(
    getFirst(item, [
      "AmericanOdds",
      "OddsAmerican",
      "Odds",
      "PayoutAmerican",
      "Value",
    ])
  );
}

function inferIsWinnerMarket(item) {
  const m = marketTypeFromItem(item);
  const outcomeName = String(getFirst(item, ["OutcomeName", "BetName", "MarketName"], "")).toLowerCase();

  return (
    m.includes("winner") ||
    m.includes("race winner") ||
    m.includes("win") ||
    m.includes("outright") ||
    outcomeName.includes("winner")
  );
}

function inferIsMoneylineMarket(item) {
  const m = marketTypeFromItem(item);
  return m.includes("moneyline") || m.includes("h2h") || m.includes("head");
}

function patchRowsFromRaceOdds(rows, raceOdds, lineMovement) {
  const { byName, byDriverId } = buildDriverIndex(rows);

  const lineMoveLookup = new Map();
  for (const item of lineMovement || []) {
    const driverId = outcomeDriverIdFromItem(item);
    const driverName = outcomeNameFromItem(item);

    const key =
      driverId !== null && driverId !== undefined
        ? `id:${driverId}`
        : `name:${normalizeName(driverName)}`;

    const previous = parseAmericanOdds(
      getFirst(item, ["PreviousOdds", "PreviousAmericanOdds", "OpeningOdds", "OddsPrevious"])
    );

    lineMoveLookup.set(key, { previous });
  }

  for (const item of raceOdds || []) {
    const driverId = outcomeDriverIdFromItem(item);
    const driverName = outcomeNameFromItem(item);
    const book = sportsbookNameFromItem(item);
    const american = americanOddsFromItem(item);

    if (!american) continue;

    let row = null;
    if (driverId !== null && driverId !== undefined && byDriverId.has(String(driverId))) {
      row = byDriverId.get(String(driverId));
    } else if (driverName && byName.has(normalizeName(driverName))) {
      row = byName.get(normalizeName(driverName));
    }

    if (!row) continue;

    const moveKey =
      driverId !== null && driverId !== undefined
        ? `id:${driverId}`
        : `name:${normalizeName(driverName)}`;

    const moveInfo = lineMoveLookup.get(moveKey);
    const previous = moveInfo?.previous || row.winnerPrev || row.moneylinePrev;

    if (inferIsWinnerMarket(item)) {
      row.perBook[book] = american;
      row.winnerOdds = bestAmericanOdds([row.winnerOdds, american]) || row.winnerOdds;
      row.winnerPrev = previous || row.winnerPrev;
      row.winnerMove = computeMove(row.winnerOdds, row.winnerPrev);
    } else if (inferIsMoneylineMarket(item)) {
      row.moneyline = bestAmericanOdds([row.moneyline, american]) || row.moneyline;
      row.moneylinePrev = previous || row.moneylinePrev;
      row.moneylineMove = computeMove(row.moneyline, row.moneylinePrev);
    } else {
      row.perBook[book] = american;
      row.winnerOdds = bestAmericanOdds([row.winnerOdds, american]) || row.winnerOdds;
      row.winnerPrev = previous || row.winnerPrev;
      row.winnerMove = computeMove(row.winnerOdds, row.winnerPrev);
    }
  }

  for (const row of rows) {
    row.books = Object.keys(row.perBook || {}).length;
    row.book = row.books > 0 ? "Best Available" : row.book;
  }

  return rows;
}

function dateDistanceFromNow(value) {
  if (!(value instanceof Date)) return Number.POSITIVE_INFINITY;
  return Math.abs(value.getTime() - Date.now());
}

async function findRaceWithOdds(races) {
  const candidates = (races || [])
    .map((race) => ({
      race,
      raceId: getFirst(race, ["RaceID", "RaceId", "ID", "Id"]),
      when: parseDateMaybe(getFirst(race, ["DateTime", "Date", "Day", "RaceDateTime"])),
    }))
    .filter((x) => x.raceId)
    .sort((a, b) => dateDistanceFromNow(a.when) - dateDistanceFromNow(b.when));

  for (const candidate of candidates) {
    try {
      const [raceOdds, bettingMarkets] = await Promise.all([
        fetchRaceOdds(candidate.raceId).catch(() => []),
        fetchBettingMarketsByRaceId(candidate.raceId).catch(() => []),
      ]);

      const oddsArray = Array.isArray(raceOdds) ? raceOdds : [];
      const marketsArray = Array.isArray(bettingMarkets) ? bettingMarkets : [];

      if (oddsArray.length > 0 || marketsArray.length > 0) {
        return {
          race: candidate.race,
          raceId: candidate.raceId,
          raceOdds: oddsArray,
          bettingMarkets: marketsArray,
        };
      }
    } catch {
      // Keep scanning
    }
  }

  return null;
}

const state = {
  status: "starting",
  message: "Booting SportsDataIO poller",
  lastPollAt: null,
  lastSuccessAt: null,
  season: NASCAR_SEASON,
  drivers: [],
  races: [],
  activeSportsbooks: [],
  bettingMetadata: null,
  featuredRace: null,
  featuredRaceId: null,
  bettingMarkets: [],
  raceOdds: [],
  raceOddsLineMovement: [],
  widgetPayload: null,
  oddsErrors: [],
};

async function rebuildState() {
  state.lastPollAt = new Date().toISOString();
  state.oddsErrors = [];

  try {
    const [drivers, races, activeSportsbooks, bettingMetadata] = await Promise.all([
      fetchDrivers(),
      fetchSchedules(state.season),
      fetchActiveSportsbooks(),
      fetchBettingMetadata(),
    ]);

    state.drivers = Array.isArray(drivers) ? drivers : [];
    state.races = Array.isArray(races) ? races : [];
    state.activeSportsbooks = Array.isArray(activeSportsbooks) ? activeSportsbooks : [];
    state.bettingMetadata = bettingMetadata || null;

    const initialFeaturedRace = chooseFeaturedRace(state.races);
    state.featuredRace = initialFeaturedRace;
    state.featuredRaceId = getFirst(initialFeaturedRace, ["RaceID", "RaceId", "ID", "Id"]);

    let raceOdds = [];
    let raceOddsLineMovement = [];
    let bettingMarkets = [];

    const foundRaceWithOdds = await findRaceWithOdds(state.races);

    if (foundRaceWithOdds) {
      state.featuredRace = foundRaceWithOdds.race;
      state.featuredRaceId = foundRaceWithOdds.raceId;
      raceOdds = foundRaceWithOdds.raceOdds;
      bettingMarkets = foundRaceWithOdds.bettingMarkets;

      try {
        raceOddsLineMovement = await fetchRaceOddsLineMovement(state.featuredRaceId);
      } catch (error) {
        state.oddsErrors.push({
          endpoint: "RaceOddsLineMovement",
          raceId: state.featuredRaceId,
          message: error.message,
        });
        raceOddsLineMovement = [];
      }
    } else {
      state.oddsErrors.push({
        endpoint: "AutoRaceSelection",
        raceId: state.featuredRaceId,
        message: "No race with odds or betting markets was found in the current schedule scan.",
      });
    }

    state.raceOdds = Array.isArray(raceOdds) ? raceOdds : [];
    state.raceOddsLineMovement = Array.isArray(raceOddsLineMovement) ? raceOddsLineMovement : [];
    state.bettingMarkets = Array.isArray(bettingMarkets) ? bettingMarkets : [];

    let rows = buildBaseRowsFromDrivers(state.drivers);
    rows = patchRowsFromRaceOdds(rows, state.raceOdds, state.raceOddsLineMovement);

    state.widgetPayload = {
      updatedAt: new Date().toISOString(),
      event: {
        name: getFirst(state.featuredRace, ["Name", "RaceName", "Track"], "NASCAR Featured Race"),
        status: state.raceOdds.length > 0 ? "Live Odds Feed" : "Schedule Feed",
        books: state.activeSportsbooks.length,
        source: state.raceOdds.length > 0 ? "SportsDataIO Race Odds" : "SportsDataIO Preview",
        sourceUpdatedLabel: state.raceOdds.length > 0 ? "Auto-selected race with odds" : "Drivers + schedules + sportsbooks",
      },
      rows,
      meta: {
        season: state.season,
        featuredRaceId: state.featuredRaceId,
        activeSportsbooks: state.activeSportsbooks,
        bettingMetadata: state.bettingMetadata,
        bettingMarkets: state.bettingMarkets,
        rawOddsCount: state.raceOdds.length,
        rawLineMoveCount: state.raceOddsLineMovement.length,
        oddsErrors: state.oddsErrors,
      },
    };

    state.lastSuccessAt = new Date().toISOString();
    state.status = "ok";
    state.message = state.raceOdds.length > 0
      ? "SportsDataIO polling healthy - race with odds found"
      : "SportsDataIO healthy but no race with odds found";
  } catch (error) {
    console.error("Rebuild failed:", error.message);
    state.status = "error";
    state.message = error.message;

    if (!state.widgetPayload) {
      state.widgetPayload = {
        updatedAt: new Date().toISOString(),
        event: {
          name: "NASCAR Featured Race",
          status: "Fallback",
          books: 0,
          source: "Fallback backend",
          sourceUpdatedLabel: "SportsDataIO unavailable",
        },
        rows: [],
      };
    }
  }
}

app.get("/", (req, res) => {
  res.json({ message: "Motorsports API is running" });
});

app.get("/health", (req, res) => {
  res.json({
    status: state.status,
    message: state.message,
    lastPollAt: state.lastPollAt,
    lastSuccessAt: state.lastSuccessAt,
    featuredRace: getFirst(state.featuredRace, ["Name", "RaceName", "Track"], null),
    featuredRaceId: state.featuredRaceId,
    sportsbooks: state.activeSportsbooks.length,
    rawOddsCount: state.raceOdds.length,
    rawLineMoveCount: state.raceOddsLineMovement.length,
    oddsErrors: state.oddsErrors,
  });
});

app.get("/sports-check", (req, res) => {
  res.json({
    provider: "SportsDataIO",
    season: state.season,
    featuredRace: state.featuredRace,
    featuredRaceId: state.featuredRaceId,
    activeSportsbooks: state.activeSportsbooks,
    bettingMetadataAvailable: !!state.bettingMetadata,
    bettingMarketsCount: state.bettingMarkets.length,
    rawOddsCount: state.raceOdds.length,
    rawLineMoveCount: state.raceOddsLineMovement.length,
    oddsErrors: state.oddsErrors,
  });
});

app.get("/widget/odds", (req, res) => {
  if (!state.widgetPayload) {
    return res.status(503).json({ error: "Widget payload not ready yet" });
  }
  return res.json(state.widgetPayload);
});

app.get("/debug/raw", (req, res) => {
  res.json({
    featuredRace: state.featuredRace,
    featuredRaceId: state.featuredRaceId,
    bettingMarkets: state.bettingMarkets,
    raceOdds: state.raceOdds,
    raceOddsLineMovement: state.raceOddsLineMovement,
    oddsErrors: state.oddsErrors,
  });
});

app.get("/debug/races", (req, res) => {
  res.json(state.races);
});

app.get("/debug/test-race/:id", async (req, res) => {
  const id = req.params.id;

  try {
    const raceOdds = await fetchRaceOdds(id).catch((e) => ({ error: e.message }));
    const lineMove = await fetchRaceOddsLineMovement(id).catch((e) => ({ error: e.message }));
    const bettingMarkets = await fetchBettingMarketsByRaceId(id).catch((e) => ({ error: e.message }));

    res.json({
      raceId: id,
      raceOdds,
      lineMove,
      bettingMarkets,
    });
  } catch (error) {
    res.status(500).json({
      raceId: id,
      error: error.message,
    });
  }
});

app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  await rebuildState();
  setInterval(rebuildState, POLL_MS);
});