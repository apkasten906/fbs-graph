import { Game, PollSnapshot, TeamSeason } from '../types/index.js';

type RankMap = Map<string, number>; // teamSeasonId -> rank (lower is better)

export function buildLatestAPRankMap(polls: PollSnapshot[], season: number): RankMap {
  const map: RankMap = new Map();
  // keep latest by date per teamSeason
  const latestByTeam = new Map<string, PollSnapshot>();
  for (const p of polls) {
    if (p.poll !== 'AP') continue;
    const current = latestByTeam.get(p.teamSeasonId);
    if (!current || new Date(p.date) > new Date(current.date)) {
      latestByTeam.set(p.teamSeasonId, p);
    }
  }
  for (const [teamSeasonId, snap] of latestByTeam.entries()) {
    map.set(teamSeasonId, snap.rank);
  }
  return map;
}

function rankWeightFromRank(rank?: number): number | undefined {
  if (!rank) return undefined;
  // Map rank 1..25 -> ~ (1.0 .. 0.04). You can tune this curve.
  return 1.2 - (rank / 25); // rank 1 => 1.16, rank 25 => 0.2 (floor later)
}

function percentileFromSP(spPlus?: number): number | undefined {
  if (spPlus === undefined) return undefined;
  // Simple squashing heuristic: map typical SP+ range (-10..+35) to 0..1
  const clamped = Math.max(-10, Math.min(35, spPlus));
  return (clamped + 10) / 45;
}

function timingBoost(phase: Game['phase'], week?: number, type?: Game['type']): number {
  if (type === 'PLAYOFF' || type === 'CHAMPIONSHIP' || type === 'BOWL') return 1.25;
  if (phase === 'REGULAR') {
    if (!week) return 1.0;
    if (week >= 12) return 1.15;
    if (week >= 9) return 1.1;
  }
  return 1.0;
}

function bridgeBoost(type: Game['type']): number {
  if (type === 'NON_CONFERENCE') return 1.2;
  return 1.0;
}

export function computeLeverageForGame(g: Game, teamSeasons: TeamSeason[], apRanks: RankMap): Game {
  const homeTS = teamSeasons.find(ts => ts.teamId === g.homeTeamId && ts.season === g.season);
  const awayTS = teamSeasons.find(ts => ts.teamId === g.awayTeamId && ts.season === g.season);

  const rankHome = homeTS ? apRanks.get(homeTS.id) : undefined;
  const rankAway = awayTS ? apRanks.get(awayTS.id) : undefined;

  const rwh = rankHome ? Math.max(0.2, rankWeightFromRank(rankHome) ?? 0) :
              percentileFromSP(homeTS?.spPlus) ?? 0.3;
  const rwa = rankAway ? Math.max(0.2, rankWeightFromRank(rankAway) ?? 0) :
              percentileFromSP(awayTS?.spPlus) ?? 0.3;

  const bb = bridgeBoost(g.type);
  const tb = timingBoost(g.phase, g.week, g.type);

  const leverage = Number((rwh * rwa * bb * tb).toFixed(4));

  return { ...g, leverage, rankWeightHome: rwh, rankWeightAway: rwa, bridgeBoost: bb, timingBoost: tb };
}
