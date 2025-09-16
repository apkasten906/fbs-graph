// scripts/fetch-cfbd-2025-to-csv.ts
/* Fetch all FBS games for 2025 (played so far) and write CSV in our importer format. */
import fs from "node:fs";

const API_KEY = process.env.CFBD_KEY || process.env.COLLEGE_FOOTBALL_API_KEY;
if (!API_KEY) {
  console.error("Missing CFBD_KEY env var. Get a free key and set CFBD_KEY=your_key.");
  process.exit(1);
}

const YEAR = Number(process.env.YEAR || 2025);
const OUT = process.env.OUT || "csv/schedules_2025.csv";
const NOW = new Date();

// Power 4 + IND roster (matches your repo) for optional filtering
const P4_IND_TEAMS = new Set([
  // SEC
  "Alabama","Arkansas","Auburn","Florida","Georgia","Kentucky","LSU","Mississippi State","Missouri","Ole Miss","South Carolina","Tennessee","Texas A&M","Texas","Oklahoma","Vanderbilt",
  // B1G
  "Illinois","Indiana","Iowa","Maryland","Michigan","Michigan State","Minnesota","Nebraska","Northwestern","Ohio State","Penn State","Purdue","Rutgers","Wisconsin","USC","UCLA","Oregon","Washington",
  // Big 12
  "Arizona","Arizona State","Baylor","BYU","Cincinnati","Colorado","Houston","Iowa State","Kansas","Kansas State","Oklahoma State","TCU","Texas Tech","UCF","Utah","West Virginia",
  // ACC
  "Boston College","California","Clemson","Duke","Florida State","Georgia Tech","Louisville","Miami","North Carolina","NC State","Pitt","SMU","Stanford","Syracuse","Virginia","Virginia Tech","Wake Forest",
  // Independents (your project)
  "Notre Dame","UConn",
]);

// Toggle with env: SCOPE=all (default) | p4  -> p4 restricts to games where BOTH teams are in your dataset
const SCOPE = (process.env.SCOPE || "all").toLowerCase() as "all" | "p4";

type Game = {
  id: number;
  season: number;
  week?: number;
  seasonType: "regular" | "postseason";
  startDate?: string;
  status?: string;
  completed?: boolean;
  conferenceGame: boolean;
  homeTeam: string;
  homeConference?: string | null;
  homePoints?: number | null;
  awayTeam: string;
  awayConference?: string | null;
  awayPoints?: number | null;
  notes?: string | null;
};

async function fetchGames(seasonType: "regular" | "postseason"): Promise<Game[]> {
  const url = new URL("https://api.collegefootballdata.com/games");
  url.searchParams.set("year", String(YEAR));
  url.searchParams.set("seasonType", seasonType);
  // CFBD supports classification filtering in clients; REST often returns all—filter below if needed. :contentReference[oaicite:1]{index=1}

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${API_KEY}`, accept: "application/json" },
  });
  if (!res.ok) throw new Error(`CFBD /games ${seasonType} HTTP ${res.status}`);
  return (await res.json()) as Game[];
}

function toType(g: Game): "CONFERENCE" | "NON_CONFERENCE" | "BOWL" | "CHAMPIONSHIP" {
  if (g.seasonType === "postseason") {
    return g.conferenceGame ? "CHAMPIONSHIP" : "BOWL"; // simple mapping works fine for leverage
  }
  return g.conferenceGame ? "CONFERENCE" : "NON_CONFERENCE";
}

function toResult(g: Game): "TBD" | "HOME_WIN" | "AWAY_WIN" | "TIE" {
  const h = g.homePoints, a = g.awayPoints;
  if (typeof h !== "number" || typeof a !== "number") return "TBD";
  if (h === a) return "TIE";
  return h > a ? "HOME_WIN" : "AWAY_WIN";
}

function csvEscape(s: string | number | null | undefined): string {
  const v = s == null ? "" : String(s);
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function writeCSV(rows: any[], outPath: string) {
  const header = [
    "id","season","week","date","type","conferenceGame","home","away","homeConference","awayConference",
    "result","homePoints","awayPoints"
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(header.map(k => csvEscape(r[k])).join(","));
  }
  fs.writeFileSync(outPath, lines.join("\n") + "\n", "utf8");
}

function isPlayedSoFar(g: Game): boolean {
  // Include games that have started before "now"; CFBD also has 'completed' boolean.
  if (g.completed) return true;
  if (!g.startDate) return false;
  return new Date(g.startDate) <= NOW;
}

function inP4Subset(g: Game): boolean {
  return P4_IND_TEAMS.has(g.homeTeam) && P4_IND_TEAMS.has(g.awayTeam);
}

(async () => {
  const [reg, post] = await Promise.all([fetchGames("regular"), fetchGames("postseason")]);
  let all = [...reg, ...post].filter(isPlayedSoFar);

  // Filter to FBS by conference name (covers Group of 5 + P4 + Independents)
  const FBS_CONFS = new Set([
    "SEC","Big Ten","Big 12","ACC","American Athletic","Mountain West","Mid-American","Sun Belt","Conference USA","Pac-12","FBS Independents","Independent"
  ]);
  all = all.filter(g =>
    (g.homeConference && FBS_CONFS.has(g.homeConference)) ||
    (g.awayConference && FBS_CONFS.has(g.awayConference)) ||
    g.homeTeam === "Notre Dame" || g.awayTeam === "Notre Dame" || g.homeTeam === "UConn" || g.awayTeam === "UConn"
  );

  if (SCOPE === "p4") {
    all = all.filter(inP4Subset);
  }

  const rows = all.map(g => ({
    id: g.id,
    season: g.season,
    week: g.week ?? "",
    date: g.startDate ?? "",
    type: toType(g),
    conferenceGame: g.conferenceGame ? "true" : "false",
    home: g.homeTeam,
    away: g.awayTeam,
    homeConference: g.homeConference ?? "",
    awayConference: g.awayConference ?? "",
    result: toResult(g),
    homePoints: g.homePoints ?? "",
    awayPoints: g.awayPoints ?? ""
  }));

  fs.mkdirSync("csv", { recursive: true });
  writeCSV(rows, OUT);
  console.log(`Wrote ${rows.length} rows to ${OUT} (scope=${SCOPE})`);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
