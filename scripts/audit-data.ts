// scripts/audit-data.ts
import fs from "node:fs";
import path from "node:path";

const DATA = path.join(process.cwd(), "src", "data");
const teams = JSON.parse(fs.readFileSync(path.join(DATA, "teams.json"), "utf-8"));
const games = JSON.parse(fs.readFileSync(path.join(DATA, "games.json"), "utf-8"));

const teamIds = new Set(teams.map((t:any) => t.id));
const missing = new Map<string, number>();

for (const g of games) {
  for (const id of [g.homeTeamId, g.awayTeamId]) {
    if (!teamIds.has(id)) missing.set(id, (missing.get(id) ?? 0) + 1);
  }
}
if (missing.size === 0) {
  console.log("All game refs resolve to teams ✅");
} else {
  console.log("Missing team IDs (count of refs):");
  for (const [id, n] of missing) console.log(id, n);
}
