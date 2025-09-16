// scripts/fetch-cfbd-teams-to-csv.ts
import fs from "node:fs";
import path from "node:path";

const API_KEY = process.env.CFBD_KEY || process.env.COLLEGE_FOOTBALL_API_KEY;
if (!API_KEY) {
  console.error("Missing CFBD_KEY env var.");
  process.exit(1);
}

const YEAR = Number(process.env.YEAR || 2025);
type Team = {
  id: number;
  school: string;          // e.g., "Georgia"
  mascot?: string | null;  // "Bulldogs"
  abbreviation?: string | null; // "UGA"
  conference?: string | null;   // "SEC", "American Athletic", "FBS Independents", etc.
  classification?: string | null; // "fbs"
};

function csvEscape(s: string | number | null | undefined): string {
  const v = s == null ? "" : String(s);
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}
function writeCSV(rows: any[], outPath: string) {
  const header = ["name","shortName","conferenceId"];
  const lines = [header.join(",")];
  for (const r of rows) lines.push(header.map(k => csvEscape((r as any)[k])).join(","));
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, lines.join("\n") + "\n");
}
function mapConferenceId(name?: string | null) {
  if (!name) return "";
  const m: Record<string,string> = {
    "SEC":"sec","Big Ten":"b1g","Big 12":"b12","ACC":"acc",
    "American Athletic":"aac","Mountain West":"mwc","Mid-American":"mac",
    "Sun Belt":"sbc","Conference USA":"cusa","FBS Independents":"ind","Independent":"ind",
    "Pac-12":"pac12"
  };
  return m[name] || name.toLowerCase().replace(/[^a-z0-9]+/g, "");
}
function deriveShortName(team: Team) {
  if (team.abbreviation && team.abbreviation.trim()) return team.abbreviation.trim().toUpperCase();
  // fallback: initials from school name
  return team.school.split(/\s+/).map(w => w[0]).join("").toUpperCase().slice(0, 4);
}

(async () => {
  const url = new URL("https://api.collegefootballdata.com/teams");
  url.searchParams.set("year", String(YEAR)); // year helps constrain membership
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${API_KEY}`, accept: "application/json" },
  });
  if (!res.ok) throw new Error(`CFBD /teams HTTP ${res.status}`);
  const all = (await res.json()) as Team[];

  const fbs = all.filter(t => (t.classification || "").toLowerCase() === "fbs");
  const rows = fbs.map(t => ({
    name: t.school,
    shortName: deriveShortName(t),
    conferenceId: mapConferenceId(t.conference || (t.school === "Notre Dame" || t.school === "UConn" ? "FBS Independents" : "")),
  }));

  writeCSV(rows, path.join("csv", "teams.csv"));
  console.log(`Wrote ${rows.length} FBS teams → csv/teams.csv`);
})();
