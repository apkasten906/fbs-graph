/**
 * Data loading and processing for the FBS Timeline App
 */

export async function defaultLoadData(fetchImpl, dataBase) {
  if (!fetchImpl) {
    throw new Error('No fetch implementation provided for loading timeline data.');
  }
  const [conferences, teams, teamSeasons, polls, games] = await Promise.all([
    loadJSON(fetchImpl, dataBase, 'conferences.json'),
    loadJSON(fetchImpl, dataBase, 'teams.json'),
    loadJSON(fetchImpl, dataBase, 'teamSeasons.json'),
    loadJSON(fetchImpl, dataBase, 'polls.json'),
    loadJSON(fetchImpl, dataBase, 'games.json'),
  ]);
  return { conferences, teams, teamSeasons, polls, games };
}

async function loadJSON(fetchImpl, base, file) {
  const response = await fetchImpl(`${base}/${file}`);
  if (!response.ok) {
    throw new Error(`Failed to load ${file}`);
  }
  return response.json();
}

export function prepareSeasonModel(raw, season) {
  const conferenceMap = new Map(raw.conferences.map(conf => [conf.id, conf]));
  const teams = raw.teams.map(team => ({
    ...team,
    conference: conferenceMap.get(team.conferenceId),
  }));
  const teamMap = new Map(teams.map(team => [team.id, team]));
  const teamSeasons = raw.teamSeasons.filter(ts => ts.season === season);
  const teamSeasonMap = new Map(teamSeasons.map(ts => [`${ts.teamId}-${ts.season}`, ts]));
  const apRanks = buildLatestAPRankMap(raw.polls, season, teamSeasons);
  const games = raw.games
    .filter(game => game.season === season)
    .map(game => computeLeverageForGame(game, teamSeasonMap, apRanks))
    .map(game => ({
      ...game,
      homeTeam: teamMap.get(game.homeTeamId),
      awayTeam: teamMap.get(game.awayTeamId),
    }));
  const upcomingGames = games.filter(game => game.result === 'TBD');
  const edgesByPair = buildEdgeMap(upcomingGames);
  const adjacency = buildAdjacency(edgesByPair);

  return {
    conferences: raw.conferences,
    teams,
    teamMap,
    conferenceMap,
    teamSeasons,
    apRanks,
    games,
    upcomingGames,
    edgesByPair,
    adjacency,
  };
}

function buildLatestAPRankMap(polls, season, teamSeasons) {
  const relevantIds = new Set(teamSeasons.map(ts => ts.id));
  const latestByTeam = new Map();

  for (const snap of polls) {
    if (snap.poll !== 'AP') continue;
    if (!relevantIds.has(snap.teamSeasonId)) continue;
    const current = latestByTeam.get(snap.teamSeasonId);
    if (!current || new Date(snap.date) > new Date(current.date)) {
      latestByTeam.set(snap.teamSeasonId, snap);
    }
  }

  const map = new Map();
  for (const [teamSeasonId, snap] of latestByTeam.entries()) {
    map.set(teamSeasonId, snap.rank);
  }
  return map;
}

function computeLeverageForGame(game, teamSeasonMap, apRanks) {
  const homeSeason = teamSeasonMap.get(`${game.homeTeamId}-${game.season}`);
  const awaySeason = teamSeasonMap.get(`${game.awayTeamId}-${game.season}`);
  const rankHome = homeSeason ? apRanks.get(homeSeason.id) : undefined;
  const rankAway = awaySeason ? apRanks.get(awaySeason.id) : undefined;

  const rwh =
    rankHome !== undefined
      ? Math.max(0.2, rankWeightFromRank(rankHome) ?? 0)
      : (percentileFromSP(homeSeason?.spPlus) ?? 0.3);
  const rwa =
    rankAway !== undefined
      ? Math.max(0.2, rankWeightFromRank(rankAway) ?? 0)
      : (percentileFromSP(awaySeason?.spPlus) ?? 0.3);

  const bb = bridgeBoost(game.type);
  const tb = timingBoost(game.phase, game.week, game.type);
  const leverage = Number((rwh * rwa * bb * tb).toFixed(4));

  return {
    ...game,
    leverage,
    rankWeightHome: Number(rwh.toFixed(3)),
    rankWeightAway: Number(rwa.toFixed(3)),
    bridgeBoost: Number(bb.toFixed(2)),
    timingBoost: Number(tb.toFixed(2)),
  };
}

export function buildEdgeMap(games) {
  const map = new Map();
  for (const game of games) {
    const key = edgeKey(game.homeTeamId, game.awayTeamId);
    if (!map.has(key)) {
      map.set(key, { key, teams: [game.homeTeamId, game.awayTeamId], games: [] });
    }
    map.get(key).games.push(game);
  }
  for (const entry of map.values()) {
    entry.games.sort((a, b) => (b.leverage ?? 0) - (a.leverage ?? 0));
  }
  return map;
}

export function buildAdjacency(edgeMap) {
  const adjacency = new Map();
  for (const entry of edgeMap.values()) {
    if (!entry.games.length) continue;
    const [a, b] = entry.teams;
    const best = entry.games[0];
    const weight = best.leverage ? 1 / best.leverage : Number.POSITIVE_INFINITY;
    addNeighbor(adjacency, a, { to: b, weight, key: entry.key, best });
    addNeighbor(adjacency, b, { to: a, weight, key: entry.key, best });
  }
  return adjacency;
}

// Helper functions
function edgeKey(a, b) {
  return a < b ? `${a}__${b}` : `${b}__${a}`;
}

function addNeighbor(adjacency, from, edge) {
  if (!adjacency.has(from)) {
    adjacency.set(from, []);
  }
  adjacency.get(from).push(edge);
}

function rankWeightFromRank(rank) {
  if (!rank) return undefined;
  return 1.2 - rank / 25;
}

function percentileFromSP(spPlus) {
  if (spPlus === undefined || spPlus === null) return undefined;
  const clamped = Math.max(-10, Math.min(35, spPlus));
  return (clamped + 10) / 45;
}

function timingBoost(phase, week, type) {
  if (type === 'PLAYOFF') return 1.4;
  if (type === 'CHAMPIONSHIP') return 1.3;
  if (phase === 'POSTSEASON') return 1.25;
  if (week === undefined || week === null) return 1.05;
  if (week >= 12) return 1.18;
  if (week >= 9) return 1.12;
  if (week >= 6) return 1.08;
  return 1.02;
}

function bridgeBoost(type) {
  if (type === 'NON_CONFERENCE') return 1.2;
  if (type === 'CHAMPIONSHIP' || type === 'PLAYOFF') return 1.3;
  return 1.0;
}
