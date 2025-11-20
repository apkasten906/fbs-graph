import { ApolloServer } from '@apollo/server';
import fs from 'node:fs';
import path from 'node:path';
import gql from 'graphql-tag';

import type {
  Conference as ConfT,
  Team as TeamT,
  TeamSeason as TeamSeasonT,
  Game as GameT,
  PollSnapshot,
  PollType,
  PlayoffContender as PlayoffContenderT,
  PlayoffPreview as PlayoffPreviewT,
  RecordRow,
} from '../types/index.js';
import {
  computeLeverageForGame,
  buildLatestAPRankMap,
  buildLatestRankMap,
  buildNormalizedSpPlus,
  buildNormalizedElo,
} from './lib/score.js';

const DATA_DIR = path.join(process.cwd(), 'src', 'data');

const conferences: ConfT[] = JSON.parse(
  fs.readFileSync(path.join(DATA_DIR, 'conferences.json'), 'utf-8')
);
const teams: TeamT[] = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'teams.json'), 'utf-8'));
const teamSeasons: TeamSeasonT[] = JSON.parse(
  fs.readFileSync(path.join(DATA_DIR, 'teamSeasons.json'), 'utf-8')
);
const gamesRaw: GameT[] = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'games.json'), 'utf-8'));
const polls: PollSnapshot[] = JSON.parse(
  fs.readFileSync(path.join(DATA_DIR, 'polls.json'), 'utf-8')
);

const typeDefs = gql(fs.readFileSync(path.join(process.cwd(), 'src', 'schema.graphql'), 'utf-8'));

function teamById(id: string) {
  return teams.find(t => t.id === id)!;
}

function conferenceById(id: string) {
  return conferences.find(c => c.id === id)!;
}

function teamSeasonByTeamId(teamId: string, season: number) {
  return teamSeasons.find(ts => ts.teamId === teamId && ts.season === season);
}

function normalizedSpPlus(spPlus?: number) {
  if (spPlus === undefined) return undefined;
  const clamped = Math.max(-10, Math.min(35, spPlus));
  return (clamped + 10) / 45;
}

function winPercentage(record?: RecordRow) {
  if (!record) return undefined;
  const total = record.wins + record.losses + record.ties;
  if (!total) return undefined;
  return (record.wins + record.ties * 0.5) / total;
}

function computeResumeScore(rank: number | undefined, ts?: TeamSeasonT): number {
  let base: number | undefined;
  if (rank !== undefined) {
    base = (26 - rank) / 25;
  }
  if (base === undefined && ts) {
    base = normalizedSpPlus(ts.spPlus ?? undefined);
  }
  if (base === undefined) {
    base = 0.45;
  }
  const winPct = winPercentage(ts?.record);
  if (winPct !== undefined) {
    base = base * 0.6 + winPct * 0.4;
  }
  return Number(Math.max(0, Math.min(1, base)).toFixed(3));
}

function computeLeverageIndex(resume: number, upcoming: GameT[]): number {
  if (!upcoming.length) {
    return Number((resume * 0.6).toFixed(3));
  }
  const totalLev = upcoming.reduce((acc, g) => acc + (g.leverage ?? 0), 0);
  const avgLev = totalLev / upcoming.length;
  return Number((avgLev * 0.6 + resume * 0.4).toFixed(3));
}

function sortByDateAscending(games: GameT[]): GameT[] {
  return [...games].sort((a, b) => {
    const da = a.date ? new Date(a.date).getTime() : Number.POSITIVE_INFINITY;
    const db = b.date ? new Date(b.date).getTime() : Number.POSITIVE_INFINITY;
    return da - db;
  });
}

function isConferenceGame(game: GameT): boolean {
  const hc = teamById(game.homeTeamId).conferenceId;
  const ac = teamById(game.awayTeamId).conferenceId;
  return hc === ac && game.type === 'CONFERENCE';
}

function enrichGamesForSeason(season: number, ranking: PollType = 'AVERAGE'): GameT[] {
  const apMap = buildLatestAPRankMap(polls, season, teamSeasons);
  const spNorm = buildNormalizedSpPlus(teamSeasons as any, season);
  const eloNorm = buildNormalizedElo(teamSeasons as any, season);
  return gamesRaw
    .filter(g => g.season === season)
    .map(g =>
      computeLeverageForGame(
        g,
        teamSeasons as any,
        apMap as any,
        spNorm as any,
        eloNorm as any,
        ranking
      )
    );
}

const resolvers = {
  Query: {
    conferences: () => conferences,
    conference: (_: unknown, { id }: { id: string }) => conferences.find(c => c.id === id),
    teams: (_: unknown, args: { conferenceId?: string; season?: number }) => {
      let list = teams;
      if (args.conferenceId) list = list.filter(t => t.conferenceId === args.conferenceId);
      if (args.season) {
        const ids = new Set(
          teamSeasons.filter(ts => ts.season === args.season).map(ts => ts.teamId)
        );
        list = list.filter(t => ids.has(t.id));
      }
      return list;
    },
    team: (_: unknown, { id }: { id: string }) => teams.find(t => t.id === id),
    games: (
      _: unknown,
      args: {
        season: number;
        week?: number;
        teamId?: string;
        conferenceId?: string;
        type?: string;
        playedOnly?: boolean;
      }
    ) => {
      let list = enrichGamesForSeason(args.season);
      if (args.week !== undefined) list = list.filter(g => g.week === args.week);
      if (args.teamId)
        list = list.filter(g => g.homeTeamId === args.teamId || g.awayTeamId === args.teamId);
      if (args.conferenceId)
        list = list.filter(g => {
          const hc = teamById(g.homeTeamId).conferenceId;
          const ac = teamById(g.awayTeamId).conferenceId;
          return hc === args.conferenceId || ac === args.conferenceId;
        });
      if (args.type) list = list.filter(g => g.type === args.type);
      if (args.playedOnly) list = list.filter(g => g.result !== 'TBD');
      return list;
    },
    essentialMatchups: (
      _: unknown,
      args: { season: number; week?: number; limit?: number; includeConferenceGames?: boolean }
    ) => {
      let list = enrichGamesForSeason(args.season);
      if (args.week !== undefined) list = list.filter(g => g.week === args.week);
      if (!args.includeConferenceGames) list = list.filter(g => !isConferenceGame(g));
      list.sort((a, b) => (b.leverage ?? 0) - (a.leverage ?? 0));
      return list.slice(0, args.limit ?? 50);
    },
    conferenceConnectivity: (_: unknown, { season }: { season: number }) => {
      const list = enrichGamesForSeason(season);
      const key = (a: string, b: string) => (a < b ? `${a}__${b}` : `${b}__${a}`);
      const acc = new Map<string, { edges: number; totalLev: number; a: string; b: string }>();
      for (const g of list) {
        const hc = teamById(g.homeTeamId).conferenceId;
        const ac = teamById(g.awayTeamId).conferenceId;
        if (hc === ac) continue;
        const k = key(hc, ac);
        const entry = acc.get(k) ?? { edges: 0, totalLev: 0, a: hc, b: ac };
        entry.edges += 1;
        entry.totalLev += g.leverage ?? 0;
        acc.set(k, entry);
      }
      return Array.from(acc.values()).map(e => ({
        season,
        a: conferenceById(e.a),
        b: conferenceById(e.b),
        edges: e.edges,
        averageLeverage: Number((e.totalLev / e.edges).toFixed(4)),
      }));
    },
    playoffPreview: (
      _: unknown,
      {
        season,
        limit = 12,
        gameLimit = 12,
        leverageThreshold = 0.75,
      }: { season: number; limit?: number; gameLimit?: number; leverageThreshold?: number }
    ) => {
      const games = enrichGamesForSeason(season);
      const upcomingGames = games.filter(g => g.result === 'TBD');

      const highLeverage = upcomingGames
        .filter(g => (g.leverage ?? 0) >= leverageThreshold)
        .sort((a, b) => (b.leverage ?? 0) - (a.leverage ?? 0));

      const selectedGames: GameT[] = [];
      const seen = new Set<string>();
      for (const g of highLeverage) {
        if (selectedGames.length >= gameLimit) break;
        selectedGames.push(g);
        seen.add(g.id);
      }

      if (selectedGames.length < Math.min(gameLimit, 5)) {
        const fallbackOrdered = [...upcomingGames].sort(
          (a, b) => (b.leverage ?? 0) - (a.leverage ?? 0)
        );
        for (const g of fallbackOrdered) {
          if (selectedGames.length >= gameLimit) break;
          if (seen.has(g.id)) continue;
          selectedGames.push(g);
          seen.add(g.id);
        }
      }

      // Prefer CFP -> COACHES -> AP rankings for playoff-related calculations.
      // Fall back in that order if a given poll type has no snapshots.
      let rankMap = buildLatestRankMap(polls, season, 'CFP');
      if (!rankMap || rankMap.size === 0) {
        rankMap = buildLatestRankMap(polls, season, 'COACHES');
      }
      if (!rankMap || rankMap.size === 0) {
        rankMap = buildLatestRankMap(polls, season, 'AP');
      }
      const apMap = rankMap;
      if (!apMap || typeof (apMap as any).get !== 'function') {
        console.error('DEBUG: apMap is invalid in playoffPreview', apMap);
      }
      const contenders: PlayoffContenderT[] = [];
      const skipped: PlayoffContenderT[] = [];
      const relevantSeasons = teamSeasons.filter(ts => ts.season === season);
      for (const ts of relevantSeasons) {
        const rank = apMap.get(ts.id);
        const upcomingForTeam = sortByDateAscending(
          upcomingGames.filter(g => g.homeTeamId === ts.teamId || g.awayTeamId === ts.teamId)
        );
        const resumeScore = computeResumeScore(rank, ts);
        const leverageIndex = computeLeverageIndex(resumeScore, upcomingForTeam);
        const candidate: PlayoffContenderT = {
          season,
          teamId: ts.teamId,
          rank,
          resumeScore,
          leverageIndex,
          upcomingGames: upcomingForTeam,
          nextGame: upcomingForTeam[0],
        };
        // Keep obvious contenders; defer marginal teams to the skipped list so we
        // can fill the result up to the requested limit if needed.
        if (rank === undefined && !upcomingForTeam.length && resumeScore < 0.55) {
          skipped.push(candidate);
        } else {
          contenders.push(candidate);
        }
      }

      // If we don't have enough contenders to meet the requested `limit`, pull
      // from the skipped candidates (sorted by leverageIndex) until we reach
      // the desired count. This ensures the generated page can list the top N
      // teams (e.g., top 12) even if some teams are marginal by the primary
      // selection criteria.
      if (contenders.length < limit) {
        skipped.sort((a, b) => b.leverageIndex - a.leverageIndex);
        for (const s of skipped) {
          if (contenders.length >= limit) break;
          contenders.push(s);
        }
      }

      contenders.sort((a, b) => {
        if (a.rank !== undefined && b.rank !== undefined) return a.rank - b.rank;
        if (a.rank !== undefined) return -1;
        if (b.rank !== undefined) return 1;
        return b.leverageIndex - a.leverageIndex;
      });

      const preview: PlayoffPreviewT = {
        season,
        generatedAt: new Date().toISOString(),
        leverageThreshold,
        remainingHighLeverageGames: selectedGames.slice(0, gameLimit),
        contenders: contenders.slice(0, limit),
      };

      return preview;
    },
  },
  PlayoffContender: {
    team: (pc: PlayoffContenderT) => teamById(pc.teamId),
    record: (pc: PlayoffContenderT) => teamSeasonByTeamId(pc.teamId, pc.season)?.record ?? null,
    upcomingGames: (pc: PlayoffContenderT) => pc.upcomingGames ?? [],
    nextGame: (pc: PlayoffContenderT) => pc.nextGame ?? null,
  },
  Conference: {
    teams: (c: ConfT) => teams.filter(t => t.conferenceId === c.id),
    crossConferenceEdges: (c: ConfT, { season }: { season: number }) => {
      const list = enrichGamesForSeason(season);
      return list.filter(g => {
        const hc = teamById(g.homeTeamId).conferenceId;
        const ac = teamById(g.awayTeamId).conferenceId;
        return (hc === c.id || ac === c.id) && hc !== ac;
      }).length;
    },
    averageSpPlus: (c: ConfT, { season }: { season?: number }) => {
      const ts = season
        ? teamSeasons.filter(
            t => t.season === season && teams.find(tm => tm.id === t.teamId)?.conferenceId === c.id
          )
        : teamSeasons.filter(t => teams.find(tm => tm.id === t.teamId)?.conferenceId === c.id);
      const vals = ts.map(t => t.spPlus).filter((v): v is number => typeof v === 'number');
      if (!vals.length) return null;
      return Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(3));
    },
  },
  Team: {
    conference: (t: TeamT) => conferenceById(t.conferenceId),
    seasons: (t: TeamT) => teamSeasons.filter(ts => ts.teamId === t.id),
    neighbors: (t: TeamT, { season }: { season: number }) => {
      const list = enrichGamesForSeason(season).filter(
        g => g.homeTeamId === t.id || g.awayTeamId === t.id
      );
      const others = new Set<string>();
      for (const g of list) {
        others.add(g.homeTeamId === t.id ? g.awayTeamId : g.homeTeamId);
      }
      return Array.from(others).map(id => teamById(id));
    },
    degree: (t: TeamT, { season }: { season: number }) => {
      const list = enrichGamesForSeason(season);
      return list.filter(g => g.homeTeamId === t.id || g.awayTeamId === t.id).length;
    },
  },
  TeamSeason: {
    team: (ts: TeamSeasonT) => teamById(ts.teamId),
    polls: (ts: TeamSeasonT) => polls.filter(p => p.teamSeasonId === ts.id),
    games: (ts: TeamSeasonT) =>
      enrichGamesForSeason(ts.season).filter(
        g => g.homeTeamId === ts.teamId || g.awayTeamId === ts.teamId
      ),
  },
  Game: {
    home: (g: GameT) => teamById(g.homeTeamId),
    away: (g: GameT) => teamById(g.awayTeamId),
    homeConference: (g: GameT) => conferenceById(teamById(g.homeTeamId).conferenceId),
    awayConference: (g: GameT) => conferenceById(teamById(g.awayTeamId).conferenceId),
    isConferenceGame: (g: GameT) => isConferenceGame(g),
  },
};

export function createApolloServer() {
  return new ApolloServer({ typeDefs, resolvers });
}

export { typeDefs, resolvers };
