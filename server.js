import express from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 8080;

const SPORTSDATAIO_API_KEY = process.env.SPORTSDATAIO_API_KEY || "";
const POLL_MS = Number(process.env.POLL_MS || 10000);

app.use(cors());
app.use(express.json());

function currentSeasonYear() {
  return new Date().getFullYear();
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

function computeMove(current, previous) {
  if (!current || !previous || current === previous) return "flat";
  const c = Number(String(current).replace("+", ""));
  const p = Number(String(previous).replace("+", ""));
  if (!Number.isFinite(c) || !Number.isFinite(p)) return "flat";
  return c < p ? "down" : "up";
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
    book: "SportsDataIO Preview",
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
    pos,
    ...overrides,
  };
}

async function sportsDataIoGet(path) {
  if (!SPORTSDATAIO_API_KEY) {
    throw new Error("Missing SPORTSDATAIO_API_KEY");
  }

  const url = new URL(path);
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

async function fetchDrivers() {
  return await sportsDataIoGet("https://api.sportsdata.io/nascar/v2/json/drivers");
}

async function fetchSeries() {
  return await sportsDataIoGet("https://api.sportsdata.io/nascar/v2/json/series");
}

async function fetchTracks(season) {
  return await sportsDataIoGet(`https://api.sportsdata.io/nascar/v2/json/tracks/${season}`);
}

async function fetchSchedules(season) {
  return await sportsDataIoGet(`https://api.sportsdata.io/nascar/v2/json/races/${season}`);
}

async function fetchBettingMetadata() {
  return await sportsDataIoGet("https://api.sportsdata.io/v3/nascar/odds/json/BettingMetaData");
}

async function fetchActiveSportsbooks() {
  return await sportsDataIoGet("https://api.sportsdata.io/v3/nascar/odds/json/ActiveSportsbooks");
}

async function fetchRaceResult(raceId) {
  return await sportsDataIoGet(`https://api.sportsdata.io/nascar/v2/json/raceresult/${raceId}`);
}

function chooseFeaturedRace(races) {
  const now = new Date();

  const enriched = (races || [])
    .map((race) => {
      const d =
        parseDateMaybe(race?.DateTime) ||
        parseDateMaybe(race?.Date) ||
        parseDateMaybe(race?.Day);
      return { race, when: d };
    })
    .filter((x) => x.when);

  if (enriched.length === 0) return null;

  const upcoming = enriched
    .filter((x) => x.when >= now)
    .sort((a, b) => a.when - b.when);

  if (upcoming.length > 0) return upcoming[0].race;

  const mostRecent = enriched
    .filter((x) => x.when < now)
    .sort((a, b) => b.when - a.when);

  return mostRecent[0]?.race || enriched[0].race;
}

function inferTeamName(driver) {
  return (
    driver?.Team ||
    driver?.TeamName ||
    driver?.Manufacturer ||
    "Unknown Team"
  );
}

function mergeLeaderboardIntoRows(rows, leaderboard) {
  if (!Array.isArray(leaderboard) || leaderboard.length === 0) return rows;

  const byDriver = new Map(
    leaderboard.map((entry, index) => [
      normalizeName(entry?.Name || entry?.DriverName || entry?.Driver?.Name),
      { entry, index: index + 1 },
    ])
  );

  return rows.map((row) => {
    const found = byDriver.get(normalizeName(row.driver));
    if (!found) return row;

    const finishPos =
      found.entry?.Position ||
      found.entry?.FinishPosition ||
      found.entry?.Rank ||
      found.index;

    return {
      ...row,
      pos: finishPos,
    };
  });
}

function buildRowsFromDrivers(drivers) {
  return (drivers || [])
    .map((driver, index) =>
      buildFallbackRow(
        driver?.Name || driver?.DriverName || `Driver ${index + 1}`,
        inferTeamName(driver),
        index + 1,
        {
          driverId: driver?.DriverID || driver?.ID || null,
          manufacturer: driver?.Manufacturer || null,
        }
      )
    )
    .sort((a, b) => a.pos - b.pos);
}

const state = {
  lastPollAt: null,
  lastSuccessAt: null,
  health: "starting",
  message: "Booting SportsDataIO poller",
  season: currentSeasonYear(),
  series: [],
  tracks: [],
  drivers: [],
  races: [],
  activeSportsbooks: [],
  bettingMetadata: null,
  featuredRace: null,
  leaderboard: [],
  widgetPayload: null,
};

async function rebuildState() {
  state.lastPollAt = new Date().toISOString();
  const season = currentSeasonYear();

  try {
    const [
      drivers,
      series,
      tracks,
      races,
      bettingMetadata,
      activeSportsbooks,
    ] = await Promise.all([
      fetchDrivers(),
      fetchSeries(),
      fetchTracks(season),
      fetchSchedules(season),
      fetchBettingMetadata(),
      fetchActiveSportsbooks(),
    ]);

    state.season = season;
    state.drivers = drivers || [];
    state.series = series || [];
    state.tracks = tracks || [];
    state.races = races || [];
    state.bettingMetadata = bettingMetadata || null;
    state.activeSportsbooks = activeSportsbooks || [];

    const featuredRace = chooseFeaturedRace(state.races);
    state.featuredRace = featuredRace;

    let leaderboard = [];
    const raceId =
      featuredRace?.RaceID ||
      featuredRace?.RaceId ||
      featuredRace?.ID ||
      featuredRace?.Id;

    if (raceId) {
      try {
        leaderboard = await fetchRaceResult(raceId);
      } catch (error) {
        console.error("Race result fetch failed:", error.message);
      }
    }

    state.leaderboard = Array.isArray(leaderboard) ? leaderboard : [];

    let rows = buildRowsFromDrivers(state.drivers);
    rows = mergeLeaderboardIntoRows(rows, state.leaderboard);

    const activeBookCount = Array.isArray(state.activeSportsbooks)
      ? state.activeSportsbooks.length
      : 0;

    const raceName =
      featuredRace?.Name ||
      featuredRace?.RaceName ||
      featuredRace?.Track ||
      "NASCAR Featured Event";

    state.widgetPayload = {
      updatedAt: new Date().toISOString(),
      event: {
        name: raceName,
        status: state.leaderboard.length > 0 ? "Live/Result Feed" : "Schedule Feed",
        books: activeBookCount,
        source: "SportsDataIO",
        sourceUpdatedLabel: "Drivers + schedules + sportsbooks + metadata",
      },
      rows,
      meta: {
        season: state.season,
        featuredRaceId: raceId || null,
        activeSportsbooks: state.activeSportsbooks,
        bettingMetadata: state.bettingMetadata,
      },
    };

    state.lastSuccessAt = new Date().toISOString();
    state.health = "ok";
    state.message = "SportsDataIO polling healthy";
  } catch (error) {
    console.error("SportsDataIO poll failed:", error.message);
    state.health = "error";
    state.message = error.message;

    if (!state.widgetPayload) {
      state.widgetPayload = {
        updatedAt: new Date().toISOString(),
        event: {
          name: "NASCAR Featured Event",
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
    status: state.health,
    message: state.message,
    lastPollAt: state.lastPollAt,
    lastSuccessAt: state.lastSuccessAt,
    featuredRace: state.featuredRace?.Name || state.featuredRace?.RaceName || null,
    sportsbooks: state.activeSportsbooks?.length || 0,
  });
});

app.get("/sports-check", async (req, res) => {
  res.json({
    provider: "SportsDataIO",
    season: state.season,
    activeSportsbooks: state.activeSportsbooks,
    bettingMetadataAvailable: !!state.bettingMetadata,
    featuredRace: state.featuredRace,
  });
});

app.get("/widget/odds", (req, res) => {
  if (!state.widgetPayload) {
    return res.status(503).json({
      error: "Widget payload not ready yet",
    });
  }

  return res.json(state.widgetPayload);
});

app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  await rebuildState();
  setInterval(rebuildState, POLL_MS);
});