import express from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 8080;

// ====== CONFIG ======
// Put your real API key in Azure App Settings / local environment
const ODDS_API_KEY = process.env.ODDS_API_KEY || "";
const POLL_MS = Number(process.env.POLL_MS || 10000);

// These sport keys are placeholders until you confirm the exact motorsports keys
// available on your The Odds API plan/account.
const SPORT_KEYS = {
  nascar: process.env.ODDS_API_SPORT_NASCAR || "racing_nascar",
  indycar: process.env.ODDS_API_SPORT_INDYCAR || "racing_indycar",
  imsa: process.env.ODDS_API_SPORT_IMSA || "racing_imsa",
  "mx-5 cup": process.env.ODDS_API_SPORT_MX5 || "racing_mx5_cup",
};

// Use bookmaker keys from The Odds API once you confirm exact names on your account.
const BOOKMAKERS = (
  process.env.ODDS_API_BOOKMAKERS ||
  "draftkings,fanduel,betmgm,caesars"
).split(",");

// Markets to request. h2h is the most reliable/common market in The Odds API docs.
// Outright/winner-style motorsports coverage may vary by sport key/account.
const MARKETS = (process.env.ODDS_API_MARKETS || "h2h").split(",");

app.use(cors());
app.use(express.json());

// ====== HELPERS ======
const NAME_ALIASES = {
  "wm byron": "william byron",
  "john hunter nemechek": "john h nemechek",
  "svg": "shane van gisbergen",
};

function normalizeName(name) {
  const cleaned = String(name || "")
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/'/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return NAME_ALIASES[cleaned] || cleaned;
}

function parseAmericanOdds(odds) {
  if (typeof odds !== "string") return Number.POSITIVE_INFINITY;
  const n = Number(odds.replace("+", ""));
  return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
}

function bestAmericanOdds(oddsList) {
  if (!Array.isArray(oddsList) || oddsList.length === 0) return null;
  return [...oddsList].sort((a, b) => parseAmericanOdds(a) - parseAmericanOdds(b))[0];
}

function computeMove(current, previous) {
  if (!current || !previous || current === previous) return "flat";
  return parseAmericanOdds(current) < parseAmericanOdds(previous) ? "down" : "up";
}

function buildRow(driver, team, pos, overrides = {}) {
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
    driver,
    team,
    book: "Best Available",
    winnerOdds: generatedWinnerOdds,
    winnerPrev: generatedWinnerPrev,
    winnerMove: "down",
    moneyline: generatedMoneyline,
    moneylinePrev: generatedMoneylinePrev,
    moneylineMove: "down",
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

// ====== BASE FALLBACK DATA ======
const BASE_DATA = {
  nascar: {
    updatedAt: new Date().toISOString(),
    event: {
      name: "NASCAR Event",
      status: "Live",
      books: 0,
      source: "Backend preview feed",
      sourceUpdatedLabel: "Fallback mode",
    },
    rows: [
      buildRow("Ryan Blaney", "Team Penske", 1),
      buildRow("Denny Hamlin", "Joe Gibbs Racing", 2),
      buildRow("Kyle Larson", "Hendrick Motorsports", 3),
      buildRow("Christopher Bell", "Joe Gibbs Racing", 4),
      buildRow("William Byron", "Hendrick Motorsports", 5),
      buildRow("Tyler Reddick", "23XI Racing", 6),
      buildRow("Ross Chastain", "Trackhouse Racing", 7),
      buildRow("Austin Cindric", "Team Penske", 8),
      buildRow("Austin Dillon", "Richard Childress Racing", 9),
      buildRow("Noah Gragson", "Front Row Motorsports", 10),
      buildRow("Brad Keselowski", "RFK Racing", 11),
      buildRow("Daniel Suárez", "Spire Motorsports", 12),
      buildRow("Kyle Busch", "Richard Childress Racing", 13),
      buildRow("Chase Elliott", "Hendrick Motorsports", 14),
      buildRow("Ty Dillon", "Kaulig Racing", 15),
      buildRow("AJ Allmendinger", "Kaulig Racing", 16),
      buildRow("Chris Buescher", "RFK Racing", 17),
      buildRow("Chase Briscoe", "Joe Gibbs Racing", 18),
      buildRow("Josh Berry", "Wood Brothers Racing", 19),
      buildRow("Joey Logano", "Team Penske", 20),
      buildRow("Bubba Wallace", "23XI Racing", 21),
      buildRow("Austin Hill", "Richard Childress Racing", 22),
      buildRow("Todd Gilliland", "Front Row Motorsports", 23),
      buildRow("Riley Herbst", "23XI Racing", 24),
      buildRow("Zane Smith", "Front Row Motorsports", 25),
      buildRow("Cole Custer", "Haas Factory Team", 26),
      buildRow("John H. Nemechek", "Legacy Motor Club", 27),
      buildRow("Erik Jones", "Legacy Motor Club", 28),
      buildRow("Ricky Stenhouse Jr", "HYAK Motorsports", 29),
      buildRow("Anthony Alfredo", "Hendrick Motorsports", 30),
      buildRow("Cody Ware", "Rick Ware Racing", 31),
      buildRow("Ty Gibbs", "Joe Gibbs Racing", 32),
      buildRow("Ryan Preece", "RFK Racing", 33),
      buildRow("Michael McDowell", "Spire Motorsports", 34),
      buildRow("Carson Hocevar", "Spire Motorsports", 35),
      buildRow("Connor Zilisch", "Trackhouse Racing", 36),
      buildRow("Shane Van Gisbergen", "Trackhouse Racing", 37),
    ],
  },
  indycar: {
    updatedAt: new Date().toISOString(),
    event: {
      name: "IndyCar Event",
      status: "Live",
      books: 0,
      source: "Backend preview feed",
      sourceUpdatedLabel: "Fallback mode",
    },
    rows: [
      buildRow("Josef Newgarden", "Team Penske", 1),
      buildRow("David Malukas", "Team Penske", 2),
      buildRow("Alex Palou", "Chip Ganassi Racing", 3),
      buildRow("Pato O'Ward", "Arrow McLaren", 4),
      buildRow("Scott McLaughlin", "Team Penske", 5),
      buildRow("Scott Dixon", "Chip Ganassi Racing", 6),
      buildRow("Graham Rahal", "Rahal Letterman Lanigan Racing", 7),
      buildRow("Mick Schumacher", "Rahal Letterman Lanigan Racing", 8),
      buildRow("Alexander Rossi", "ECR", 9),
      buildRow("Rinus VeeKay", "Juncos Hollinger Racing", 10),
      buildRow("Nolan Siegel", "Arrow McLaren", 11),
      buildRow("Kyle Kirkwood", "Andretti Global w/ Curb-Agajanian", 12),
      buildRow("Sting Ray Robb", "Juncos Hollinger Racing", 13),
      buildRow("Marcus Armstrong", "Meyer Shank w/ Curb-Agajanian", 14),
      buildRow("Marcus Ericsson", "Andretti Global", 15),
      buildRow("Louis Foster", "Rahal Letterman Lanigan Racing", 16),
      buildRow("Christian Lundgaard", "Arrow McLaren", 17),
      buildRow("Christian Rasmussen", "ECR", 18),
      buildRow("Kyffin Simpson", "Chip Ganassi Racing", 19),
      buildRow("Romain Grosjean", "Dale Coyne Racing", 20),
      buildRow("Santino Ferrucci", "A.J. Foyt Enterprises", 21),
      buildRow("Dennis Hauger", "Dale Coyne Racing", 22),
      buildRow("Caio Collet", "A.J. Foyt Enterprises", 23),
      buildRow("Felix Rosenqvist", "Meyer Shank w/ Curb-Agajanian", 24),
      buildRow("Will Power", "Andretti Global", 25),
    ],
  },
  imsa: {
    updatedAt: new Date().toISOString(),
    event: {
      name: "IMSA Event",
      status: "Live",
      books: 0,
      source: "Backend preview feed",
      sourceUpdatedLabel: "Fallback mode",
    },
    rows: [
      buildRow("Felipe Nasr", "Porsche Penske", 1),
      buildRow("Tom Blomqvist", "Acura Meyer Shank", 2),
    ],
  },
  "mx-5 cup": {
    updatedAt: new Date().toISOString(),
    event: {
      name: "MX-5 Cup Event",
      status: "Live",
      books: 0,
      source: "Backend preview feed",
      sourceUpdatedLabel: "Fallback mode",
    },
    rows: [
      buildRow("Connor Zilisch", "BSI", 1),
      buildRow("Gresham Wagner", "JTR", 2),
    ],
  },
};

// ====== IN-MEMORY CACHE ======
const snapshots = {
  nascar: structuredClone(BASE_DATA.nascar),
  indycar: structuredClone(BASE_DATA.indycar),
  imsa: structuredClone(BASE_DATA.imsa),
  "mx-5 cup": structuredClone(BASE_DATA["mx-5 cup"]),
};

const health = {
  status: "starting",
  lastPollAt: null,
  lastSuccessAt: null,
  message: "Poller booting",
};

// ====== THE ODDS API ======
async function fetchOddsApiForSeries(series) {
  if (!ODDS_API_KEY) {
    throw new Error("Missing ODDS_API_KEY");
  }

  const sportKey = SPORT_KEYS[series];
  if (!sportKey) {
    throw new Error(`No sport key configured for ${series}`);
  }

  const url = new URL(`https://api.the-odds-api.com/v4/sports/${sportKey}/odds`);
  url.searchParams.set("apiKey", ODDS_API_KEY);
  url.searchParams.set("regions", "us");
  url.searchParams.set("oddsFormat", "american");
  url.searchParams.set("bookmakers", BOOKMAKERS.join(","));
  url.searchParams.set("markets", MARKETS.join(","));

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`The Odds API returned ${response.status}: ${body}`);
  }

  return await response.json();
}

// The Odds API is event-based. For motorsports outrights, the shape can differ from team sports.
// This extractor is defensive and tries to gather participant/outcome prices from bookmakers.
function extractOutcomeMapFromOddsApi(rawEvents) {
  const map = {};

  for (const event of rawEvents || []) {
    for (const bookmaker of event?.bookmakers || []) {
      const bookTitle = bookmaker?.title || bookmaker?.key || "Unknown";
      for (const market of bookmaker?.markets || []) {
        const marketKey = market?.key || "";

        for (const outcome of market?.outcomes || []) {
          const name = outcome?.name;
          const price = outcome?.price;

          if (!name || price === undefined || price === null) continue;

          const american = String(price).startsWith("+") || String(price).startsWith("-")
            ? String(price)
            : Number(price) >= 0
            ? `+${price}`
            : String(price);

          const normalized = normalizeName(name);
          if (!map[normalized]) {
            map[normalized] = {
              winnerByBook: {},
              moneylineByBook: {},
            };
          }

          // For this first integration, h2h maps to moneyline and anything else gets treated as winner-like.
          if (marketKey === "h2h") {
            map[normalized].moneylineByBook[bookTitle] = american;
          } else {
            map[normalized].winnerByBook[bookTitle] = american;
          }
        }
      }
    }
  }

  return map;
}

function patchRowsWithOddsApi(rows, outcomeMap) {
  return rows.map((row) => {
    const normalized = normalizeName(row.driver);
    const real = outcomeMap[normalized];

    if (!real) return row;

    const winnerPrices = Object.values(real.winnerByBook || {});
    const moneylinePrices = Object.values(real.moneylineByBook || {});

    const bestWinner = bestAmericanOdds(winnerPrices);
    const bestMoneyline = bestAmericanOdds(moneylinePrices);

    const nextWinner = bestWinner || row.winnerOdds;
    const nextMoneyline = bestMoneyline || row.moneyline;

    const perBook = {
      ...(real.winnerByBook || {}),
      ...(real.moneylineByBook || {}),
    };

    return {
      ...row,
      book: Object.keys(perBook).length ? "Best Available" : row.book,
      winnerPrev: row.winnerOdds,
      winnerOdds: nextWinner,
      winnerMove: computeMove(nextWinner, row.winnerOdds),
      moneylinePrev: row.moneyline,
      moneyline: nextMoneyline,
      moneylineMove: computeMove(nextMoneyline, row.moneyline),
      perBook,
      books: Object.keys(perBook).length,
    };
  });
}

async function pollSeries(series) {
  const fallback = structuredClone(BASE_DATA[series]);

  try {
    const rawEvents = await fetchOddsApiForSeries(series);
    const outcomeMap = extractOutcomeMapFromOddsApi(rawEvents);
    const rows = patchRowsWithOddsApi(fallback.rows, outcomeMap);

    snapshots[series] = {
      ...fallback,
      updatedAt: new Date().toISOString(),
      event: {
        ...fallback.event,
        books: BOOKMAKERS.length,
        source: "The Odds API",
        sourceUpdatedLabel: "Live polled feed",
      },
      rows,
    };
  } catch (error) {
    console.error(`Polling failed for ${series}:`, error.message);
    snapshots[series] = {
      ...fallback,
      updatedAt: new Date().toISOString(),
      event: {
        ...fallback.event,
        books: 0,
        source: "Backend preview feed",
        sourceUpdatedLabel: "Fallback after API failure",
      },
    };
  }
}

async function pollAll() {
  health.lastPollAt = new Date().toISOString();

  try {
    await Promise.all(Object.keys(snapshots).map((series) => pollSeries(series)));
    health.lastSuccessAt = new Date().toISOString();
    health.status = "ok";
    health.message = "Polling healthy";
  } catch (error) {
    health.status = "error";
    health.message = error instanceof Error ? error.message : "Unknown polling error";
  }
}

// ====== ROUTES ======
app.get("/", (req, res) => {
  res.json({ message: "Motorsports API is running" });
});

app.get("/health", (req, res) => {
  res.json(health);
});

app.get("/widget/odds", (req, res) => {
  const series = String(req.query.series || "nascar").toLowerCase();
  const snapshot = snapshots[series] || snapshots.nascar;
  return res.json(snapshot);
});

app.get("/sports-check", async (req, res) => {
  if (!ODDS_API_KEY) {
    return res.status(400).json({
      error: "Missing ODDS_API_KEY"
    });
  }

  try {
    const url = new URL("https://api.the-odds-api.com/v4/sports");
    url.searchParams.set("apiKey", ODDS_API_KEY);

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      const body = await response.text();
      return res.status(response.status).json({
        error: `The Odds API returned ${response.status}`,
        body
      });
    }

    const sports = await response.json();

    const motorsportsOnly = sports.filter((sport) => {
      const key = String(sport.key || "").toLowerCase();
      const title = String(sport.title || "").toLowerCase();
      const group = String(sport.group || "").toLowerCase();

      return (
        key.includes("racing") ||
        key.includes("nascar") ||
        key.includes("indy") ||
        key.includes("motorsport") ||
        title.includes("nascar") ||
        title.includes("indy") ||
        title.includes("racing") ||
        group.includes("racing")
      );
    });

    return res.json({
      totalSports: sports.length,
      motorsportsOnly
    });
  } catch (error) {
    console.error("sports-check failed", error);
    return res.status(500).json({
      error: "sports-check failed",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// ====== START ======
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  await pollAll();
  setInterval(pollAll, POLL_MS);
});