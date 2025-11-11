/**
 * Generate static JSON files for GitHub Pages deployment
 * This replaces the GraphQL API calls with pre-generated data files
 */

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import type { Conference, Team, Game, PollType } from '../types/index.js';
import {
  computeLeverageForGame,
  buildAPRankMap,
  buildNormalizedSpPlus,
  buildNormalizedElo,
} from '../src/lib/score.js';
import { loadFromJSON, loadFromCSV } from '../src/lib/dataLoader.js';

const USE_CSV = process.env.USE_CSV === '1';
const OUTPUT_DIR = path.join(process.cwd(), 'web', 'data');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const {
  conferences,
  teams,
  teamSeasons,
  games: gamesRaw,
  polls,
} = USE_CSV ? loadFromCSV() : loadFromJSON();

function teamById(id: string): Team | undefined {
  return teams.find(t => t.id === id);
}

function conferenceById(id: string): Conference | undefined {
  return conferences.find(c => c.id === id);
}

function getTeamConference(teamId: string): Conference | undefined {
  const team = teamById(teamId);
  return team && team.conferenceId ? conferenceById(team.conferenceId) : undefined;
}

function enrichGamesForSeason(season: number, ranking: PollType): Game[] {
  const apMap = buildAPRankMap(polls, season);
  const spNorm = buildNormalizedSpPlus(teamSeasons, season);
  const eloNorm = buildNormalizedElo(teamSeasons, season);
  return gamesRaw
    .filter(g => g.season === season)
    .filter(g => teams.some(t => t.id === g.homeTeamId) && teams.some(t => t.id === g.awayTeamId))
    .map(g => {
      // IMPORTANT: Skip leverage calculation for postseason games.
      //
      // Leverage measures how much a game affects playoff chances. Once teams are IN the playoffs
      // (postseason phase), the matchups are predetermined by the playoff bracket structure.
      // These games don't have "leverage" because they don't determine playoff positioning -
      // they ARE the playoff games themselves.
      //
      // Only regular season games have leverage scores that help identify which matchups
      // are most important for determining who makes the playoffs.
      if (g.phase === 'POSTSEASON') {
        return g;
      }
      return computeLeverageForGame(g, teamSeasons, apMap, spNorm, eloNorm, ranking);
    });
}

function isConferenceGame(game: Game): boolean {
  const hc = teamById(game.homeTeamId)?.conferenceId;
  const ac = teamById(game.awayTeamId)?.conferenceId;
  return Boolean(hc) && Boolean(ac) && hc === ac && game.type === 'CONFERENCE';
}

interface EnrichedGame extends Game {
  homeTeam?: Team;
  awayTeam?: Team;
  homeConference?: Conference;
  awayConference?: Conference;
}

// Generate static data files
console.log('Generating static data files for GitHub Pages...');

// 1. Generate conferences.json
const conferencesData = conferences.map(c => ({
  id: c.id,
  name: c.name,
  shortName: c.shortName,
  division: c.division,
}));
fs.writeFileSync(
  path.join(OUTPUT_DIR, 'conferences.json'),
  JSON.stringify(conferencesData, null, 2)
);
console.log(`✓ Generated conferences.json (${conferencesData.length} conferences)`);

// 2. Generate teams.json
const teamsData = teams.map(t => ({
  id: t.id,
  name: t.name,
  shortName: t.shortName,
  conferenceId: t.conferenceId,
  conference: conferenceById(t.conferenceId),
}));
fs.writeFileSync(path.join(OUTPUT_DIR, 'teams.json'), JSON.stringify(teamsData, null, 2));
console.log(`✓ Generated teams.json (${teamsData.length} teams)`);

// 3. Generate games by season with enriched data
const currentYear = new Date().getFullYear();
const seasons = [currentYear]; // Can add more seasons: [2024, 2025]

// Behavior configuration: when running in CI you may want the build to fail
// if expected data is missing. Set FAIL_ON_MISSING_DATA=1 in the environment
// to turn warnings into hard failures.
const FAIL_ON_MISSING_DATA = process.env.FAIL_ON_MISSING_DATA === '1';

for (const season of seasons) {
  const enrichedGames = enrichGamesForSeason(season, 'AVERAGE');

  if (!Array.isArray(enrichedGames) || enrichedGames.length === 0) {
    const message = `⚠️  No game data found for season ${season}.`;
    if (FAIL_ON_MISSING_DATA) {
      throw new Error(message + ' FAIL_ON_MISSING_DATA is set, aborting.');
    }
    console.warn(
      message +
        ' Skipping generation for this season. To make this an error, set FAIL_ON_MISSING_DATA=1'
    );
    continue;
  }

  const gamesWithDetails: EnrichedGame[] = enrichedGames.map(g => ({
    ...g,
    homeTeam: teamById(g.homeTeamId),
    awayTeam: teamById(g.awayTeamId),
    homeConference: getTeamConference(g.homeTeamId),
    awayConference: getTeamConference(g.awayTeamId),
  }));

  fs.writeFileSync(
    path.join(OUTPUT_DIR, `games-${season}.json`),
    JSON.stringify(gamesWithDetails, null, 2)
  );
  console.log(`✓ Generated games-${season}.json (${gamesWithDetails.length} games)`);

  // 4. Generate essential matchups for each season
  const essentialMatchups = enrichedGames
    .filter(g => !isConferenceGame(g))
    .sort((a, b) => (b.leverage ?? 0) - (a.leverage ?? 0))
    .slice(0, 50)
    .map(g => ({
      ...g,
      homeTeam: teamById(g.homeTeamId),
      awayTeam: teamById(g.awayTeamId),
      homeConference: getTeamConference(g.homeTeamId),
      awayConference: getTeamConference(g.awayTeamId),
    }));

  fs.writeFileSync(
    path.join(OUTPUT_DIR, `essential-matchups-${season}.json`),
    JSON.stringify(essentialMatchups, null, 2)
  );
  console.log(
    `✓ Generated essential-matchups-${season}.json (${essentialMatchups.length} matchups)`
  );
}

// 5. Generate conference connectivity data
const season = currentYear;
const list = enrichGamesForSeason(season, 'AVERAGE');
const key = (a: string, b: string) => (a < b ? `${a}__${b}` : `${b}__${a}`);
const acc = new Map<
  string,
  { edges: number; totalLev: number; levCount: number; a: string; b: string }
>();

for (const g of list) {
  const hc = teamById(g.homeTeamId)?.conferenceId;
  const ac = teamById(g.awayTeamId)?.conferenceId;
  if (!hc || !ac || hc === ac) continue;
  const k = key(hc, ac);
  const e = acc.get(k) ?? { edges: 0, totalLev: 0, levCount: 0, a: hc, b: ac };
  e.edges += 1;
  // Some games may not have leverage computed (e.g., postseason or missing data).
  // Only accumulate numeric leverage values and count them for accurate averaging.
  if (typeof g.leverage === 'number' && Number.isFinite(g.leverage)) {
    e.totalLev += g.leverage;
    e.levCount += 1;
  }
  acc.set(k, e);
}

// Only include connections that have at least one recorded edge.
const connectivityData = Array.from(acc.values())
  .filter(e => e.edges > 0)
  .map(e => ({
    season,
    conferenceA: conferenceById(e.a) ?? { id: e.a, name: e.a },
    conferenceB: conferenceById(e.b) ?? { id: e.b, name: e.b },
    edges: e.edges,
    // Use levCount to compute average only over games with numeric leverage.
    averageLeverage: e.levCount > 0 ? Number((e.totalLev / e.levCount).toFixed(4)) : 0,
  }));

// Warn about per-connection issues where edges exist but no leverage values were recorded.
for (const entry of Array.from(acc.values())) {
  if (entry.edges > 0 && entry.levCount === 0) {
    console.warn(
      `⚠️  Conference connection ${entry.a} <-> ${entry.b} has ${entry.edges} games but no numeric leverage values; averageLeverage will be 0. Verify input data or leverage computation.`
    );
  }
}

if (connectivityData.length === 0) {
  console.warn(`⚠️  No conference connectivity data generated for season ${season}.`);
} else {
  console.log(`✓ Computed ${connectivityData.length} conference connections for season ${season}`);
}

fs.writeFileSync(
  path.join(OUTPUT_DIR, `conference-connectivity-${season}.json`),
  JSON.stringify(connectivityData, null, 2)
);
console.log(
  `✓ Generated conference-connectivity-${season}.json (${connectivityData.length} connections)`
);

// 6. Generate metadata file
const metadata = {
  generatedAt: new Date().toISOString(),
  seasons: seasons,
  currentSeason: currentYear,
  totalTeams: teams.length,
  totalConferences: conferences.length,
  dataFiles: {
    conferences: 'conferences.json',
    teams: 'teams.json',
    games: seasons.map(s => `games-${s}.json`),
    essentialMatchups: seasons.map(s => `essential-matchups-${s}.json`),
    conferenceConnectivity: seasons.map(s => `conference-connectivity-${s}.json`),
  },
};

fs.writeFileSync(path.join(OUTPUT_DIR, 'metadata.json'), JSON.stringify(metadata, null, 2));
console.log(`✓ Generated metadata.json`);

console.log('\n✅ All static data files generated successfully!');
console.log(`📁 Output directory: ${OUTPUT_DIR}`);
