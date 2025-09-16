// scripts/fetch-cfbd-conferences-to-json.ts
import fs from "node:fs";
import path from "node:path";

const API_KEY = process.env.CFBD_KEY || process.env.COLLEGE_FOOTBALL_API_KEY;
if (!API_KEY) {
  console.error("Missing CFBD_KEY env var. Get a free key and set CFBD_KEY=your_key.");
  process.exit(1);
}

type CFBDConf = {
  id: number;
  name: string;         // e.g., "American Athletic"
  long_name?: string;   // sometimes present
  abbreviation?: string;// e.g., "AAC"
  classification?: string; // "fbs","fcs","ii","iii"
};

function mapConference(name: string, abbr?: string) {
  const norm = new Map<string, { id: string; shortName: string }>([
    ["SEC", { id: "sec", shortName: "SEC" }],
    ["Big Ten", { id: "b1g", shortName: "B1G" }],
    ["Big 12", { id: "b12", shortName: "Big12" }],
    ["ACC", { id: "acc", shortName: "ACC" }],
    ["American Athletic", { id: "aac", shortName: "AAC" }],
    ["Mountain West", { id: "mwc", shortName: "MWC" }],
    ["Mid-American", { id: "mac", shortName: "MAC" }],
    ["Sun Belt", { id: "sbc", shortName: "SBC" }],
    ["Conference USA", { id: "cusa", shortName: "CUSA" }],
    ["FBS Independents", { id: "ind", shortName: "IND" }],
    ["Independent", { id: "ind", shortName: "IND" }],
    // Keep for historical data if CFBD returns it:
    ["Pac-12", { id: "pac12", shortName: "Pac-12" }],
  ]);
  const hit = norm.get(name);
  if (hit) return hit;
  // Fallback: slug from abbreviation or name
  const id = (abbr || name).toLowerCase().replace(/[^a-z0-9]+/g, "");
  return { id, shortName: abbr || name };
}

(async () => {
  const res = await fetch("https://api.collegefootballdata.com/conferences", {
    headers: { Authorization: `Bearer ${API_KEY}`, accept: "application/json" },
  });
  if (!res.ok) throw new Error(`CFBD /conferences HTTP ${res.status}`);
  const data = (await res.json()) as CFBDConf[];
  const fbs = data.filter(c => (c.classification || "").toLowerCase() === "fbs");

  const out = fbs.map(c => {
    const mapped = mapConference(c.name, c.abbreviation);
    return {
      id: mapped.id,
      name: c.name,
      shortName: mapped.shortName,
      division: "FBS" as const,
    };
  });

  const outPath = path.join("src", "data", "conferences.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(`Wrote ${out.length} FBS conferences → ${outPath}`);
})().catch(e => { console.error(e); process.exit(1); });
