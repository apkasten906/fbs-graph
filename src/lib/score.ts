/* eslint-disable @typescript-eslint/no-unused-vars */
import { Game, PollSnapshot, TeamSeason, PollType } from './../../types/index';
type RankMap = Map<string, number>; // teamSeasonId -> rank (1 best)

export function buildAPRankMap(polls: PollSnapshot[], season: number): RankMap {
  const latestByTeam = new Map<string, PollSnapshot>();
  for (const p of polls) {
    if (p.poll !== 'AP') continue;
    const cur = latestByTeam.get(p.teamSeasonId);
    if (!cur || new Date(p.date) > new Date(cur.date) || p.week > cur.week)
      latestByTeam.set(p.teamSeasonId, p);
  }
  const out: RankMap = new Map();
  for (const [id, snap] of latestByTeam) out.set(id, snap.rank);
  return out;
}

function normalizeMap(values: Map<string, number>): Map<string, number> {
  if (values.size === 0) return new Map();
  let min = Infinity,
    max = -Infinity;
  for (const v of values.values()) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const span = Math.max(1e-6, max - min);
  const out = new Map<string, number>();
  for (const [k, v] of values) out.set(k, (v - min) / span); // 0..1
  return out;
}
export function buildNormalizedSpPlus(
  teamSeasons: TeamSeason[],
  season: number
): Map<string, number> {
  const m = new Map<string, number>();
  for (const ts of teamSeasons)
    if (ts.season === season && typeof ts.spPlus === 'number') m.set(ts.id, ts.spPlus);
  return normalizeMap(m);
}
export function buildNormalizedElo(teamSeasons: TeamSeason[], season: number): Map<string, number> {
  const m = new Map<string, number>();
  for (const ts of teamSeasons)
    if (ts.season === season && typeof ts.elo === 'number') m.set(ts.id, ts.elo);
  return normalizeMap(m);
}

function weightFromRank(rank?: number) {
  if (!rank) return undefined;
  return 1.2 - rank / 25;
}
function weightFromNorm(norm?: number) {
  if (norm === undefined) return undefined;
  return 0.2 + norm * 1.0;
}

function timingBoost(phase: Game['phase'], week?: number, type?: Game['type']) {
  if (type === 'PLAYOFF' || type === 'CHAMPIONSHIP' || type === 'BOWL') return 1.25;
  if (phase === 'REGULAR') {
    if (!week) return 1.0;
    if (week >= 12) return 1.15;
    if (week >= 9) return 1.1;
  }
  return 1.0;
}
function bridgeBoost(type: Game['type']) {
  return type === 'NON_CONFERENCE' ? 1.2 : 1.0;
}

export function computeLeverageForGame(
  g: Game,
  teamSeasons: TeamSeason[],
  apRanks: RankMap,
  spNorm: Map<string, number>,
  eloNorm: Map<string, number>,
  ranking: PollType
): Game {
  const homeTS = teamSeasons.find(ts => ts.teamId === g.homeTeamId && ts.season === g.season);
  const awayTS = teamSeasons.find(ts => ts.teamId === g.awayTeamId && ts.season === g.season);

  const whAP = weightFromRank(homeTS ? apRanks.get(homeTS.id) : undefined);
  const waAP = weightFromRank(awayTS ? apRanks.get(awayTS.id) : undefined);
  const whSP = weightFromNorm(homeTS ? spNorm.get(homeTS.id) : undefined);
  const waSP = weightFromNorm(awayTS ? spNorm.get(awayTS.id) : undefined);
  const whELO = weightFromNorm(homeTS ? eloNorm.get(homeTS.id) : undefined);
  const waELO = weightFromNorm(awayTS ? eloNorm.get(awayTS.id) : undefined);

  function pick(wAP?: number, wSP?: number, wELO?: number): number {
    if (ranking === 'AP') return wAP ?? wSP ?? wELO ?? 0.3;
    if (ranking === 'SP_PLUS') return wSP ?? wAP ?? wELO ?? 0.3;
    if (ranking === 'ELO') return wELO ?? wAP ?? wSP ?? 0.3;
    const arr = [wAP, wSP, wELO].filter((x): x is number => typeof x === 'number');
    if (!arr.length) return 0.3;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  const rwh = pick(whAP, whSP, whELO);
  const rwa = pick(waAP, waSP, waELO);
  const bb = bridgeBoost(g.type);
  const tb = timingBoost(g.phase, g.week, g.type);
  const leverage = Number((rwh * rwa * bb * tb).toFixed(4));
  return {
    ...g,
    leverage,
    rankWeightHome: rwh,
    rankWeightAway: rwa,
    bridgeBoost: bb,
    timingBoost: tb,
  };
}
