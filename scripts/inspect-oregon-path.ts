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

  const games = gamesRaw.map((g: any) => ({
    id: g.id || `${g.homeTeamId || g.home?.id}__${g.awayTeamId || g.away?.id}`,
    season: g.season,
    type: g.type || 'ALL',
    leverage: g.leverage || 0,
    home: { id: g.homeTeamId || (g.home && g.home.id) },
    away: { id: g.awayTeamId || (g.away && g.away.id) },
  })).filter((g: any) => g.home.id && g.away.id);

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
  console.log('shortestPath hops:', shortest ? shortest.nodes.length - 1 : 0);

  // Use degrees=3 like in your screenshot
  const pathFilter = findNodesWithinDegrees([src, dst], 3, pairGames, teams, 'ALL', 0, shortest);
  console.log(`\nTotal nodes in network: ${pathFilter.nodes.length}`);
  console.log('nodesByDegree:');
  for (const [k, v] of pathFilter.nodesByDegree) {
    console.log('  ', k, v);
  }

  if (pathFilter.edges && pathFilter.edges.length > 0) {
    const adjacency = buildAdjacencyFromEdges(pathFilter.edges);
    const distFromSource = bfsFrom(src, adjacency);
    const distToTarget = bfsFrom(dst, adjacency);
    const shortestPathLength = distFromSource.get(dst) || 0;
    const layerOffsets = computeLayerOffset(distFromSource, distToTarget, shortestPathLength);
    
    console.log('\nLayer offset distribution:');
    const layerCounts = new Map();
    for (const [nid, offset] of layerOffsets) {
      layerCounts.set(offset, (layerCounts.get(offset) || 0) + 1);
    }
    for (const [offset, count] of Array.from(layerCounts.entries()).sort((a, b) => a[0] - b[0])) {
      console.log(`  layer ${offset}: ${count} nodes`);
    }
  }

  const positions = calculateDegreePositions(pathFilter, 1200, 600);
  const nodesByDegree = pathFilter.nodesByDegree || new Map();
  
  console.log('\nNodes grouped by x-position:');
  const byX = new Map();
  for (const [id, pos] of Object.entries(positions)) {
    const x = Math.round(pos.x);
    if (!byX.has(x)) byX.set(x, []);
    byX.get(x).push({ id, ...pos, layer: pathFilter.nodesByDegree.get(id) });
  }
  
  for (const [x, nodes] of Array.from(byX.entries()).sort((a, b) => a[0] - b[0])) {
    console.log(`\n  x=${x}:`);
    nodes.sort((a, b) => a.y - b.y);
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      console.log(`    ${n.id.padEnd(20)} y=${n.y.toFixed(1).padStart(6)} deg=${n.layer}`);
      if (i > 0) {
        const prev = nodes[i-1];
        const dy = n.y - prev.y;
        if (dy < 36) {
          console.log(`      ⚠️  COLLISION: dy=${dy.toFixed(1)} < 36`);
        }
      }
    }
  }
}

main().catch(err => { console.error(err); process.exit(1); });
