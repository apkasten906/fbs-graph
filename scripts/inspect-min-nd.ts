// @ts-nocheck
import fs from 'fs';
import path from 'path';
import { findNodesWithinDegrees, shortestPathByInverseLeverage } from '../web/modules/graph-path-finder.js';
import {
  buildGraphElements,
  calculateDegreePositions,
  createEdgeKey,
  buildAdjacencyFromEdges,
  bfsFrom,
  computeLayerOffset,
} from '../web/modules/cytoscape-builder.js';

async function main() {
  type Team = { id: string; name: string; [key: string]: any };
  const teams: Team[] = JSON.parse(fs.readFileSync(path.resolve('src/data/teams.json'), 'utf8'));
  const gamesRaw = JSON.parse(fs.readFileSync(path.resolve('src/data/games.json'), 'utf8'));

  // normalize games into the shape expected by buildGraphElements / pairGames
  const games = gamesRaw.map((g: any) => ({
    id: g.id || `${g.homeTeamId || g.home?.id}__${g.awayTeamId || g.away?.id}`,
    season: g.season,
    type: g.type || 'ALL',
    leverage: g.leverage || 0,
    home: { id: g.homeTeamId || (g.home && g.home.id) },
    away: { id: g.awayTeamId || (g.away && g.away.id) },
  })).filter((g: any) => g.home.id && g.away.id);

  // Build pairGames map for shortestPath
  const pairGames = new Map();
  for (const g of games) {
    const a = g.home.id;
    const b = g.away.id;
    const k = a < b ? `${a}__${b}` : `${b}__${a}`;
    const arr = pairGames.get(k) || [];
    arr.push(g);
    pairGames.set(k, arr);
  }

  const src = 'minnesota';
  const dst = 'notre-dame';

  const shortest = shortestPathByInverseLeverage(src, dst, pairGames, teams, 'ALL', 0);
  console.log('shortestPath:', shortest && shortest.nodes ? shortest.nodes.join(' -> ') : 'none');

  const pathFilter = findNodesWithinDegrees([src, dst], 3, pairGames, teams, 'ALL', 0, shortest);
  console.log('nodesByDegree:');
  for (const [k, v] of pathFilter.nodesByDegree) {
    console.log(' ', k, v);
  }

  // Show edge keys and their connections
  console.log('\nEdges in pathFilter:');
  for (const edgeKey of (pathFilter.edges || []).slice(0, 10)) {
    const games = pairGames.get(edgeKey) || [];
    const totalLeverage = games.reduce((sum: number, g: any) => sum + (g.leverage || 0), 0);
    const avgLeverage = games.length > 0 ? totalLeverage / games.length : 0;
    console.log(`  ${edgeKey.padEnd(30)} games=${games.length} avgLev=${avgLeverage.toFixed(3)}`);
  }

  // Compute and print layer offsets using new layering algorithm
  let layerOffsets = null;
  if (pathFilter.edges && pathFilter.edges.length > 0) {
    const adjacency = buildAdjacencyFromEdges(pathFilter.edges);
    const distFromSource = bfsFrom(src, adjacency);
    const distToTarget = bfsFrom(dst, adjacency);
    const shortestPathLength = distFromSource.get(dst) || 0;
    layerOffsets = computeLayerOffset(distFromSource, distToTarget, shortestPathLength);
    
    console.log('\nLayer offsets (layer_offset = 0 means on shortest path):');
    const sortedOffsets = Array.from(layerOffsets.entries()).sort((a, b) => {
      if (a[1] !== b[1]) return a[1] - b[1];
      return a[0] < b[0] ? -1 : 1;
    });
    for (const [nid, offset] of sortedOffsets) {
      console.log(`  ${nid}: ${offset}`);
    }
  }

  const elements = buildGraphElements({
    teams,
    games,
    teamIndex: new Map(teams.map(t => [t.id, t])),
    pairGames: new Map(), // will be populated by function
    typeFilter: 'ALL',
    minLeverage: 0,
    pathFilter,
  });

  // extract edge elements and print colors for USC--Notre Dame and others
  const edgeMap = new Map();
  for (const el of elements) {
    if (el.group === 'edges') {
      edgeMap.set(el.data.id.replace(/^e_/, ''), el.data);
    }
  }

  const keysToCheck = [
    createEdgeKey('usc', 'notre-dame'),
    createEdgeKey('minnesota', 'oregon'),
    createEdgeKey('oregon', 'usc'),
  ];

  console.log('\nEdge colors (shortest-path edges should be #00FF00):');
  for (const k of keysToCheck) {
    const e = edgeMap.get(k);
    console.log(`  ${k}: ${e ? e.edgeColor : '(not present)'}`);
  }

  // compute positions
  const positions = calculateDegreePositions(pathFilter, 1200, 600);
  const nodesByDegree = pathFilter.nodesByDegree || new Map();
  
  console.log('\nAll node positions (sorted by x, then y):');
  const allNodes = Object.keys(positions).map(id => ({
    id,
    ...positions[id],
    layer: layerOffsets ? layerOffsets.get(id) : '?',
    degree: nodesByDegree.get(id) || 0
  }));
  allNodes.sort((a, b) => {
    if (Math.abs(a.x - b.x) > 1) return a.x - b.x;
    return a.y - b.y;
  });
  
  for (const n of allNodes) {
    const layerStr = n.layer === 0 ? '[PATH]' : `[L${n.layer}]`;
    console.log(`  ${n.id.padEnd(15)} ${layerStr.padEnd(8)} x=${n.x.toFixed(1).padStart(6)} y=${n.y.toFixed(1).padStart(6)} deg=${n.degree}`);
  }

  // Check for collisions
  console.log('\nCollision check (nodes within X_THRESHOLD=180 and MIN_Y=36):');
  let collisions = 0;
  for (let i = 0; i < allNodes.length; i++) {
    for (let j = i + 1; j < allNodes.length; j++) {
      const a = allNodes[i];
      const b = allNodes[j];
      if (Math.abs(b.x - a.x) < 180 && Math.abs(b.y - a.y) < 36) {
        console.log(`  COLLISION: ${a.id} (${a.x.toFixed(1)}, ${a.y.toFixed(1)}) vs ${b.id} (${b.x.toFixed(1)}, ${b.y.toFixed(1)}) - dy=${Math.abs(b.y - a.y).toFixed(1)}`);
        collisions++;
      }
    }
  }
  if (collisions === 0) {
    console.log('  ✓ No collisions detected');
  }
}

main().catch(err => { console.error(err); process.exit(1); });
