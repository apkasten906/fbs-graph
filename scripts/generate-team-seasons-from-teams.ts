import fs from 'node:fs';
const YEAR = Number(process.env.YEAR || 2025);
function idify(s: string) {
  return s
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[.']/g, '')
    .replace(/[()]/g, '')
    .replace(/\s+/g, '-');
}
const text = fs.readFileSync('csv/teams.csv', 'utf-8').trim().split('\n');
const header = text.shift();
if (!header || !/^name\s*,\s*shortName\s*,\s*conferenceId$/i.test(header)) {
  console.error('csv/teams.csv header must be: name,shortName,conferenceId');
  process.exit(1);
}
const rows = text.filter(Boolean).map(line => {
  const name = line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)[0].replace(/^(['"]|['"])$/g, '');
  const teamId = idify(name);
  return {
    teamId,
    season: YEAR,
    coach: '',
    spPlus: '',
    elo: '',
    returningProduction: '',
    wins: 0,
    losses: 0,
    ties: 0,
    confWins: 0,
    confLosses: 0,
  };
});
const outHeader =
  'teamId,season,coach,spPlus,elo,returningProduction,wins,losses,ties,confWins,confLosses\n';
const outRows = rows.map(r => `${r.teamId},${r.season},,,, ,0,0,0,0,0`).join('\n');
fs.writeFileSync('csv/team_seasons.csv', outHeader + outRows + '\n');
console.log(`Wrote ${rows.length} rows -> csv/team_seasons.csv (${YEAR})`);
