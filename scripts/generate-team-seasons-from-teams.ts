// scripts/generate-team-seasons-from-teams.ts
import fs from "node:fs";

const YEAR = Number(process.env.YEAR || 2025);
function idify(s: string) {
  return s.toLowerCase().replace(/&/g, "and").replace(/[.']/g, "").replace(/\s+/g, "-");
}
const text = fs.readFileSync("csv/teams.csv", "utf-8").trim().split("\n");
const header = text.shift();
if (!header || !/^name,shortName,conferenceId$/i.test(header)) {
  console.error("csv/teams.csv header must be: name,shortName,conferenceId");
  process.exit(1);
}
const rows = text.map(line => {
  const [name] = line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/); // naive CSV split for 1st field
  const teamId = idify(name.replace(/^"|"$/g, ""));
  return { teamId, season: YEAR, coach: "", spPlus: "", returningProduction: "", wins: 0, losses: 0, ties: 0, confWins: 0, confLosses: 0 };
});
const outHeader = "teamId,season,coach,spPlus,returningProduction,wins,losses,ties,confWins,confLosses\n";
const out = outHeader + rows.map(r => `${r.teamId},${r.season},,, ,0,0,0,0,0`).join("\n") + "\n";
fs.writeFileSync("csv/team_seasons.csv", out);
console.log(`Wrote ${rows.length} rows → csv/team_seasons.csv for ${YEAR}`);
