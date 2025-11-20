import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'csv-parse/sync';

// This script normalizes and dedupes csv/polls.csv into a canonical working
// copy (overwrites csv/polls.csv atomically) and writes src/data/polls.json
// for static consumption. It keeps the latest snapshot per (poll, teamSeasonId)
// using ISO date as the primary tie-breaker and week as secondary.

const ROOT = process.cwd();
const CSV_PATH = path.join(ROOT, 'csv', 'polls.csv');
const OUT_JSON = path.join(ROOT, 'src', 'data', 'polls.json');

function idify(s: string) {
  return s
    .toLowerCase()
    .replace(/[.&]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-]/g, '');
}

function normalizePollName(raw: string) {
  const s = (raw || '').toString().toLowerCase();
  if (s.includes('ap')) return 'AP';
  if (s.includes('cfp')) return 'CFP';
  if (s.includes('coach') || s.includes('coaches') || s.includes('usa')) return 'COACHES';
  // if unknown, keep raw uppercased (but callers should avoid this)
  return raw ? String(raw).toUpperCase() : null;
}

if (!fs.existsSync(CSV_PATH)) {
  console.error('No csv/polls.csv found — nothing to merge.');
  process.exit(1);
}

const raw = fs.readFileSync(CSV_PATH, 'utf-8');
const records = parse(raw, { columns: true, skip_empty_lines: true }) as any[];

// Map key: `${poll}::${teamSeasonId}` -> record
const map = new Map<string, any>();
for (const r of records) {
  // Expect columns: team, season, poll, week, rank, date
  const teamRaw = r.team ?? r.Team ?? r.teamSeasonId ?? 'unknown';
  const season = Number(r.season ?? r.Season ?? 0) || 0;
  const pollRaw = r.poll ?? r.Poll ?? '';
  const poll = normalizePollName(pollRaw) ?? String(pollRaw).toUpperCase();
  const week = r.week ? Number(r.week) : r.Week ? Number(r.Week) : undefined;
  const rank = r.rank ? Number(r.rank) : r.Rank ? Number(r.Rank) : undefined;
  const date = r.date ? new Date(r.date).toISOString() : new Date().toISOString();
  const teamSeasonId = `${idify(String(teamRaw))}-${season}`;

  const key = `${poll}::${teamSeasonId}`;
  const item = { teamSeasonId, poll, week, rank, date, season };

  const existing = map.get(key);
  if (!existing) {
    map.set(key, item);
    continue;
  }
  const dNew = new Date(item.date).getTime();
  const dExisting = new Date(existing.date).getTime();
  if (dNew > dExisting) {
    map.set(key, item);
  } else if (dNew === dExisting) {
    if ((item.week || 0) > (existing.week || 0)) map.set(key, item);
  }
}

// Create canonical rows sorted by poll then teamSeasonId for stable output
const out = Array.from(map.values()).sort((a, b) => {
  if (a.poll < b.poll) return -1;
  if (a.poll > b.poll) return 1;
  if (a.teamSeasonId < b.teamSeasonId) return -1;
  if (a.teamSeasonId > b.teamSeasonId) return 1;
  return 0;
});

const header = 'teamSeasonId,poll,week,rank,date,season';
const lines = [header];
for (const r of out) {
  lines.push(`${r.teamSeasonId},${r.poll},${r.week ?? ''},${r.rank ?? ''},${r.date},${r.season}`);
}

// Atomic write to CSV
const tmp = CSV_PATH + '.tmp';
fs.writeFileSync(tmp, lines.join('\n') + '\n', 'utf-8');
fs.renameSync(tmp, CSV_PATH);

// Also write JSON for static consumption
const jsonOut = out.map(r => ({ teamSeasonId: r.teamSeasonId, poll: r.poll, week: r.week, rank: r.rank, date: r.date }));
fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
fs.writeFileSync(OUT_JSON, JSON.stringify(jsonOut, null, 2), 'utf-8');

console.log(`Merged ${records.length} input rows -> ${out.length} canonical rows (wrote ${CSV_PATH} and ${OUT_JSON})`);
