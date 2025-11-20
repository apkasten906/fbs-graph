import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'csv-parse/sync';
import type { Game, Team, TeamSeason, PollSnapshot } from '../src/types/index.js';

const DATA_DIR = path.join(process.cwd(), 'src', 'data');
const CSV_DIR = path.join(process.cwd(), 'csv');
const idify = (s: string) => s.toLowerCase().replace(/[.&]/g, '').replace(/\s+/g, '-');

const read = (p: string) => fs.readFileSync(p, 'utf-8');
const teamRows = parse(read(path.join(CSV_DIR, 'teams.csv')), {
  columns: true,
  skip_empty_lines: true,
});
const seasonRows = parse(read(path.join(CSV_DIR, 'team_seasons.csv')), {
  columns: true,
  skip_empty_lines: true,
});
const gameRows = parse(read(path.join(CSV_DIR, 'schedules_2025.csv')), {
  columns: true,
  skip_empty_lines: true,
});
const pollRows = parse(read(path.join(CSV_DIR, 'polls.csv')), {
  columns: true,
  skip_empty_lines: true,
});

const teams: Team[] = teamRows.map((r: any) => ({
  id: idify(r.name),
  name: r.name,
  shortName:
    r.shortName ||
    r.name
      .split(' ')
      .map((w: string) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 4),
  conferenceId: r.conferenceId,
}));

const teamSeasons: TeamSeason[] = seasonRows.map((r: any) => ({
  id: `${idify(r.teamId)}-${r.season}`,
  teamId: idify(r.teamId),
  season: Number(r.season),
  coach: r.coach || null,
  spPlus: r.spPlus ? Number(r.spPlus) : null,
  returningProduction: r.returningProduction ? Number(r.returningProduction) : null,
  record: {
    wins: Number(r.wins || 0),
    losses: Number(r.losses || 0),
    ties: Number(r.ties || 0),
    confWins: Number(r.confWins || 0),
    confLosses: Number(r.confLosses || 0),
  },
}));

const games: Game[] = gameRows.map((r: any) => ({
  id: r.id || `${r.season}-w${r.week}-${idify(r.home)}-${idify(r.away)}`,
  season: Number(r.season),
  week: r.week ? Number(r.week) : undefined,
  phase: (r.phase || 'REGULAR') as Game['phase'],
  date: r.date || undefined,
  type: (r.type || (r.conferenceGame === 'true' ? 'CONFERENCE' : 'NON_CONFERENCE')) as Game['type'],
  homeTeamId: idify(r.home),
  awayTeamId: idify(r.away),
  result: (r.result || 'TBD') as Game['result'],
  homePoints: r.homePoints ? Number(r.homePoints) : null,
  awayPoints: r.awayPoints ? Number(r.awayPoints) : null,
}));

// Normalize polls and deduplicate: keep the latest snapshot for each (poll, teamSeasonId)
const rawPolls: PollSnapshot[] = pollRows.map((r: any) => ({
  teamSeasonId: `${idify(r.team)}-${r.season}`,
  poll: r.poll,
  week: Number(r.week),
  rank: Number(r.rank),
  date: r.date,
}));

const pollsMap = new Map<string, PollSnapshot>();
for (const p of rawPolls) {
  const key = `${p.poll}::${p.teamSeasonId}`;
  const existing = pollsMap.get(key);
  if (!existing) {
    pollsMap.set(key, p);
    continue;
  }
  // choose latest by ISO date; if equal, prefer higher week
  const dNew = p.date ? new Date(p.date).getTime() : 0;
  const dExisting = existing.date ? new Date(existing.date).getTime() : 0;
  if (dNew > dExisting) {
    pollsMap.set(key, p);
  } else if (dNew === dExisting && (p.week || 0) > (existing.week || 0)) {
    pollsMap.set(key, p);
  }
}
const polls: PollSnapshot[] = Array.from(pollsMap.values());

fs.writeFileSync(path.join(DATA_DIR, 'teams.json'), JSON.stringify(teams, null, 2));
fs.writeFileSync(path.join(DATA_DIR, 'teamSeasons.json'), JSON.stringify(teamSeasons, null, 2));
fs.writeFileSync(path.join(DATA_DIR, 'games.json'), JSON.stringify(games, null, 2));
fs.writeFileSync(path.join(DATA_DIR, 'polls.json'), JSON.stringify(polls, null, 2));

console.log(
  `Imported: ${teams.length} teams, ${teamSeasons.length} team seasons, ${games.length} games, ${polls.length} polls (deduped)`
);
