import fs from 'node:fs';
import path from 'node:path';

function readJson(p: string) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function csvRead(p: string) {
  const txt = fs.readFileSync(p, 'utf8');
  const lines = txt.split(/\r?\n/).filter(Boolean);
  const header = lines[0].split(',');
  const rows = lines.slice(1).map(l => l.split(','));
  return { header, rows };
}

const DATA = path.join(process.cwd(), 'src', 'data');
const CSV = path.join(process.cwd(), 'csv');

const teams = readJson(path.join(DATA, 'teams.json')) as Array<any>;
const teamIds = new Set(teams.map(t => t.id));

const teamSeasons = readJson(path.join(DATA, 'teamSeasons.json')) as Array<any>;
const polls = readJson(path.join(DATA, 'polls.json')) as Array<any>;

const legacy = {
  teamSeasons_teamId_notCanonical: [] as string[],
  teamSeasons_id_prefix_notCanonical: [] as string[],
  polls_teamSeasonId_prefix_notCanonical: [] as string[],
  csv_team_ids_notCanonical: [] as string[],
};

for (const ts of teamSeasons) {
  if (!teamIds.has(ts.teamId)) {
    legacy.teamSeasons_teamId_notCanonical.push(ts.teamId + ' (entry id=' + ts.id + ')');
  }
  const idPrefix = String(ts.id).replace(/-\d+$/, '');
  if (!teamIds.has(idPrefix)) {
    legacy.teamSeasons_id_prefix_notCanonical.push(String(ts.id));
  }
}

for (const p of polls) {
  const tsid = String(p.teamSeasonId || '');
  const prefix = tsid.replace(/-\d+$/, '');
  if (!teamIds.has(prefix)) legacy.polls_teamSeasonId_prefix_notCanonical.push(tsid);
}

// scan csv/team_seasons.csv, csv/polls.csv, csv/teams.csv if present
const csvFiles = ['team_seasons.csv', 'polls.csv', 'teams.csv'];
for (const f of csvFiles) {
  const p = path.join(CSV, f);
  if (!fs.existsSync(p)) continue;
  try {
    const { header, rows } = csvRead(p);
    const idx = header.findIndex(h => /teamId|team_id|teamId/i.test(h));
    if (idx === -1) continue;
    for (const r of rows) {
      const val = r[idx] || '';
      if (!val) continue;
      if (!teamIds.has(val)) {
        legacy.csv_team_ids_notCanonical.push(f + ':' + val);
      }
    }
  } catch (err) {
    // ignore parse errors
  }
}

console.log('Canonical team ids count:', teamIds.size);
console.log('--- Legacy/mismatch report ---');
for (const k of Object.keys(legacy)) {
  const arr = (legacy as any)[k] as string[];
  console.log(`${k}: ${arr.length}`);
  if (arr.length) console.log(arr.slice(0, 200).join('\n'));
}

// exit non-zero if any mismatches
const total = Object.values(legacy).reduce((s: number, a: any[]) => s + a.length, 0);
if (total > 0) process.exitCode = 2;
else process.exitCode = 0;
