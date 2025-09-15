import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import fs from 'node:fs';
import path from 'node:path';
import gql from 'graphql-tag';

import type { Conference as ConfT, Team as TeamT, TeamSeason as TeamSeasonT, Game as GameT, PollSnapshot } from './types/index.js';
import { computeLeverageForGame, buildLatestAPRankMap } from './lib/score.js';

const DATA_DIR = path.join(process.cwd(), 'src', 'data');

const conferences: ConfT[] = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'conferences.json'), 'utf-8'));
const teams: TeamT[] = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'teams.json'), 'utf-8'));
const teamSeasons: TeamSeasonT[] = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'teamSeasons.json'), 'utf-8'));
const gamesRaw: GameT[] = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'games.json'), 'utf-8'));
const polls: PollSnapshot[] = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'polls.json'), 'utf-8'));

const typeDefs = gql(fs.readFileSync(path.join(process.cwd(), 'src', 'schema.graphql'), 'utf-8'));

function teamById(id: string) { return teams.find(t => t.id === id)!; }
function conferenceById(id: string) { return conferences.find(c => c.id === id)!; }

function isConferenceGame(game: GameT): boolean {
  const hc = teamById(game.homeTeamId).conferenceId;
  const ac = teamById(game.awayTeamId).conferenceId;
  return hc === ac && game.type === 'CONFERENCE';
}

function enrichGamesForSeason(season: number): GameT[] {
  const apMap = buildLatestAPRankMap(polls, season);
  return gamesRaw
    .filter(g => g.season === season)
    .map(g => computeLeverageForGame(g, teamSeasons, apMap));
}

const resolvers = {
  Query: {
    conferences: () => conferences,
    conference: (_: any, { id }: { id: string }) => conferences.find(c => c.id === id),
    teams: (_: any, args: { conferenceId?: string, season?: number }) => {
      let list = teams;
      if (args.conferenceId) list = list.filter(t => t.conferenceId === args.conferenceId);
      if (args.season) {
        const ids = new Set(teamSeasons.filter(ts => ts.season === args.season).map(ts => ts.teamId));
        list = list.filter(t => ids.has(t.id));
      }
      return list;
    },
    team: (_: any, { id }: { id: string }) => teams.find(t => t.id === id),
    games: (_: any, args: { season: number, week?: number, teamId?: string, conferenceId?: string, type?: string, playedOnly?: boolean }) => {
      let list = enrichGamesForSeason(args.season);
      if (args.week !== undefined) list = list.filter(g => g.week === args.week);
      if (args.teamId) list = list.filter(g => g.homeTeamId === args.teamId || g.awayTeamId === args.teamId);
      if (args.conferenceId) list = list.filter(g => {
        const hc = teamById(g.homeTeamId).conferenceId;
        const ac = teamById(g.awayTeamId).conferenceId;
        return hc === args.conferenceId || ac === args.conferenceId;
      });
      if (args.type) list = list.filter(g => g.type === args.type);
      if (args.playedOnly) list = list.filter(g => g.result !== 'TBD');
      return list;
    },
    essentialMatchups: (_: any, args: { season: number, week?: number, limit?: number, includeConferenceGames?: boolean }) => {
      let list = enrichGamesForSeason(args.season);
      if (args.week !== undefined) list = list.filter(g => g.week === args.week);
      if (!args.includeConferenceGames) list = list.filter(g => !isConferenceGame(g));
      list.sort((a, b) => (b.leverage ?? 0) - (a.leverage ?? 0));
      return list.slice(0, args.limit ?? 50);
    },
    conferenceConnectivity: (_: any, { season }: { season: number }) => {
      const list = enrichGamesForSeason(season);
      const key = (a: string, b: string) => a < b ? `${a}__${b}` : `${b}__${a}`;
      const acc = new Map<string, { edges: number, totalLev: number, a: string, b: string }>();
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
        averageLeverage: Number((e.totalLev / e.edges).toFixed(4))
      }));
    }
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
      const ts = season ? teamSeasons.filter(t => t.season === season && teams.find(tm => tm.id === t.teamId)?.conferenceId === c.id)
                        : teamSeasons.filter(t => teams.find(tm => tm.id === t.teamId)?.conferenceId === c.id);
      const vals = ts.map(t => t.spPlus).filter((v): v is number => typeof v === 'number');
      if (!vals.length) return null;
      return Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(3));
    }
  },
  Team: {
    conference: (t: TeamT) => conferenceById(t.conferenceId),
    seasons: (t: TeamT) => teamSeasons.filter(ts => ts.teamId === t.id),
    neighbors: (t: TeamT, { season }: { season: number }) => {
      const list = enrichGamesForSeason(season).filter(g => g.homeTeamId === t.id || g.awayTeamId === t.id);
      const others = new Set<string>();
      for (const g of list) {
        others.add(g.homeTeamId === t.id ? g.awayTeamId : g.homeTeamId);
      }
      return Array.from(others).map(id => teamById(id));
    },
    degree: (t: TeamT, { season }: { season: number }) => {
      const list = enrichGamesForSeason(season);
      return list.filter(g => g.homeTeamId === t.id || g.awayTeamId === t.id).length;
    }
  },
  TeamSeason: {
    team: (ts: TeamSeasonT) => teamById(ts.teamId),
    polls: (ts: TeamSeasonT) => polls.filter(p => p.teamSeasonId === ts.id),
    games: (ts: TeamSeasonT) => enrichGamesForSeason(ts.season).filter(g => g.homeTeamId === ts.teamId || g.awayTeamId === ts.teamId)
  },
  Game: {
    home: (g: GameT) => teamById(g.homeTeamId),
    away: (g: GameT) => teamById(g.awayTeamId),
    homeConference: (g: GameT) => conferenceById(teamById(g.homeTeamId).conferenceId),
    awayConference: (g: GameT) => conferenceById(teamById(g.awayTeamId).conferenceId),
    isConferenceGame: (g: GameT) => isConferenceGame(g)
  }
};

const server = new ApolloServer({ typeDefs, resolvers });

const { url } = await startStandaloneServer(server, {
  listen: { port: 4000 },
});
console.log(`🚀 GraphQL ready at ${url}`);
