import fs from 'node:fs';
import path from 'node:path';
import { buildLatestAPRankMap, computeLeverageForGame } from '../lib/score.js';
import type { Game, TeamSeason, PollSnapshot } from '../types/index.js';

const DATA_DIR = path.join(process.cwd(), 'src', 'data');

const games: Game[] = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'games.json'), 'utf-8'));
const teamSeasons: TeamSeason[] = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'teamSeasons.json'), 'utf-8'));
const polls: PollSnapshot[] = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'polls.json'), 'utf-8'));

const seasons = Array.from(new Set(games.map(g => g.season)));
for (const season of seasons) {
  const ap = buildLatestAPRankMap(polls, season);
  const out = games.filter(g => g.season === season).map(g => computeLeverageForGame(g, teamSeasons, ap));
  fs.writeFileSync(path.join(DATA_DIR, `games.scored.${season}.json`), JSON.stringify(out, null, 2));
  console.log(`Wrote ${out.length} games to games.scored.${season}.json`);
}

// Optional: CSV importer stub (place your full schedule CSV here)
/*
import csv from 'csv-parse/sync';
const csvText = fs.readFileSync('schedules.csv', 'utf-8');
const rows = csv.parse(csvText, { columns: true });
// Map rows to Game objects and write to src/data/games.json
*/
