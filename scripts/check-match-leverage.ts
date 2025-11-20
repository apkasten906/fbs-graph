import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { computeLeverageForGame, buildLatestAPRankMap, buildNormalizedSpPlus, buildNormalizedElo } from '../src/lib/score';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'src', 'data');

function readJSON(name: string) {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), 'utf8'));
}

const teamSeasons = readJSON('teamSeasons.json');
const polls = readJSON('polls.json');

const apMap = buildLatestAPRankMap(polls, 2025, teamSeasons as any);
const spNorm = buildNormalizedSpPlus(teamSeasons as any, 2025);
const eloNorm = buildNormalizedElo(teamSeasons as any, 2025);

function makeGame(home: string, away: string, week = 10, type: any = 'CONFERENCE') {
  return {
    id: `${home}-${away}-2025`,
    season: 2025,
    week,
    phase: 'REGULAR',
    date: `2025-10-01T00:00:00.000Z`,
    type,
    homeTeamId: home,
    awayTeamId: away,
  } as any;
}

const home = 'texas';
const away = 'texas-am';

console.log('AP rank (teamSeason id) entries for Texas and Texas A&M:');
const tsTexas = teamSeasons.find((t: any) => t.teamId === home && t.season === 2025);
const tsTAM = teamSeasons.find((t: any) => t.teamId === away && t.season === 2025);
console.log('texas teamSeason id:', tsTexas?.id, 'spPlus:', tsTexas?.spPlus);
console.log('texas-am teamSeason id:', tsTAM?.id, 'spPlus:', tsTAM?.spPlus);
console.log('AP rank for texas:', apMap.get(tsTexas?.id));
console.log('AP rank for texas-am:', apMap.get(tsTAM?.id));

// Compute for conference and non-conference
const gConf = makeGame(home, away, 10, 'CONFERENCE');
const gNonConf = makeGame(home, away, 10, 'NON_CONFERENCE');

const levConf = computeLeverageForGame(gConf, teamSeasons as any, apMap as any, spNorm as any, eloNorm as any, 'AP');
const levNon = computeLeverageForGame(gNonConf, teamSeasons as any, apMap as any, spNorm as any, eloNorm as any, 'AP');

console.log('\nComputed leverage (CONFERENCE):', levConf.leverage, JSON.stringify({ rankWeightHome: levConf.rankWeightHome, rankWeightAway: levConf.rankWeightAway, bridgeBoost: levConf.bridgeBoost, timingBoost: levConf.timingBoost }, null, 2));
console.log('\nComputed leverage (NON_CONFERENCE):', levNon.leverage, JSON.stringify({ rankWeightHome: levNon.rankWeightHome, rankWeightAway: levNon.rankWeightAway, bridgeBoost: levNon.bridgeBoost, timingBoost: levNon.timingBoost }, null, 2));

process.exit(0);
