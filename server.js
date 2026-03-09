import express from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

const NAME_ALIASES = {
  "wm byron": "william byron",
  "john hunter nemechek": "john h nemechek",
  "shane van gisbergen": "shane van gisbergen",
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

const buildRow = (driver, team, pos, overrides = {}) => {
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
    book: "DraftKings",
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
    pos,
    ...overrides
  };
};

const DATA = {
  nascar: {
    updatedAt: new Date().toISOString(),
    event: {
      name: "Straight Talk Wireless 500",
      status: "Live",
      books: 1,
      source: "Backend preview feed",
      sourceUpdatedLabel: "Backend live now"
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
      buildRow("Shane Van Gisbergen", "Trackhouse Racing", 37)
    ]
  },
  indycar: {
    updatedAt: new Date().toISOString(),
    event: {
      name: "Good Ranchers 250",
      status: "Live",
      books: 1,
      source: "Backend preview feed",
      sourceUpdatedLabel: "Backend live now"
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
      buildRow("Will Power", "Andretti Global", 25)
    ]
  },
  imsa: {
    updatedAt: new Date().toISOString(),
    event: {
      name: "Sebring Placeholder",
      status: "Live",
      books: 1,
      source: "Backend preview feed",
      sourceUpdatedLabel: "Backend live now"
    },
    rows: [
      buildRow("Felipe Nasr", "Porsche Penske", 1),
      buildRow("Tom Blomqvist", "Acura Meyer Shank", 2)
    ]
  },
  "mx-5 cup": {
    updatedAt: new Date().toISOString(),
    event: {
      name: "MX-5 Cup Demo",
      status: "Live",
      books: 1,
      source: "Backend preview feed",
      sourceUpdatedLabel: "Backend live now"
    },
    rows: [
      buildRow("Connor Zilisch", "BSI", 1),
      buildRow("Gresham Wagner", "JTR", 2)
    ]
  }
};

function getDraftKingsEventGroupId(series) {
  const ids = {
    nascar: process.env.DK_EVENT_GROUP_NASCAR || "88670866",
    indycar: process.env.DK_EVENT_GROUP_INDYCAR || "88670867",
    imsa: process.env.DK_EVENT_GROUP_IMSA || "88670868",
    "mx-5 cup": process.env.DK_EVENT_GROUP_MX5 || "88670869",
  };
  return ids[series];
}

async function fetchDraftKingsRaw(series) {
  const eventGroupId = getDraftKingsEventGroupId(series);
  if (!eventGroupId) return null;

  const url = `https://sportsbook-nash-usmi.draftkings.com/sites/US-MI-SB/api/v5/eventgroups/${eventGroupId}?format=json`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "User-Agent": "Mozilla/5.0",
      Accept: "application/json, text/plain, */*",
    },
  });

  if (!response.ok) {
    throw new Error(`DraftKings returned ${response.status}`);
  }

  return await response.json();
}

function extractWinnerOddsMap(rawJson) {
  const map = {};
  const offerCategories =
    rawJson?.eventGroup?.offerCategories || rawJson?.offerCategories || [];

  for (const category of offerCategories) {
    for (const descriptor of category?.offerSubcategoryDescriptors || []) {
      const offerRows = descriptor?.offerSubcategory?.offers || [];
      for (const offerRow of offerRows) {
        for (const offer of offerRow || []) {
          const offerLabel = `${offer?.label || ""} ${offer?.subcategoryName || ""}`.toLowerCase();
          const looksLikeWinnerMarket =
            offerLabel.includes("winner") ||
            offerLabel.includes("outright") ||
            offerLabel.includes("race winner");

          if (!looksLikeWinnerMarket && offer?.outcomes?.length !== 1 && offer?.outcomes?.length < 10) {
            continue;
          }

          for (const outcome of offer?.outcomes || []) {
            const driverName = outcome?.label || outcome?.participant || outcome?.name;
            const americanOdds =
              outcome?.oddsAmerican ||
              outcome?.odds ||
              outcome?.displayOdds?.american;

            if (!driverName || !americanOdds) continue;

            map[normalizeName(driverName)] = {
              winnerOdds: String(americanOdds),
            };
          }
        }
      }
    }
  }

  return map;
}

function patchRowsWithRealOdds(rows, oddsMap) {
  return rows.map((row) => {
    const key = normalizeName(row.driver);
    const real = oddsMap[key];

    if (!real?.winnerOdds) return row;

    const previousWinner = row.winnerOdds;
    const nextWinner = real.winnerOdds;

    return {
      ...row,
      winnerOdds: nextWinner,
      winnerPrev: previousWinner,
      winnerMove:
        nextWinner === previousWinner
          ? "flat"
          : parseInt(nextWinner.replace("+", ""), 10) <
            parseInt(previousWinner.replace("+", ""), 10)
          ? "down"
          : "up",
      eventSource: "DraftKings prototype feed"
    };
  });
}

app.get("/", (req, res) => {
  res.json({ message: "Motorsports API is running" });
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/widget/odds", async (req, res) => {
  const series = String(req.query.series || "nascar").toLowerCase();
  const payload = structuredClone(DATA[series] || DATA.nascar);

  try {
    const raw = await fetchDraftKingsRaw(series);
    const winnerOddsMap = extractWinnerOddsMap(raw);

    payload.rows = patchRowsWithRealOdds(payload.rows, winnerOddsMap);
    payload.updatedAt = new Date().toISOString();
    payload.event.source = "DraftKings prototype feed";
    payload.event.sourceUpdatedLabel = "Live prototype";
    return res.json(payload);
  } catch (error) {
    console.error(`DraftKings fetch failed for ${series}`, error);
    payload.updatedAt = new Date().toISOString();
    payload.event.source = "Backend preview feed";
    payload.event.sourceUpdatedLabel = "Fallback preview";
    return res.json(payload);
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});