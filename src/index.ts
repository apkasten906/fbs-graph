import 'dotenv/config';
import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import fs from 'node:fs';
import path from 'node:path';
import gql from 'graphql-tag';
import type {
  Conference as ConfT,
  Team as TeamT,
  TeamSeason as TeamSeasonT,
  Game as GameT,
  PollType,
  PollSnapshot,
} from '../types/index.js';
import {
  computeLeverageForGame,
  buildAPRankMap,
  buildNormalizedSpPlus,
  buildNormalizedElo,
} from './lib/score.js';
import { loadFromJSON, loadFromCSV } from './lib/dataLoader.js';
import { DateTime } from './lib/dateTimeScalar.js';

const USE_CSV = process.env.USE_CSV === '1';
const {
  conferences,
  teams,
  teamSeasons,
  games: gamesRaw,
  polls,
} = USE_CSV ? loadFromCSV() : loadFromJSON();
const typeDefs = gql(fs.readFileSync(path.join(process.cwd(), 'src', 'schema.graphql'), 'utf-8'));

function teamById(id: string) {
  return teams.find(t => t.id === id)!;
}
function conferenceById(id: string) {
  return conferences.find(c => c.id === id)!;
}
function isConferenceGame(game: GameT): boolean {
  const hc = teamById(game.homeTeamId)?.conferenceId;
  const ac = teamById(game.awayTeamId)?.conferenceId;
  return Boolean(hc) && Boolean(ac) && hc === ac && game.type === 'CONFERENCE';
}
function enrichGamesForSeason(season: number, ranking: PollType): GameT[] {
  const apMap = buildAPRankMap(polls as PollSnapshot[], season);
  const spNorm = buildNormalizedSpPlus(teamSeasons, season);
  const eloNorm = buildNormalizedElo(teamSeasons, season);
  return gamesRaw
    .filter(g => g.season === season)
    .filter(g => teams.some(t => t.id === g.homeTeamId) && teams.some(t => t.id === g.awayTeamId))
    .map(g => computeLeverageForGame(g, teamSeasons, apMap, spNorm, eloNorm, ranking));
}

const resolvers = {
  DateTime,
  Query: {
    conferences: () => conferences,
    conference: (_: any, { id }: { id: string }) => conferences.find(c => c.id === id),
    teams: (_: any, args: { conferenceId?: string; season?: number }) => {
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
    team: (_: any, { id }: { id: string }) => teams.find(t => t.id === id),
    games: (
      _: any,
      args: {
        season: number;
        week?: number;
        teamId?: string;
        conferenceId?: string;
        type?: string;
        playedOnly?: boolean;
        ranking?: 'AP' | 'ELO' | 'SP_PLUS' | 'AVERAGE';
      }
    ) => {
      const ranking = args.ranking ?? 'AVERAGE';
      let list = enrichGamesForSeason(args.season, ranking as PollType);
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
      _: any,
      args: {
        season: number;
        week?: number;
        limit?: number;
        includeConferenceGames?: boolean;
        ranking?: 'AP' | 'ELO' | 'SP_PLUS' | 'AVERAGE';
      }
    ) => {
      const ranking = args.ranking ?? 'AVERAGE';
      let list = enrichGamesForSeason(args.season, ranking);
      if (args.week !== undefined) list = list.filter(g => g.week === args.week);
      if (!args.includeConferenceGames) list = list.filter(g => !isConferenceGame(g));
      list.sort((a, b) => (b.leverage ?? 0) - (a.leverage ?? 0));
      return list.slice(0, args.limit ?? 50);
    },
    conferenceConnectivity: (_: any, { season }: { season: number }) => {
      const list = enrichGamesForSeason(season, 'AVERAGE');
      const key = (a: string, b: string) => (a < b ? `${a}__${b}` : `${b}__${a}`);
      const acc = new Map<string, { edges: number; totalLev: number; a: string; b: string }>();
      for (const g of list) {
        const hc = teamById(g.homeTeamId).conferenceId;
        const ac = teamById(g.awayTeamId).conferenceId;
        if (hc === ac) continue;
        const k = key(hc, ac);
        const e = acc.get(k) ?? { edges: 0, totalLev: 0, a: hc, b: ac };
        e.edges += 1;
        e.totalLev += g.leverage ?? 0;
        acc.set(k, e);
      }
      return Array.from(acc.values()).map(e => ({
        season,
        a: conferenceById(e.a),
        b: conferenceById(e.b),
        edges: e.edges,
        averageLeverage: Number((e.totalLev / e.edges).toFixed(4)),
      }));
    },
  },
  Conference: {
    teams: (c: ConfT) => teams.filter(t => t.conferenceId === c.id),
    crossConferenceEdges: (c: ConfT, { season }: { season: number }) => {
      const list = enrichGamesForSeason(season, 'AVERAGE');
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
      const list = enrichGamesForSeason(season, 'AVERAGE').filter(
        g => g.homeTeamId === t.id || g.awayTeamId === t.id
      );
      const others = new Set<string>();
      for (const g of list) others.add(g.homeTeamId === t.id ? g.awayTeamId : g.homeTeamId);
      return Array.from(others).map(id => teamById(id));
    },
    degree: (t: TeamT, { season }: { season: number }) => {
      const list = enrichGamesForSeason(season, 'AVERAGE');
      return list.filter(g => g.homeTeamId === t.id || g.awayTeamId === t.id).length;
    },
  },
  TeamSeason: {
    team: (ts: TeamSeasonT) => teamById(ts.teamId),
    polls: (ts: TeamSeasonT) => (polls as PollSnapshot[]).filter(p => p.teamSeasonId === ts.id),
    games: (ts: TeamSeasonT) =>
      enrichGamesForSeason(ts.season, 'AVERAGE').filter(
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

const server = new ApolloServer({
  typeDefs,
  resolvers,
  // Remove cors from here
});
const { url } = await startStandaloneServer(server, {
  listen: { port: process.env.APOLLO_PORT ? Number(process.env.APOLLO_PORT) : 4100 },
  // cors: {
  //   origin: '*',
  //   methods: ['GET', 'POST', 'OPTIONS'],
  //   allowedHeaders: ['content-type'],
  //   credentials: false,
  // },
});
console.log(`🚀 GraphQL ready at ${url} (USE_CSV=${USE_CSV ? '1' : '0'})`);
