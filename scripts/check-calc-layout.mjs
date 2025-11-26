import { calculateDegreePositions } from '../web/modules/cytoscape-builder.js';

const source = 'os';
const purdue = 'purdue';
const nd = 'nd';
const miami = 'miami';
const ill = 'illinois';
const mich = 'michigan';

const nodesByDegree = new Map([
  [source, 0],
  [purdue, 0],
  [nd, 0],
  [miami, 0],
  [ill, 1],
  [mich, 1],
]);

const shortestPathNodes = [source, purdue, nd, miami];
const nodeLabels = {
  [source]: 'Ohio State',
  [purdue]: 'Purdue',
  [nd]: 'Notre Dame',
  [miami]: 'Miami',
  [ill]: 'Illinois',
  [mich]: 'Michigan',
};

const pathFilter = {
  nodesByDegree,
  source,
  destination: miami,
  shortestPathNodes,
  nodeLabels,
  edges: [],
};

const positions = calculateDegreePositions(pathFilter, 1200, 600);
console.log('positions:', positions);

const sourceX = 50;
console.log('sourceX', positions[source].x, 'purdueX', positions[purdue].x);
const expectedMid = (positions[source].x + positions[purdue].x) / 2;
console.log('expectedMid', expectedMid);
console.log('illinois.x', positions[ill].x, 'michigan.x', positions[mich].x);

if (
  Math.abs(positions[ill].x - expectedMid) < 1e-6 &&
  Math.abs(positions[mich].x - expectedMid) < 1e-6
) {
  console.log('PASS: degree-1 nodes centered at midX');
} else {
  console.log(
    'FAIL: degree-1 nodes not centered',
    positions[ill].x - expectedMid,
    positions[mich].x - expectedMid
  );
}
