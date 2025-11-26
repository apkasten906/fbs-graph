/**
 * Graph UI Rendering Module
 *
 * Handles DOM manipulation and UI updates for the graph visualizer.
 * Provides functions for displaying edge game details, building legends, and populating selectors.
 */

/**
 * Display games for a clicked edge in the info panel
 *
 * @param {Object} edgeData - Cytoscape edge data object
 * @param {Map} pairGames - Map of edge key to game array
 * @param {string} containerId - ID of the container element (default: 'pathInfo')
 */
export function showEdgeGames(edgeData, pairGames, containerId = 'pathInfo') {
  const { id } = edgeData;
  const [_, k] = id.split('e_');
  const games = pairGames.get(k) || [];
  const container = document.getElementById(containerId);

  if (!container) {
    console.error(`Container element '${containerId}' not found`);
    return;
  }

  // Build DOM nodes instead of using innerHTML to avoid XSS and ensure safe updates
  const frag = document.createDocumentFragment();
  const header = document.createElement('div');
  header.className = 'small muted';
  header.textContent = `Games on this connection (${games.length}):`;
  frag.appendChild(header);

  for (const g of games.slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''))) {
    const when = g.date ? new Date(g.date).toLocaleString() : 'TBD';
    const row = document.createElement('div');
    row.className = 'mono';
    row.textContent = `${when} — ${g.home.name} vs ${g.away.name} `;
    const lev = document.createElement('span');
    lev.className = 'muted';
    lev.textContent = `(lev ${Number(g.leverage || 0).toFixed(3)})`;
    row.appendChild(lev);
    frag.appendChild(row);
  }

  container.replaceChildren(frag);
}

/**
 * Build conference legend showing all conferences in the data
 *
 * @param {Array} teams - Array of team objects
 * @param {Array} conferenceMeta - Array of conference metadata
 * @param {Object} colors - Conference color mapping
 * @param {string} containerId - ID of the container element (default: 'legend')
 */
export function buildLegend(teams, conferenceMeta, colors, containerId = 'legend') {
  const container = document.getElementById(containerId);

  if (!container) {
    console.error(`Container element '${containerId}' not found`);
    return;
  }

  container.replaceChildren();
  const seen = new Set();

  // Collect all conferences present in the data
  for (const t of teams) {
    const conf = (t.conference && t.conference.id) || 'other';
    seen.add(conf);
  }

  // Map to full names, filter, and sort
  const legendEntries = Array.from(seen)
    .map(id => {
      const meta = conferenceMeta.find(c => c.id === id);
      return {
        id,
        color: colors[id] || colors.other || '#444444',
        label: meta ? `${meta.name} (${meta.shortName})` : id.toUpperCase(),
        sortKey: meta ? meta.name : id,
      };
    })
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey));

  for (const entry of legendEntries) {
    const dot = document.createElement('div');
    dot.className = 'dot';
    dot.style.background = entry.color;
    const lbl = document.createElement('div');
    lbl.textContent = entry.label;
    container.appendChild(dot);
    container.appendChild(lbl);
  }
}

/**
 * Build team selector dropdowns with default selections
 *
 * @param {Array} teams - Array of team objects
 * @param {string} srcSelectorId - ID of the source team selector (default: 'srcSel')
 * @param {string} dstSelectorId - ID of the destination team selector (default: 'dstSel')
 * @param {Object} options - Configuration options
 * @param {string} options.defaultSrc - Default source team name pattern (default: 'ohio state')
 * @param {string} options.defaultDst - Default destination team name pattern (default: 'georgia')
 * @param {boolean} options.autoTrigger - Auto-trigger comparison button (default: true)
 * @param {string} options.triggerButtonId - ID of button to click (default: 'pathBtn')
 */
export function buildSelectors(
  teams,
  srcSelectorId = 'srcSel',
  dstSelectorId = 'dstSel',
  options = {}
) {
  const {
    defaultSrc = 'ohio state',
    defaultDst = 'georgia',
    autoTrigger = true,
    triggerButtonId = 'pathBtn',
  } = options;

  const srcSel = document.getElementById(srcSelectorId);
  const dstSel = document.getElementById(dstSelectorId);

  if (!srcSel || !dstSel) {
    console.error(`Selector elements not found: ${srcSelectorId} or ${dstSelectorId}`);
    return;
  }

  const opts = teams.slice().sort((a, b) => a.name.localeCompare(b.name));
  srcSel.replaceChildren();
  dstSel.replaceChildren();

  for (const t of opts) {
    const o1 = document.createElement('option');
    o1.value = t.id;
    o1.textContent = t.name;
    srcSel.appendChild(o1);

    const o2 = document.createElement('option');
    o2.value = t.id;
    o2.textContent = t.name;
    dstSel.appendChild(o2);
  }

  // Set default selections
  const osuId = opts.find(t => t.name.toLowerCase().includes(defaultSrc))?.id || opts[0]?.id;
  const ugaId = opts.find(t => t.name.toLowerCase().includes(defaultDst))?.id || opts[1]?.id;

  if (osuId) srcSel.value = osuId;
  if (ugaId) dstSel.value = ugaId;

  // Auto-trigger comparison with default selections
  if (autoTrigger) {
    setTimeout(() => {
      const btn = document.getElementById(triggerButtonId);
      if (btn) btn.click();
    }, 100);
  }
}
