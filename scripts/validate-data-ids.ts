import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'src', 'data');

function readJSON(name: string) {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), 'utf8'));
}

const teams = readJSON('teams.json');
const teamSeasons = readJSON('teamSeasons.json');
const polls = readJSON('polls.json');

const teamIds = new Set(teams.map((t: any) => t.id));
const teamSeasonIds = new Set(teamSeasons.map((ts: any) => ts.id));

let ok = true;
const errors: string[] = [];

// Check: each teamSeason.teamId exists in teams
for (const ts of teamSeasons) {
  if (!teamIds.has(ts.teamId)) {
    ok = false;
    errors.push(`Missing team id in teams.json for teamSeasons entry: teamSeason.id=${ts.id} teamId=${ts.teamId}`);
  }
  // Check id matches convention `<teamId>-<season>`
  const expectedPrefix = `${ts.teamId}-`;
  if (!String(ts.id).startsWith(expectedPrefix)) {
    ok = false;
    errors.push(`teamSeasons.id mismatch: expected prefix '${expectedPrefix}' for id='${ts.id}'`);
  }
}

// Check: polls reference existing teamSeason ids
for (const p of polls) {
  if (!teamSeasonIds.has(p.teamSeasonId)) {
    ok = false;
    errors.push(`Poll references unknown teamSeasonId: ${p.teamSeasonId} (poll=${p.poll} date=${p.date})`);
  }
}

// Report summary
if (ok) {
  console.log('validate-data-ids: OK — team ids and teamSeason references are consistent.');
  process.exit(0);
} else {
  console.error('validate-data-ids: FAIL — data inconsistencies found:');
  for (const e of errors) console.error('  -', e);
  process.exit(2);
}
