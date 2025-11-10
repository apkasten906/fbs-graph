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

for (const season of seasons) {
  const enrichedGames = enrichGamesForSeason(season, 'AVERAGE');
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
const acc = new Map<string, { edges: number; totalLev: number; a: string; b: string }>();

for (const g of list) {
  const hc = teamById(g.homeTeamId)?.conferenceId;
  const ac = teamById(g.awayTeamId)?.conferenceId;
  if (!hc || !ac || hc === ac) continue;
  const k = key(hc, ac);
  const e = acc.get(k) ?? { edges: 0, totalLev: 0, a: hc, b: ac };
  e.edges += 1;
  e.totalLev += g.leverage ?? 0;
  acc.set(k, e);
}

const connectivityData = Array.from(acc.values()).map(e => ({
  season,
  conferenceA: conferenceById(e.a),
  conferenceB: conferenceById(e.b),
  edges: e.edges,
  averageLeverage: Number((e.totalLev / e.edges).toFixed(4)),
}));

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
