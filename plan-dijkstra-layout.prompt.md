# plan-dijkstra-layout.prompt.md  
## Final Layout Plan for FBS Graph Visualizer  
### Degree-Based, Half-Degree Structured, Stable-on-Slider, Shortest-Path–Centered Layout

This plan replaces earlier versions.  
It is designed for Codex/Copilot implementation and ensures the layout behaves exactly like the user’s target diagram.

---

# 🎯 **Primary Goals**

1. **Layout must be based on degrees of separation**, not shortest-path flattening.  
2. **Shortest path becomes implicitly central**, but not forced into a straight axis.  
3. **Layout must remain stable** when the degree slider changes.  
4. **Nodes should never be recomputed when the slider changes** — only shown/hidden.  
5. **Nodes and edges appear only if part of an A→Z path** within the user-selected degree.  
6. **Multi-role bridge nodes (Purdue, USC)** must sit between degree layers using **half-degrees** (1.5, 2.5).  
7. **Vertical ordering must reflect closeness-to-Z and connectivity patterns**, matching the example diagram.

---

# 🧠 **Core Concepts**

### ✔ Degrees of Separation (integer layers)
- degree = 0 → A  
- degree = 1 → neighbors of A  
- degree = 2 → neighbors of degree 1  
- …  
- up to a global maxDegree (e.g., 6)

### ✔ Half-Degrees (bridge layers)
Used when a node appears in **multiple A→Z path levels**.

Example for Minnesota → Notre Dame:
- Purdue sits in **degree 1 AND degree 2** groups ⇒ assign **degree = 1.5**
- USC sits in **degree 2 AND degree 3** groups ⇒ assign **degree = 2.5**

### ✔ Stable Layout
The full layout must be computed **once** using maxDegree.  
Slider changes **only hide/show nodes**.

---

# 🔍 **Phase 1 — Path Discovery and Degree Assignment**

### 1. Build all simple A→Z paths up to maxDegree (6)
Use BFS or DFS with cutoff.

### 2. Keep only nodes and edges that appear in ANY valid path ≤ maxDegree.

### 3. Compute integer degree:
```
degree[node] = shortestDistanceFromA(node)
```

### 4. Compute half-degree:
If a node participates in *multiple path layers*, meaning:

- It appears at different depths in different A→Z paths,  
or  
- It serves as a mandatory bridge between two adjacent degree layers,

Then:
```
degree[node] = degree[node] + 0.5
```

Example:
- Purdue = 1.5  
- USC = 2.5

---

# 📐 **Phase 2 — Horizontal Positioning (X)**

X position is computed once and never recomputed on slider changes.

```
x[node] = (degree[node] / maxDegree) * maxX
```

Thus:
- A = 0  
- Z = maxX  
- Degree 1, 1.5, 2, 2.5, 3 are evenly spaced between them  

This matches the target screenshot.

---

# 🧭 **Phase 3 — Vertical Ordering (Y)**

Nodes are arranged *within their degree bucket* vertically.

The Y-order is determined by:

1. **Closeness to Z** (distanceToZ ascending)  
   → Nodes closer to Z should be more central.

2. **Connectivity into the next layer** (# of outgoing edges into degree+1 group)  
   → Bridge nodes become centered.

3. **Alphabetical tiebreaker**  
   → Ensures deterministic layout.

### Algorithm:

For each degree group (e.g., 1, 1.5, 2):

```
nodes = all nodes with this degree
sort(nodes, by closenessToZ, then fanOutCount, then name)
```

Vertical placement:

```
y_center = groupBaseY
assign nodes alternately above/below:
  node 0 → y_center
  node 1 → y_center - spacing
  node 2 → y_center + spacing
  node 3 → y_center - 2*spacing
  node 4 → y_center + 2*spacing
```

This yields the symmetrical “fan-out” pattern shown in the screenshot.

---

# 🧱 **Phase 4 — Collision Prevention**

After assigning initial Y positions:

```
sort all nodes by x then y

for each node a:
    for each node b within xThreshold:
        if |y[a] - y[b]| < minY:
            adjust y[b] downward until spacing satisfied
```

Perform 1–2 passes.

This ensures nodes never overlap.

---

# 🎛 **Phase 5 — Slider Behavior (Critical)**

When user changes degree slider (D):

- DO NOT recompute layout  
- DO NOT recompute degrees  
- DO NOT adjust X/Y

Instead:

```
If degree[node] > D → hide node
If degree[node] > D → hide edges attached to node
Else → show node + edges that belong to valid A→Z paths
```

This guarantees:

- Minimal changes between D=2 and D=3  
- Layout stability  
- Smooth expansion effect

---

# 🎨 **Phase 6 — Edge Coloring**

Color edges based on degree of separation of the path they are part of.

Colors:

```
0 hops → #00FF00
1 hop  → #FFFF00
2 hop  → #FFA500
3 hop  → #FF4500
4 hop  → #FF6B35
5 hop  → #DC143C
6 hop  → #8B0000
```

If an edge is part of multiple path degrees:
- Use the **highest degree** color, or
- Render a multi-stripe (optional)

---

# 🧪 **Testing Requirements**

### Minnesota → Notre Dame:

- Minnesota = degree 0  
- Degree 1 group: Rutgers, Ohio State, Northwestern, Iowa, Nebraska, Oregon  
- Degree 1.5: Purdue  
- Degree 2: Michigan State, California  
- Degree 2.5: USC  
- Degree 3: Notre Dame  

Tests:

```
Positions do not change when slider changes (D=2 → D=3).
Degree 1.5 and 2.5 appear between integer layers.
Nodes closer to Z sort to vertical center.
Purdue–USC line is near center axis.
Fan-out nodes appear symmetrically above/below.
```

---

# ⚙️ **Constants**

```
maxDegree = 6
verticalSpacing = 50
xThreshold = 80
minY = 40
maxX = width - margin
```

---

# 📌 **Summary**

This plan produces:

- Degree-layered horizontal layout  
- Half-degree bridge layers  
- Stable geometry across slider changes  
- Shortest path implicitly central  
- Vertical sorting by relevance to Z  
- Clean, readable fan-out nodes  
- Deterministic, testable behavior  

This exactly matches the layout shown in the user's reference image.

