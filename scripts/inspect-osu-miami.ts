// @ts-nocheck
import { buildAdjacencyFromEdges, bfsFrom, computeLayerOffset } from '../web/modules/cytoscape-builder.js';
import { findNodesWithinDegrees } from '../web/modules/graph-path-finder.js';
import fs from 'fs';

const teams = JSON.parse(fs.readFileSync('./src/data/teams.json', 'utf-8'));
const games = JSON.parse(fs.readFileSync('./src/data/games.json', 'utf-8'));

const teamMap = new Map(teams.map(t => [t.id, t]));

// Build pair games
const pairGames = new Map();
for (const g of games) {
  if (!g.homeTeamId || !g.awayTeamId) continue;
  const a = g.homeTeamId;
  const b = g.awayTeamId;
  const k = a < b ? `${a}__${b}` : `${b}__${a}`;
  const arr = pairGames.get(k) || [];
  // Transform to expected format
  arr.push({
    ...g,
    home: { id: g.homeTeamId },
    away: { id: g.awayTeamId },
    leverage: 0
  });
  pairGames.set(k, arr);
}

const source = 'ohio-state';
const dest = 'miami';
const maxDegrees = 3;

console.log(`Source team: ${teamMap.get(source)?.name || 'NOT FOUND'}`);
console.log(`Dest team: ${teamMap.get(dest)?.name || 'NOT FOUND'}`);
console.log(`Total teams: ${teams.length}`);
console.log(`Total games: ${games.length}`);
console.log(`Total pair connections: ${pairGames.size}`);

console.log(`\nFinding paths from ${teamMap.get(source).name} to ${teamMap.get(dest).name} with maxDegrees=${maxDegrees}\n`);

const result = findNodesWithinDegrees(
  [source, dest],
  maxDegrees,
  pairGames,
  teams,
  'ALL',
  0,
  null
);

console.log(`Found ${result.nodes.length} nodes and ${result.edges.length} edges\n`);

console.log('Nodes:');
for (const nodeId of result.nodes.sort()) {
  const degree = result.nodesByDegree.get(nodeId) || '?';
  console.log(`  ${teamMap.get(nodeId).name.padEnd(25)} (${nodeId.padEnd(20)}) - layer_offset=${degree}`);
}

console.log('\nEdges:');
for (const edgeKey of result.edges.sort()) {
  const [a, b] = edgeKey.split('__');
  console.log(`  ${teamMap.get(a).name} ↔ ${teamMap.get(b).name}`);
}

// Build adjacency and compute BFS distances
const adjacency = buildAdjacencyFromEdges(result.edges);
const distFromSource = bfsFrom(source, adjacency);
const distToTarget = bfsFrom(dest, adjacency);

console.log('\nBFS distances from Ohio State:');
for (const nodeId of result.nodes.sort()) {
  const dist = distFromSource.get(nodeId);
  console.log(`  ${teamMap.get(nodeId).name.padEnd(25)} - ${dist} hops`);
}

console.log('\nBFS distances to Miami:');
for (const nodeId of result.nodes.sort()) {
  const dist = distToTarget.get(nodeId);
  console.log(`  ${teamMap.get(nodeId).name.padEnd(25)} - ${dist} hops`);
}

console.log('\nPath reconstruction:');
console.log(`Shortest path length: ${distFromSource.get(dest)} hops`);

// Find all paths
const layerOffsets = computeLayerOffset(distFromSource, distToTarget, distFromSource.get(dest));
console.log('\nNodes by layer_offset (0 = on a shortest path):');
for (const [nodeId, offset] of Array.from(layerOffsets.entries()).sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))) {
  console.log(`  ${teamMap.get(nodeId).name.padEnd(25)} - layer_offset=${offset}`);
}
