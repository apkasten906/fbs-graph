# FBSGraphVisualizationRules.md

## Succinct & Implementable Graph Layout Rules

### (Rewritten for correctness, determinism, and ease of use by Codex)

---

## A. Positioning Constraints (Always True)

1. **Team A** (first selected team) is always at **x = 0**.  
   No node may be to the left of Team A.

2. **Team Z** (comparison team) is always at **x = maxX**.  
   No node may be to the right of Team Z.

3. Nodes may **never overlap**.  
   Spacing is enforced vertically; horizontal separation is guaranteed by degree logic.

4. Display only **school icons** or, if unavailable, **unique abbreviations**.

5. Display only nodes and edges that belong to **valid A→Z paths within the degree slider**.  
   Hide all nodes/edges that belong to paths larger than the selected degree.

---

## B. Path Filtering Rules

Given Team **A** and Team **Z** and a degree slider **D**:

1. Compute **all simple A→Z paths** of length ≤ **D**.
2. Collect all nodes and edges that appear in _any_ such path.
3. **Only those nodes and edges appear in the graph.**
4. If no paths exist with degree ≤ D → show message:  
   `"No connections available at this degree level."`

### Example (Minnesota → Notre Dame)

Degree = 2 → show only:

- Minnesota → Purdue → Notre Dame

Degree = 3 → show all A→Z paths with 3 hops.

Explicitly hide all edges that belong to longer paths (>3).

---

## C. Horizontal Layout Rules

Horizontal (x) placement is determined by **degree of separation** from Team A, with support for **half-degree offsets** for nodes that serve multiple structural roles.

### 1. Compute primary degree

```typescript
degree[node] = shortestDistance(A, node)
```

### 2. Apply half-degree when a node appears in multiple A→Z path layers

A node receives **+0.5** if:

- It participates in more than one A→Z decomposition layer,  
  i.e. it sits between several alternative valid A→Z path flows.

Example: Purdue in Minnesota→Notre Dame example  
→ degree = 1.5

### 3. Horizontal coordinate

```typescript
x[node] = (degree[node] / maxDegree) * maxX
```

This guarantees:

- x(A) = 0
- x(Z) = maxX
- Nodes align left→right by conceptual distance
- Half-degrees automatically place nodes between major layers

---

## D. Vertical Layout Rules

Vertical (y) positioning organizes nodes within each degree or half-degree.

### Step 1: Group nodes by their (possibly half) degree

e.g.  
Group 0 → Minnesota  
Group 1 → Rutgers, Ohio State, Northwestern, Iowa, Nebraska, Oregon  
Group 1.5 → Purdue  
Group 2 → Michigan State, California  
Group 2.5 → USC  
Group 3 → Notre Dame

### Step 2: Sort nodes within each group

Sort by:

1. **Closeness to Z** (distanceToZ ascending → more central)
2. **Fan-out into next degree group** (higher → more central)
3. **Alphabetical name** (deterministic tiebreaker)

### Step 3: Assign vertical positions

- Place the **most central** (Z-relevant) node at group vertical center.
- Place next nodes alternately above and below.
- Enforce minimum vertical spacing.

This guarantees:

- Purdue–USC line forms the visual “spine.”
- Rutgers/Ohio State appear above the main degree-1 line.
- Northwestern connects into the Purdue–USC corridor.
- Iowa, Nebraska, Oregon appear beneath the backbone.
- California → Boston College → Stanford cascade downward.

---

## E. Collision Prevention

After initial y assignment:

```typescript
for each neighboring node in sorted order:
    if overlap:
         shift lower node downwards by minY spacing
```

Do 1–2 passes for safety.

This ensures no nodes overlap.

---

## F. Edge Coloring Rules

Edges should be colored based on the **degree of the A→Z path** they belong to.

If a node or edge appears in multiple valid paths:

- Use the **highest degree** color  
  OR
- Represent multiple colors (if supported).

Color palette:

```css
0 hops → #00FF00  (Green)
1 hop  → #FFFF00  (Yellow)
2 hop  → #FFA500  (Orange)
3 hop  → #FF4500  (Red-Orange)
4 hop  → #FF6B35  (Orange-Red)
5 hop  → #DC143C  (Crimson)
6 hop  → #8B0000  (Dark Red)
```

---

## G. Summary (Codex-Friendly)

1. Build all valid A→Z paths ≤ degree slider.
2. Include only nodes/edges from these paths.
3. Compute degree[node] = shortestDistance(A, node).
4. If node participates in multiple path layers → degree += 0.5.
5. Compute x[node] from its (possibly half) degree.
6. Group nodes by degree; sort by closeness to Z + fan-out + name.
7. Assign y[node] with alternating up/down placement.
8. Resolve collisions with vertical shifts.
9. Color edges by path degree.

---

## End of Rules

This file replaces prior versions and is optimized for execution by Codex.
