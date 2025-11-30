Plan: Dijkstra-based Multi-Anchor Layout

Goal

- Improve graph layout for dense, multi-anchor cases (e.g., Minnesota ↔ Notre Dame with USC bridging multiple anchors).
- Produce deterministic, readable node positions using Dijkstra distances, multi-anchor averaging, and a light collision-avoidance pass.

High-level approach

1. Multi-source distances: compute shortest-path distances from each anchor node (selected path nodes or primary endpoints) so each node has distances to anchors.
2. Anchor set per node: collect anchors that a node is directly connected to (or within a 1-hop tolerance). Use this set rather than the first-found anchor.
3. Placement by interpolation/weighting: compute node X as an average (or weighted average by inverse distance) of anchor X positions. If exactly two main endpoints exist, optionally use linear interpolation along the A→B axis using relative distances.
4. Perpendicular offset (Y): deterministically offset nodes perpendicular to the main axis based on degree or a stable tie-breaker (name hash) to avoid overlaps.
5. Collision pass: sweep nodes horizontally and separate nodes vertically when within a minimum spacing threshold.
6. Optional refinement: run a short constrained force pass (or a single Cytoscape layout iteration) to tidy spacing while keeping anchors mostly fixed.

Detailed placement algorithm

- Input:
  - `anchorNodes`: nodes on the selected shortest path(s) or two primary endpoints.
  - `anchorPositions`: map of anchor node id -> {x, y} (initial fixed positions, e.g., evenly spaced across width).
  - `distances[nodeId][anchorId]`: computed Dijkstra distances from node to each anchor.
  - `degreeRank[nodeId]`: deterministic rank for stacking nodes with identical anchor projections (e.g., sort by degree then id/name).

- For each node v:
  1. Determine `connectedAnchors`: anchors with which v shares at least one edge or which are within 1 hop (tunable). If empty, use the nearest 1-2 anchors by distance.
  2. Collect anchorXs = connectedAnchors.map(a => anchorPositions[a].x) and anchorYs similarly.
  3. Compute weights = connectedAnchors.map(a => 1 / (1 + distances[v][a])) to prefer closer anchors.
  4. Compute weighted average x: x = sum(weights[i]\*anchorXs[i]) / sum(weights).
  5. Compute anchor Y baseline: yBase = weighted average of anchorYs (same weights).
  6. Perpendicular offset:
     - step = configurable baseSpacing (e.g., 28 px)
     - rank = deterministic rank for node among other nodes with similar x
     - side = (rank % 2 === 0) ? +1 : -1
     - offset = side _ Math.ceil((rank + 1)/2) _ step
     - y = yBase + offset
  7. Store provisional position {x, y}.

- Collision avoidance (simple deterministic sweep):
  1. Sort nodes by x ascending.
  2. For each node a in order, check subsequent nodes b while |b.x - a.x| < xThreshold.
  3. If |b.y - a.y| < minY, move b.y to a.y + sign \* minY (choose sign deterministically — e.g., positive if b.rank >= a.rank).
  4. Repeat or iterate once for a deterministic packing.

Optional interpolation for two endpoints (A, B):

- If layout should follow a strict A→B axis (two main endpoints):
  - t = distToA / (distToA + distToB || 1)
  - x = xA*(1-t) + xB*t
  - Use weights or fallback to averaged anchors for intermediate cases.

Why this reduces bias and clutter

- Uses all relevant anchors per node instead of the first-found anchor, so bridge nodes like USC are centered between the anchors they connect to.
- Weighted averages keep nodes closer to nearer anchors naturally.
- Perpendicular stacking prevents many nodes collapsing to the exact same coordinates.
- Deterministic ranking and sweep-based collision avoidance keeps layout reproducible for tests and snapshots.

Implementation notes (code locations)

- Primary candidate: `web/modules/cytoscape-builder.js` — function `calculateDegreePositions(pathFilter, width, height)`.
  - Replace or augment the existing anchor selection logic that picks `anchorIdxs[0]` with a multi-anchor collection and the weighted placement algorithm.
  - Add helper functions:
    - `computeAnchorDistances(adjacency, anchorNodes)` — returns distances map using Dijkstra multi-source or repeated runs.
    - `deterministicRankForX(nodesAtX)` — returns stable ranks (degree desc, id asc).
    - `applyCollisionSweep(positions, xThreshold, minY)` — performs a single deterministic separation pass.
  - Make `MIDPOINT_FRACTION`, `BASE_SPACING`, `X_THRESHOLD`, and `MIN_Y` configurable constants near top of module.

Testing ideas

- Unit test: Minnesota ↔ Notre Dame scenario
  - Prepare a small graph fixture where USC connects to both anchors.
  - Run `calculateDegreePositions` and assert that USC.x is within epsilon of midpoint of the average anchor X positions (or weighted average result).
- Determinism tests:
  - Run layout twice on same input and assert exact equality of positions.
- Collision tests:
  - Create multiple nodes with same anchor projection, ensure their y positions differ by at least `MIN_Y`.
- Full visual smoke: run `web/tests/cytoscape-builder.test.ts` to validate no regressions.

UI knobs

- `Spread` slider: multiplies `BASE_SPACING` for perpendicular offsets.
- `Anchor mode` toggle: `average` vs `two-end-interpolate` vs `force-refine`.

Tradeoffs & extensions

- Force refinement yields smoother visuals but may reduce determinism; seedable force or a single deterministic iteration can mitigate this.
- For extremely dense graphs, add an aggregation step (group low-degree leaves into a collapsed "cluster" node with expand-on-click).
- Edge bundling or curved edges help readability when many segments share anchors.

Concrete next steps (I can implement now)

1. Implement weighted multi-anchor averaging + deterministic y-offset + collision sweep inside `calculateDegreePositions` (minimal and safe). Run tests and adjust constants.
2. Add unit test for the Minnesota example and deterministic layout tests.
3. Optionally add a short constrained force pass as a separate patch.

Which step would you like me to implement now? I can apply step 1 and run the test suite immediately.
