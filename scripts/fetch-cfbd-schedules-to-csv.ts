// scripts/fetch-cfbd-schedules-to-csv.ts
import fs from "node:fs";

const API_KEY = process.env.CFBD_KEY || process.env.COLLEGE_FOOTBALL_API_KEY;
if (!API_KEY) { console.error("Missing CFBD_KEY"); process.exit(1); }

const YEAR = Number(process.env.YEAR || 2025);
const OUT = process.env.OUT || `csv/schedules_${YEAR}.csv`;
const MODE = (process.env.MODE || "sofar").toLowerCase() as "sofar" | "full"; // "sofar" (default) or "full"

type Game = {
  id: number;
  season: number;
  week?: number;
  seasonType: "regular" | "postseason";
  startDate?: string;
  completed?: boolean;
  conferenceGame: boolean;
  homeTeam: string; homeConference?: string | null; homePoints?: number | null;
  awayTeam: string; awayConference?: string | null; awayPoints?: number | null;
};

async function fetchGames(seasonType: "regular" | "postseason"): Promise<Game[]> {
  const url = new URL("https://api.collegefootballdata.com/games");
  url.searchParams.set("year", String(YEAR));
  url.searchParams.set("seasonType", seasonType);
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${API_KEY}`, accept: "application/json" },
  });
  if (!res.ok) throw new Error(`CFBD /games ${seasonType} HTTP ${res.status}`);
  return (await res.json()) as Game[];
}
function toType(g: Game): "CONFERENCE" | "NON_CONFERENCE" | "BOWL" | "CHAMPIONSHIP" {
  if (g.seasonType === "postseason") return g.conferenceGame ? "CHAMPIONSHIP" : "BOWL";
  return g.conferenceGame ? "CONFERENCE" : "NON_CONFERENCE";
}
function toResult(g: Game): "TBD" | "HOME_WIN" | "AWAY_WIN" | "TIE" {
  const h = g.homePoints, a = g.awayPoints;
  if (typeof h !== "number" || typeof a !== "number") return "TBD";
  if (h === a) return "TIE";
  return h > a ? "HOME_WIN" : "AWAY_WIN";
}
function writeCSV(rows: any[], outPath: string) {
  const header = ["id","season","week","date","type","conferenceGame","home","away","homeConference","awayConference","result","homePoints","awayPoints"];
  const esc = (v: any) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s; };
  const lines = [header.join(",")];
  for (const r of rows) lines.push(header.map(k => esc(r[k])).join(","));
  fs.mkdirSync(outPath.split("/").slice(0, -1).join("/") || ".", { recursive: true });
  fs.writeFileSync(outPath, lines.join("\n") + "\n", "utf8");
}

(async () => {
  const [reg, post] = await Promise.all([fetchGames("regular"), fetchGames("postseason")]);
  const now = new Date();
  let all = [...reg, ...post];
  if (MODE === "sofar") {
    all = all.filter(g => g.completed || (g.startDate && new Date(g.startDate) <= now));
  }

  // Keep only **FBS** games (any side in an FBS conference or known IND)
  const FBS = new Set(["SEC","Big Ten","Big 12","ACC","American Athletic","Mountain West","Mid-American","Sun Belt","Conference USA","Pac-12","FBS Independents","Independent"]);
  all = all.filter(g =>
    (g.homeConference && FBS.has(g.homeConference)) ||
    (g.awayConference && FBS.has(g.awayConference)) ||
    ["Notre Dame","UConn"].includes(g.homeTeam) || ["Notre Dame","UConn"].includes(g.awayTeam)
  );

  const rows = all.map(g => ({
    id: g.id, season: g.season, week: g.week ?? "", date: g.startDate ?? "",
    type: toType(g), conferenceGame: g.conferenceGame ? "true" : "false",
    home: g.homeTeam, away: g.awayTeam,
    homeConference: g.homeConference ?? "", awayConference: g.awayConference ?? "",
    result: toResult(g), homePoints: g.homePoints ?? "", awayPoints: g.awayPoints ?? ""
  }));
  writeCSV(rows, OUT);
  console.log(`Wrote ${rows.length} games → ${OUT} (mode=${MODE})`);
})().catch(e => { console.error(e); process.exit(1); });
