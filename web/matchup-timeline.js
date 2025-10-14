const tierLabels = {
  critical: 'Critical leverage',
  high: 'High leverage',
  notable: 'Notable leverage',
  watch: 'Watchlist leverage',
};

const tierColor = {
  critical: 'var(--red)',
  high: 'var(--gold)',
  notable: 'var(--indigo)',
  watch: 'var(--emerald)',
};

const palette = [
  'var(--gold)',
  'var(--accent)',
  'var(--indigo)',
  'var(--emerald)',
  'var(--red)',
  'var(--slate)',
];

const GRAPH_TYPES = [
  { id: 'ALL', label: 'All matchups' },
  { id: 'CONFERENCE', label: 'Conference games' },
  { id: 'NON_CONFERENCE', label: 'Non-conference games' },
];

const CONFERENCE_COLORS = {
  sec: '#6CCFF6',
  b1g: '#B28DFF',
  b12: '#F6AE2D',
  acc: '#4CC9F0',
  aac: '#FF6B6B',
  mwc: '#80ED99',
  mac: '#FFD166',
  sbc: '#90CAF9',
  cusa: '#FF9E00',
  ind: '#BDB2FF',
  pac12: '#9CCC65',
};

const DEFAULT_CONFERENCE_COLOR = '#CCD6F6';

function colorForConference(conferenceId) {
  if (!conferenceId) return DEFAULT_CONFERENCE_COLOR;
  return CONFERENCE_COLORS[conferenceId] ?? DEFAULT_CONFERENCE_COLOR;
}

const power4Set = new Set(['sec', 'b1g', 'b12', 'acc']);

const conferenceScopes = [
  { id: 'all', label: 'All FBS', filter: () => true },
  { id: 'power4', label: 'Power 4', filter: team => power4Set.has(team.conferenceId) },
  { id: 'sec', label: 'SEC', filter: team => team.conferenceId === 'sec' },
  { id: 'b1g', label: 'Big Ten', filter: team => team.conferenceId === 'b1g' },
  { id: 'b12', label: 'Big 12', filter: team => team.conferenceId === 'b12' },
  { id: 'acc', label: 'ACC', filter: team => team.conferenceId === 'acc' },
  { id: 'ind', label: 'Independents', filter: team => team.conferenceId === 'ind' },
];

function determineTier(value) {
  if (value >= 1.25) return 'critical';
  if (value >= 1.05) return 'high';
  if (value >= 0.85) return 'notable';
  return 'watch';
}

function createTimelineApp(options = {}) {
  const win = options.window ?? window;
  const doc = options.document ?? win.document;
  const location = options.location ?? win.location;
  const pathSummary = options.pathSummary ?? doc.getElementById('pathSummary');
  const filters = options.filters ?? doc.getElementById('filters');
  const timeline = options.timeline ?? doc.getElementById('timeline');
  const networkPanel = options.networkPanel ?? doc.getElementById('networkPanel');
  const networkControls = options.networkControls ?? doc.getElementById('networkControls');
  const networkFocus = options.networkFocus ?? doc.getElementById('networkFocus');
  const networkLegend = options.networkLegend ?? doc.getElementById('networkLegend');
  const networkSummary = options.networkSummary ?? doc.getElementById('networkSummary');
  const networkGraphContainer =
    options.networkGraphContainer ?? doc.getElementById('networkGraph');
  const networkEmpty = options.networkEmpty ?? doc.getElementById('networkEmpty');
  const fetchImpl = options.fetch ?? (typeof win.fetch === 'function' ? win.fetch.bind(win) : null);
  const dataBase = options.dataBase ?? '../src/data';
  const season = options.season ?? 2025;
  const loadData = options.loadData ?? (() => defaultLoadData(fetchImpl, dataBase));

  const state = {
    loading: true,
    error: null,
    season,
    scope: 'power4',
    activeTier: 'all',
    startTeam: null,
    endTeam: null,
    graphType: 'ALL',
    graphConference: 'all',
    graphShowIsolated: false,
    focusSelection: null,
    focusTeam: null,
    focusDegrees: 2,
    data: null,
    path: null,
    segments: [],
    summary: null,
    graphStats: { nodes: 0, edges: 0, hiddenIsolates: 0, candidates: 0 },
  };

  const graphState = {
    cy: null,
    adjacency: new Map(),
  };

  renderSummary();
  renderFilters();
  renderTimeline();
  renderNetworkPanel();

  const runningFromFile = location?.protocol === 'file:';
  const ready = runningFromFile ? Promise.resolve(false) : init();

  if (runningFromFile) {
    renderFileModeNotice();
  }

  async function init() {
    try {
      const raw = await loadData();
      state.data = prepareSeasonModel(raw, state.season);
      const available = getTeamsForScope('power4');
      const defaultStart =
        available.find(team => team.id === 'alabama')?.id ?? available[0]?.id ?? null;
      let defaultEnd =
        available.find(team => team.id === 'clemson' && team.id !== defaultStart)?.id ??
        chooseFallbackTeam(available, defaultStart);
      if (defaultEnd === defaultStart) {
        defaultEnd = chooseFallbackTeam(available, defaultStart);
      }
      Object.assign(state, { loading: false, startTeam: defaultStart, endTeam: defaultEnd });
      updatePath();
    } catch (error) {
      state.loading = false;
      state.error = error instanceof Error ? error.message : String(error);
    }
    renderSummary();
    renderFilters();
    renderTimeline();
    renderNetworkPanel();
    return !state.error;
  }

  function getTeamsForScope(scopeId = state.scope) {
    if (!state.data) return [];
    const scope = conferenceScopes.find(item => item.id === scopeId);
    const filterFn = scope?.filter ?? (() => true);
    return state.data.teams
      .filter(filterFn)
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  function applyState(patch) {
    const shouldUpdatePath = ['startTeam', 'endTeam', 'scope'].some(key => key in patch);
    Object.assign(state, patch);
    if (shouldUpdatePath && !state.loading && state.data) {
      updatePath();
    }
    renderSummary();
    renderFilters();
    renderTimeline();
    renderNetworkPanel();
  }

  function updatePath() {
    if (!state.data) return;
    if (!state.startTeam || !state.endTeam) {
      state.path = null;
      state.segments = [];
      state.summary = null;
      return;
    }
    if (state.startTeam === state.endTeam) {
      state.path = null;
      state.segments = [];
      state.summary = null;
      return;
    }
    const result = findShortestPath(state.data.adjacency, state.startTeam, state.endTeam);
    if (!result) {
      state.path = null;
      state.segments = [];
      state.summary = null;
      return;
    }
    state.path = result;
    const segments = result.edges.map((edge, index) => {
      const entry = state.data.edgesByPair.get(edge.key);
      const fromTeam = state.data.teamMap.get(edge.from);
      const toTeam = state.data.teamMap.get(edge.to);
      const color = palette[index % palette.length];
      return {
        id: edge.key,
        from: fromTeam,
        to: toTeam,
        color,
        label: `${fromTeam?.name ?? edge.from} ↔ ${toTeam?.name ?? edge.to}`,
        games: entry ? entry.games : [],
      };
    });
    state.segments = segments;
    // DEBUG: Log segments after path update
    console.debug('[TimelineApp] updatePath: segments', segments);
    const programs = result.nodes.map(id => state.data.teamMap.get(id)).filter(Boolean);
    const bestGames = segments.map(seg => seg.games[0]).filter(Boolean);
    const totalLev = bestGames.reduce((acc, game) => acc + (game.leverage ?? 0), 0);
    const avgLev = bestGames.length ? totalLev / bestGames.length : 0;
    const conferences = Array.from(
      new Set(programs.map(p => p.conference?.shortName).filter(Boolean))
    );
    state.summary = {
      programs,
      hops: segments.length,
      averageLeverage: Number(avgLev.toFixed(3)),
      totalDistance: Number((result.distance ?? 0).toFixed(3)),
      conferences,
    };
  }

  function renderSummary() {
    if (!pathSummary) return;
    pathSummary.innerHTML = '';
    if (state.loading) {
      pathSummary.appendChild(createEmptyState('Loading leverage data…'));
      return;
    }
    if (state.error) {
      pathSummary.appendChild(createEmptyState(`Unable to load leverage data: ${state.error}`));
      return;
    }
    if (!state.data) return;

    const startTeam = state.startTeam ? state.data.teamMap.get(state.startTeam) : null;
    const endTeam = state.endTeam ? state.data.teamMap.get(state.endTeam) : null;
    if (!startTeam || !endTeam) {
      pathSummary.appendChild(createEmptyState('Pick two programs to trace the leverage chain.'));
      return;
    }

    // Header section
    const heading = doc.createElement('header');
    const title = doc.createElement('h2');
    title.textContent = 'Shortest leverage chain';
    heading.appendChild(title);
    const copy = doc.createElement('p');
    if (state.path && state.summary) {
      copy.textContent = `A leveraged hop-by-hop view that passes from the ${startTeam.conference?.shortName ?? ''} through ${state.summary.programs
        .map(p => p.conference?.shortName ?? '')
        .filter(Boolean)
        .join(' into the ')} to reach ${endTeam.name}.`;
    } else if (state.startTeam === state.endTeam) {
      copy.textContent = 'Choose a different destination to analyze the leverage bridge.';
    } else {
      copy.textContent =
        'These programs are not connected by any remaining 2025 games under the current schedule.';
    }
    heading.appendChild(copy);
    pathSummary.appendChild(heading);

    // Path chain
    const chain = doc.createElement('div');
    chain.className = 'leverage-chain';
    const programList =
      state.path && state.summary
        ? state.summary.programs
        : [startTeam, ...(state.startTeam === state.endTeam ? [] : [endTeam])];
    programList.forEach((program, index) => {
      const chip = doc.createElement('span');
      chip.className = 'program-chip';
      chip.textContent =
        `${program.name} ${program.conference?.shortName ? program.conference.shortName : ''}`.trim();
      chain.appendChild(chip);
      if (index < programList.length - 1) {
        const arrow = doc.createElement('span');
        arrow.className = 'arrow';
        arrow.textContent = '→';
        chain.appendChild(arrow);
      }
    });
    pathSummary.appendChild(chain);

    // Legend for segments (if available)
    if (state.segments && state.segments.length) {
      const legend = doc.createElement('div');
      legend.className = 'legend';
      state.segments.forEach(segment => {
        const item = doc.createElement('div');
        item.className = 'legend-row';
        const swatch = doc.createElement('span');
        swatch.className = 'legend-swatch';
        swatch.style.background = segment.color;
        item.appendChild(swatch);
        const text = doc.createElement('span');
        text.textContent = segment.label;
        item.appendChild(text);
        legend.appendChild(item);
      });
      pathSummary.appendChild(legend);
    }
  }

  function renderFilters() {
    if (!filters) return;
    filters.innerHTML = '';
    if (state.loading) {
      filters.appendChild(createEmptyState('Loading selections…'));
      return;
    }
    if (state.error) {
      filters.appendChild(createEmptyState(`Unable to load filters: ${state.error}`));
      return;
    }

    const scopeHeading = doc.createElement('h3');
    scopeHeading.textContent = 'Conference scope';
    filters.appendChild(scopeHeading);

    const scopeRow = doc.createElement('div');
    scopeRow.className = 'filter-row';
    conferenceScopes.forEach(scope => {
      const button = doc.createElement('button');
      button.type = 'button';
      button.className = 'chip';
      button.dataset.active = String(state.scope === scope.id);
      button.textContent = scope.label;
      button.addEventListener('click', () => {
        if (state.scope === scope.id) return;
        const teams = getTeamsForScope(scope.id);
        let startTeam = state.startTeam;
        let endTeam = state.endTeam;
        if (!teams.some(team => team.id === startTeam)) {
          startTeam = teams[0]?.id ?? null;
        }
        if (!teams.some(team => team.id === endTeam) || startTeam === endTeam) {
          endTeam = chooseFallbackTeam(teams, startTeam);
        }
        applyState({ scope: scope.id, startTeam, endTeam });
      });
      scopeRow.appendChild(button);
    });
    filters.appendChild(scopeRow);

    const controlGrid = doc.createElement('div');
    controlGrid.className = 'control-grid';

    const startControl = doc.createElement('div');
    startControl.className = 'control';
    const startLabel = doc.createElement('label');
    startLabel.setAttribute('for', 'startTeam');
    startLabel.textContent = 'Origin program';
    const startSelect = createTeamSelect('startTeam', state.startTeam);
    startControl.append(startLabel, startSelect);

    const endControl = doc.createElement('div');
    endControl.className = 'control';
    const endLabel = doc.createElement('label');
    endLabel.setAttribute('for', 'endTeam');
    endLabel.textContent = 'Destination program';
    const endSelect = createTeamSelect('endTeam', state.endTeam);
    endControl.append(endLabel, endSelect);

    controlGrid.append(startControl, endControl);
    filters.appendChild(controlGrid);

    const tierHeading = doc.createElement('h3');
    tierHeading.textContent = 'Focus by leverage tier';
    filters.appendChild(tierHeading);

    const tierRow = doc.createElement('div');
    tierRow.className = 'filter-row';
    ['all', ...Object.keys(tierLabels)].forEach(tierKey => {
      const button = doc.createElement('button');
      button.type = 'button';
      button.className = 'chip';
      button.dataset.active = String(state.activeTier === tierKey);
      if (tierKey === 'all') {
        button.textContent = 'Show all';
      } else {
        button.innerHTML = `<span style="width:10px;height:10px;border-radius:50%;background:${tierColor[tierKey]};display:inline-block"></span>${tierLabels[tierKey]}`;
      }
      button.addEventListener('click', () => {
        if (state.activeTier === tierKey) return;
        applyState({ activeTier: tierKey });
      });
      tierRow.appendChild(button);
    });
    filters.appendChild(tierRow);

    if (state.segments.length) {
      const legend = doc.createElement('div');
      legend.className = 'legend';
      state.segments.forEach(segment => {
        const item = doc.createElement('div');
        item.className = 'legend-row';
        const swatch = doc.createElement('span');
        swatch.className = 'legend-swatch';
        swatch.style.background = segment.color;
        item.appendChild(swatch);
        const text = doc.createElement('span');
        text.textContent = segment.label;
        item.appendChild(text);
        legend.appendChild(item);
      });
      filters.appendChild(legend);
    }
  }

  function createTeamSelect(key, value) {
    const select = doc.createElement('select');
    select.id = key;
    const options = getTeamsForScope();
    if (!options.length) {
      select.disabled = true;
      return select;
    }
    options.forEach(team => {
      const option = doc.createElement('option');
      option.value = team.id;
      const conference = team.conference?.shortName ? ` (${team.conference.shortName})` : '';
      option.textContent = `${team.name}${conference}`;
      select.appendChild(option);
    });
    if (value && options.some(team => team.id === value)) {
      select.value = value;
    } else {
      select.value = options[0].id;
    }
    select.addEventListener('change', event => {
      const target = event.target;
      const selectedValue = target.value || null;
      const patch = {};
      patch[key] = selectedValue;
      applyState(patch);
    });
    return select;
  }

  function renderTimeline() {
    if (!timeline) return;
    timeline.innerHTML = '';
    if (state.loading) {
      timeline.appendChild(createEmptyState('Loading timeline…'));
      return;
    }
    if (state.error) {
      timeline.appendChild(createEmptyState(`Unable to load timeline: ${state.error}`));
      return;
    }
    // DEBUG: Log segments before rendering
    console.debug('[TimelineApp] renderTimeline: state.segments', state.segments);
    if (!state.segments.length) {
      const message =
        !state.startTeam || !state.endTeam
          ? 'Select two programs to generate the timeline.'
          : state.startTeam === state.endTeam
            ? 'Select two different programs to generate a leverage path.'
            : 'No leverage-connected games remain between these programs.';
      timeline.appendChild(createEmptyState(message));
      return;
    }

    const games = flattenTimeline(state.segments);
    const filtered = games.filter(game => {
      if (state.activeTier === 'all') return true;
      return determineTier(game.leverage) === state.activeTier;
    });

    if (!filtered.length) {
      timeline.appendChild(
        createEmptyState(
          'No matchups hit that leverage band on this path. Try broadening the filter.'
        )
      );
      return;
    }

    const groups = {};
    for (const game of filtered) {
      const key = game.date ? game.date.slice(0, 10) : 'TBD';
      if (!groups[key]) groups[key] = [];
      groups[key].push(game);
    }

    Object.entries(groups)
      .sort((a, b) => compareDateKeys(a[0], b[0]))
      .forEach(([dateKey, gamesOnDate]) => {
        const item = doc.createElement('article');
        item.className = 'timeline-item';

        const dateLabel = doc.createElement('h3');
        dateLabel.className = 'timeline-date';
        const tierSet = new Set(gamesOnDate.map(game => tierLabels[determineTier(game.leverage)]));
        const tierText = Array.from(tierSet).join(' • ');
        dateLabel.innerHTML = `${formatDateGroup(dateKey)} <span>${tierText}</span>`;
        item.appendChild(dateLabel);

        gamesOnDate
          .sort((a, b) => (b.leverage ?? 0) - (a.leverage ?? 0))
          .forEach(game => {
            const card = doc.createElement('div');
            card.className = 'matchup-card';
            card.style.borderColor = `${game.color}33`;
            card.style.boxShadow = `0 0 0 1px ${game.color}1f`;

            const head = doc.createElement('div');
            head.className = 'matchup-head';

            const title = doc.createElement('strong');
            title.textContent = `${game.homeTeam?.name ?? 'Home'} vs ${game.awayTeam?.name ?? 'Away'}`;

            const detailRow = doc.createElement('div');
            detailRow.style.display = 'flex';
            detailRow.style.alignItems = 'center';
            detailRow.style.flexWrap = 'wrap';
            detailRow.style.gap = '10px';

            const segmentTag = doc.createElement('span');
            segmentTag.className = 'segment-tag';
            segmentTag.style.borderColor = `${game.color}55`;
            segmentTag.style.background = `${game.color}22`;
            segmentTag.innerHTML = `<span>Edge</span>${game.segmentLabel}`;

            const timestamp = doc.createElement('span');
            timestamp.className = 'timestamp';
            timestamp.textContent = formatDateTime(game.date);

            detailRow.append(segmentTag, timestamp);
            head.append(title, detailRow);

            const meta = doc.createElement('div');
            meta.className = 'meta';
            const homeConf = game.homeTeam?.conference?.shortName ?? '—';
            const awayConf = game.awayTeam?.conference?.shortName ?? '—';
            meta.innerHTML = `
              <span><strong>Conference</strong> ${homeConf} • ${awayConf}</span>
              <span><strong>Week</strong> ${game.week ?? 'TBD'}</span>
              <span><strong>Type</strong> ${formatGameType(game.type)}</span>
              <span><strong>Leverage</strong> ${formatLeverage(game.leverage)}</span>
            `;

            const details = doc.createElement('details');
            const summary = doc.createElement('summary');
            summary.textContent = 'Edge factors';
            details.appendChild(summary);

            const list = doc.createElement('ul');
            buildFactorBullets(game).forEach(factor => {
              const li = doc.createElement('li');
              li.textContent = factor;
              list.appendChild(li);
            });
            details.appendChild(list);

            card.append(head, meta, details);
            item.appendChild(card);
          });

        timeline.appendChild(item);
      });
  }

  function renderNetworkPanel() {
    if (!networkPanel) return;
    if (state.loading) {
      if (networkControls) networkControls.innerHTML = '';
      if (networkFocus) networkFocus.innerHTML = '';
      if (networkLegend) networkLegend.innerHTML = '';
      if (networkEmpty) {
        networkEmpty.hidden = false;
        networkEmpty.textContent = 'Loading matchup network…';
      }
      updateNetworkSummary();
      return;
    }
    if (state.error) {
      if (networkControls) networkControls.innerHTML = '';
      if (networkFocus) networkFocus.innerHTML = '';
      if (networkLegend) networkLegend.innerHTML = '';
      if (networkEmpty) {
        networkEmpty.hidden = false;
        networkEmpty.textContent = `Unable to load network: ${state.error}`;
      }
      if (graphState.cy) {
        graphState.cy.elements().remove();
      }
      updateNetworkSummary();
      return;
    }
    if (!state.data) return;

    if (networkEmpty) {
      networkEmpty.hidden = true;
    }

    updateGraphView();

    if (networkControls) {
      networkControls.innerHTML = '';
      const typeLabel = doc.createElement('label');
      typeLabel.textContent = 'Game filter';
      const typeSelect = doc.createElement('select');
      GRAPH_TYPES.forEach(option => {
        const opt = doc.createElement('option');
        opt.value = option.id;
        opt.textContent = option.label;
        typeSelect.appendChild(opt);
      });
      typeSelect.value = state.graphType;
      typeSelect.addEventListener('change', event => {
        const next = event.target.value;
        applyState({ graphType: next });
      });

      const conferenceLabel = doc.createElement('label');
      conferenceLabel.textContent = 'Conference';
      const conferenceSelect = doc.createElement('select');
      const conferenceOptions = [
        { id: 'all', label: 'All conferences' },
        ...state.data.conferences
          .slice()
          .sort((a, b) => a.name.localeCompare(b.name))
          .map(conf => ({
            id: conf.id,
            label: conf.name,
          })),
      ];
      conferenceOptions.forEach(conf => {
        const opt = doc.createElement('option');
        opt.value = conf.id;
        opt.textContent = conf.label;
        conferenceSelect.appendChild(opt);
      });
      conferenceSelect.value = state.graphConference;
      conferenceSelect.addEventListener('change', event => {
        const next = event.target.value || 'all';
        applyState({ graphConference: next });
      });

      const isolateButton = doc.createElement('button');
      isolateButton.type = 'button';
      isolateButton.dataset.active = String(!state.graphShowIsolated);
      isolateButton.setAttribute('aria-pressed', String(state.graphShowIsolated));
      isolateButton.textContent = state.graphShowIsolated
        ? 'Hide isolated programs'
        : 'Show isolated programs';
      isolateButton.addEventListener('click', () => {
        applyState({ graphShowIsolated: !state.graphShowIsolated });
      });

      networkControls.append(typeLabel, typeSelect, conferenceLabel, conferenceSelect, isolateButton);
    }

    if (networkFocus) {
      networkFocus.innerHTML = '';

      const focusLabel = doc.createElement('label');
      focusLabel.textContent = 'Focus team';

      const focusSelect = doc.createElement('select');
      focusSelect.style.minWidth = '220px';
      const emptyOption = doc.createElement('option');
      emptyOption.value = '';
      emptyOption.textContent = 'Select team';
      focusSelect.appendChild(emptyOption);
      state.data.teams
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .forEach(team => {
          const option = doc.createElement('option');
          option.value = team.id;
          const conf = team.conference?.shortName ? ` (${team.conference.shortName})` : '';
          option.textContent = `${team.name}${conf}`;
          focusSelect.appendChild(option);
        });
      const selectedFocus = state.focusSelection ?? state.focusTeam ?? '';
      focusSelect.value = selectedFocus ?? '';
      focusSelect.addEventListener('change', event => {
        const value = event.target.value || null;
        applyState({ focusSelection: value });
      });

      const degreeLabel = doc.createElement('label');
      degreeLabel.textContent = 'Degrees';
      const degreeInput = doc.createElement('input');
      degreeInput.type = 'number';
      degreeInput.min = '1';
      degreeInput.max = '6';
      degreeInput.value = String(state.focusDegrees);
      degreeInput.addEventListener('change', event => {
        const raw = Number(event.target.value);
        const clamped = Number.isFinite(raw) ? Math.max(1, Math.min(6, raw)) : 1;
        event.target.value = String(clamped);
        if (clamped !== state.focusDegrees) {
          applyState({ focusDegrees: clamped });
        }
      });

      const focusButton = doc.createElement('button');
      focusButton.type = 'button';
      focusButton.textContent = 'Focus';
      const focusCandidate = state.focusSelection ?? state.focusTeam;
      focusButton.disabled = !focusCandidate;
      focusButton.addEventListener('click', () => {
        const targetTeam = state.focusSelection ?? state.focusTeam;
        applyState({ focusTeam: targetTeam ?? null });
      });

      const resetButton = doc.createElement('button');
      resetButton.type = 'button';
      resetButton.textContent = 'Reset focus';
      resetButton.disabled = !state.focusTeam;
      resetButton.addEventListener('click', () => {
        applyState({ focusTeam: null });
      });

      networkFocus.append(
        focusLabel,
        focusSelect,
        degreeLabel,
        degreeInput,
        focusButton,
        resetButton
      );
    }
  }

  function ensureGraphInstance() {
    if (graphState.cy) return graphState.cy;
    if (!networkGraphContainer) return null;
    const cytoscapeFactory =
      typeof options.cytoscape === 'function' ? options.cytoscape : win.cytoscape;
    if (typeof cytoscapeFactory !== 'function') return null;
    graphState.cy = cytoscapeFactory({
      container: networkGraphContainer,
      elements: [],
      wheelSensitivity: 0.2,
      style: [
        {
          selector: 'node',
          style: {
            'background-color': 'data(color)',
            width: 'mapData(sizeFactor, 0, 1, 18, 38)',
            height: 'mapData(sizeFactor, 0, 1, 18, 38)',
            label: 'data(label)',
            color: '#dfe7ff',
            'font-size': 'mapData(sizeFactor, 0, 1, 10, 18)',
            'text-wrap': 'wrap',
            'text-max-width': '80px',
            'text-halign': 'center',
            'text-valign': 'center',
            'text-outline-color': '#050a1c',
            'text-outline-width': 2,
            'overlay-opacity': 0,
          },
        },
        { selector: 'node[primary="false"]', style: { opacity: 0.72 } },
        {
          selector: 'node.focused',
          style: {
            'border-width': 3,
            'border-color': '#facc15',
            'text-outline-color': '#0b1020',
            'text-outline-width': 3,
            opacity: 1,
          },
        },
        {
          selector: 'node.focus-root',
          style: {
            'border-width': 5,
            'border-color': '#38bdf8',
          },
        },
        { selector: 'node.dimmed', style: { opacity: 0.18 } },
        {
          selector: 'edge',
          style: {
            'curve-style': 'haystack',
            'haystack-radius': 0.5,
            opacity: 0.55,
            'line-color': 'data(color)',
            width: 'mapData(leverage, 0.4, 1.6, 1, 6)',
          },
        },
        {
          selector: 'edge.focus-edge',
          style: {
            opacity: 0.95,
            'line-color': '#7dd3fc',
            width: 4,
          },
        },
        { selector: 'edge.dimmed', style: { opacity: 0.12 } },
      ],
    });
    if (graphState.cy) {
      graphState.cy.on('tap', 'node', event => {
        const id = event.target.id();
        applyState({ focusSelection: id });
      });
    }
    return graphState.cy;
  }

  function buildGraphViewModel() {
    if (!state.data) {
      return { nodes: [], edges: [], adjacency: new Map(), hiddenIsolates: 0, candidates: 0 };
    }

    const edges = [];
    const adjacency = new Map();
    const visibleNodeIds = new Set();
    const degreeMap = new Map();
    const typeFilter = state.graphType;
    const activeTier = state.activeTier;

    for (const entry of state.data.edgesByPair.values()) {
      const [teamAId, teamBId] = entry.teams;
      const teamA = state.data.teamMap.get(teamAId);
      const teamB = state.data.teamMap.get(teamBId);
      if (!teamA || !teamB) continue;

      let games = entry.games.filter(game => game.result === 'TBD');
      if (!games.length) continue;

      if (typeFilter !== 'ALL') {
        games = games.filter(game => game.type === typeFilter);
        if (!games.length) continue;
      }

      if (activeTier !== 'all') {
        games = games.filter(game => determineTier(game.leverage) === activeTier);
        if (!games.length) continue;
      }

      const bestGame = games[0];

      const includeEdge =
        state.graphConference === 'all' ||
        teamA.conferenceId === state.graphConference ||
        teamB.conferenceId === state.graphConference;
      if (!includeEdge) continue;

      const sameConference = teamA.conferenceId && teamA.conferenceId === teamB.conferenceId;
      const edgeColor = sameConference
        ? colorForConference(teamA.conferenceId)
        : '#6ba4ff';

      edges.push({
        data: {
          id: entry.key,
          source: teamAId,
          target: teamBId,
          leverage: bestGame.leverage ?? 0,
          color: edgeColor,
        },
      });

      visibleNodeIds.add(teamAId);
      visibleNodeIds.add(teamBId);

      degreeMap.set(teamAId, (degreeMap.get(teamAId) ?? 0) + 1);
      degreeMap.set(teamBId, (degreeMap.get(teamBId) ?? 0) + 1);

      if (!adjacency.has(teamAId)) adjacency.set(teamAId, []);
      if (!adjacency.has(teamBId)) adjacency.set(teamBId, []);
      adjacency.get(teamAId).push({ id: teamBId, edgeId: entry.key });
      adjacency.get(teamBId).push({ id: teamAId, edgeId: entry.key });
    }

    const candidates = state.data.teams.length;
    const nodes = [];
    const maxDegree = Array.from(degreeMap.values()).reduce(
      (max, value) => Math.max(max, value),
      0
    );

    state.data.teams.forEach(team => {
      const id = team.id;
      const isPrimary = state.graphConference === 'all' ? true : team.conferenceId === state.graphConference;
      const hasEdge = visibleNodeIds.has(id);
      if (!hasEdge && !state.graphShowIsolated) return;
      if (state.graphConference !== 'all' && !isPrimary && !hasEdge) return;
      const degree = degreeMap.get(id) ?? 0;
      const normalized = maxDegree ? 1 - Math.min(1, degree / maxDegree) : 1;
      nodes.push({
        data: {
          id,
          label: team.shortName ?? team.name,
          conferenceId: team.conferenceId ?? 'other',
          color: colorForConference(team.conferenceId),
          primary: String(isPrimary),
          degree,
          sizeFactor: normalized,
        },
      });
      if (!adjacency.has(id)) {
        adjacency.set(id, []);
      }
    });

    const hiddenIsolates = state.graphShowIsolated
      ? 0
      : state.data.teams.filter(team => {
          if (state.graphConference !== 'all' && team.conferenceId !== state.graphConference) {
            return false;
          }
          return !visibleNodeIds.has(team.id);
        }).length;

    return { nodes, edges, adjacency, hiddenIsolates, candidates };
  }

  function updateGraphView() {
    if (!networkGraphContainer) {
      updateNetworkSummary();
      return;
    }
    const { nodes, edges, adjacency, hiddenIsolates, candidates } = buildGraphViewModel();
    graphState.adjacency = adjacency;
    state.graphStats = {
      nodes: nodes.length,
      edges: edges.length,
      hiddenIsolates,
      candidates,
    };

    if (!nodes.length) {
      if (graphState.cy) {
        graphState.cy.elements().remove();
      }
      if (networkEmpty) {
        networkEmpty.hidden = false;
        networkEmpty.textContent = 'No qualifying matchups for the current filters.';
      }
      if (networkLegend) networkLegend.innerHTML = '';
      updateNetworkSummary();
      return;
    }

    if (networkEmpty) {
      networkEmpty.hidden = true;
    }

    updateNetworkLegendDisplay(nodes);

    const cy = ensureGraphInstance();
    if (!cy) {
      updateNetworkSummary();
      return;
    }

    cy.batch(() => {
      cy.elements().remove();
      cy.add([...nodes, ...edges]);
    });
    runDefaultLayout(cy);
    applyGraphFocus();
  }

  function runDefaultLayout(cy) {
    if (!cy) return;
    if (cy.nodes().length <= 1) {
      cy.fit(cy.nodes(), 80);
      return;
    }
    const layout = cy.layout({
      name: 'cose',
      animate: false,
      idealEdgeLength: 120,
      nodeRepulsion: 8000,
      nodeOverlap: 10,
      gravity: 0.9,
      fit: true,
      padding: 50,
    });
    layout.run();
    cy.fit(cy.elements(), 60);
  }

  function applyGraphFocus() {
    if (!graphState.cy) {
      updateNetworkSummary();
      return;
    }

    const cy = graphState.cy;
    cy.nodes().removeClass('focused dimmed focus-root');
    cy.edges().removeClass('focus-edge dimmed');

    if (!state.focusTeam) {
      updateNetworkSummary();
      return;
    }

    const focusNode = cy.getElementById(state.focusTeam);
    if (!focusNode || !focusNode.nonempty()) {
      const missing = state.focusTeam;
      state.focusTeam = null;
      if (state.focusSelection === missing) {
        state.focusSelection = null;
      }
      updateNetworkSummary();
      return;
    }

    const neighborhood = computeFocusNeighborhood(state.focusTeam, state.focusDegrees);
    const { nodes, edges } = neighborhood;
    if (!nodes.size) {
      updateNetworkSummary();
      return;
    }

    nodes.forEach(id => {
      const node = cy.getElementById(id);
      if (node && node.nonempty()) {
        node.addClass('focused');
      }
    });
    focusNode.addClass('focus-root');
    cy.nodes().forEach(node => {
      if (!nodes.has(node.id())) {
        node.addClass('dimmed');
      }
    });

    cy.edges().forEach(edge => {
      if (edges.has(edge.id())) {
        edge.addClass('focus-edge');
      } else {
        edge.addClass('dimmed');
      }
    });

    const focusElements = cy.collection();
    nodes.forEach(id => {
      const node = cy.getElementById(id);
      if (node && node.nonempty()) {
        focusElements.merge(node);
      }
    });
    cy.edges().forEach(edge => {
      if (edges.has(edge.id())) {
        focusElements.merge(edge);
      }
    });

    if (focusElements.length) {
      const layout = focusElements.layout({
        name: 'breadthfirst',
        circle: true,
        spacingFactor: 1.18,
        roots: `#${state.focusTeam}`,
        animate: false,
      });
      layout.run();
      cy.fit(focusElements, 70);
    }

    updateNetworkSummary({ nodes: nodes.size, edges: edges.size });
  }

  function computeFocusNeighborhood(rootId, degrees) {
    const resultNodes = new Set();
    const resultEdges = new Set();
    if (!graphState.adjacency.size) {
      resultNodes.add(rootId);
      return { nodes: resultNodes, edges: resultEdges };
    }

    const visited = new Set([rootId]);
    resultNodes.add(rootId);
    const queue = [{ id: rootId, depth: 0 }];
    while (queue.length) {
      const current = queue.shift();
      const neighbors = graphState.adjacency.get(current.id) ?? [];
      for (const neighbor of neighbors) {
        if (current.depth >= degrees) continue;
        resultEdges.add(neighbor.edgeId);
        if (!visited.has(neighbor.id)) {
          visited.add(neighbor.id);
          resultNodes.add(neighbor.id);
          queue.push({ id: neighbor.id, depth: current.depth + 1 });
        }
      }
    }
    return { nodes: resultNodes, edges: resultEdges };
  }

  function updateNetworkLegendDisplay(nodes) {
    if (!networkLegend) return;
    networkLegend.innerHTML = '';
    if (!nodes.length) return;
    const seen = new Map();
    nodes.forEach(node => {
      const confId = node.data.conferenceId ?? 'other';
      if (seen.has(confId)) return;
      const confEntry = state.data?.conferenceMap?.get(confId);
      const label = confEntry?.name ?? (confId === 'ind' ? 'Independents' : 'Unaffiliated');
      seen.set(confId, { label, color: colorForConference(confId) });
    });
    Array.from(seen.entries())
      .map(([id, value]) => ({ id, ...value }))
      .sort((a, b) => a.label.localeCompare(b.label))
      .forEach(entry => {
        const wrapper = doc.createElement('span');
        const dot = doc.createElement('span');
        dot.className = 'legend-dot';
        dot.style.background = entry.color;
        wrapper.appendChild(dot);
        const text = doc.createElement('span');
        text.textContent = entry.label;
        wrapper.appendChild(text);
        networkLegend.appendChild(wrapper);
      });
  }

  function updateNetworkSummary(focusStats) {
    if (!networkSummary) return;
    if (state.loading) {
      networkSummary.textContent = 'Loading matchup network…';
      return;
    }
    if (state.error) {
      networkSummary.textContent = `Unable to load network: ${state.error}`;
      return;
    }
    if (!state.data) {
      networkSummary.textContent = '';
      return;
    }
    const { nodes, edges, hiddenIsolates } = state.graphStats;
    if (!nodes) {
      networkSummary.textContent = 'No qualifying matchups for the current filters.';
      return;
    }
    let message = `Showing ${nodes} ${nodes === 1 ? 'program' : 'programs'} connected by ${edges} ${
      edges === 1 ? 'matchup' : 'matchups'
    }.`;
    if (!state.graphShowIsolated && hiddenIsolates > 0) {
      message += ` ${hiddenIsolates} isolated programs hidden.`;
    }
    if (focusStats && state.focusTeam) {
      message += ` Focus: ${focusStats.nodes} program${focusStats.nodes === 1 ? '' : 's'} within ${
        state.focusDegrees
      } hop${state.focusDegrees === 1 ? '' : 's'} (${focusStats.edges} edge${
        focusStats.edges === 1 ? '' : 's'
      }).`;
    }
    networkSummary.textContent = message;
  }

  function flattenTimeline(segments) {
    return segments.flatMap(segment =>
      segment.games.map(game => ({
        ...game,
        color: segment.color,
        segmentLabel: segment.label,
      }))
    );
  }

  function buildFactorBullets(game) {
    const bullets = [];
    const homeName = game.homeTeam?.name ?? 'Home team';
    const awayName = game.awayTeam?.name ?? 'Away team';
    const homeWeight =
      typeof game.rankWeightHome === 'number' ? game.rankWeightHome.toFixed(3) : '—';
    const awayWeight =
      typeof game.rankWeightAway === 'number' ? game.rankWeightAway.toFixed(3) : '—';
    if (game.leverage !== undefined) {
      bullets.push(
        `Leverage ${formatLeverage(game.leverage)} blends ${homeName}'s ${homeWeight} weight with ${awayName}'s ${awayWeight}.`
      );
    }
    if (game.bridgeBoost > 1) {
      bullets.push('Cross-conference bridge applies a 1.20× multiplier to connect the leagues.');
    } else {
      bullets.push('Same-conference tilt keeps the bridge multiplier at 1.00×.');
    }
    if (game.timingBoost > 1) {
      bullets.push(
        `${formatPhase(game.phase)} timing and week ${game.week ?? 'TBD'} push the urgency to ${game.timingBoost.toFixed(2)}×.`
      );
    } else {
      bullets.push(
        `Timing multiplier stays at ${game.timingBoost.toFixed(2)}× for week ${game.week ?? 'TBD'}.`
      );
    }
    if (game.type === 'CHAMPIONSHIP' || game.type === 'PLAYOFF' || game.type === 'BOWL') {
      bullets.push(
        `${formatGameType(game.type)} stakes heighten committee comparisons across the chain.`
      );
    }
    return bullets;
  }

  function formatLeverage(value) {
    return typeof value === 'number' && !Number.isNaN(value) ? value.toFixed(3) : '—';
  }

  function formatDateGroup(key) {
    if (key === 'TBD') return 'Date TBD';
    const date = new Date(`${key}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) return 'Date TBD';
    return date.toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }

  function formatDateTime(iso) {
    if (!iso) return 'Time TBD';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return 'Time TBD';
    return date.toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    });
  }

  function formatGameType(type) {
    if (!type) return 'Scheduled';
    const map = {
      NON_CONFERENCE: 'Non-conference',
      CONFERENCE: 'Conference',
      CHAMPIONSHIP: 'Conference championship',
      PLAYOFF: 'Playoff',
      BOWL: 'Bowl',
    };
    if (map[type]) return map[type];
    return type
      .toLowerCase()
      .split('_')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  function formatPhase(phase) {
    if (!phase) return 'Season';
    switch (phase) {
      case 'REGULAR':
        return 'Regular season';
      case 'POSTSEASON':
        return 'Postseason';
      default:
        return phase
          .toLowerCase()
          .split('_')
          .map(part => part.charAt(0).toUpperCase() + part.slice(1))
          .join(' ');
    }
  }

  function compareDateKeys(a, b) {
    if (a === b) return 0;
    if (a === 'TBD') return 1;
    if (b === 'TBD') return -1;
    return new Date(`${a}T00:00:00Z`) - new Date(`${b}T00:00:00Z`);
  }

  function createEmptyState(message) {
    const div = doc.createElement('div');
    div.className = 'empty-state';
    div.textContent = message;
    return div;
  }

  function renderFileModeNotice() {
    if (!doc?.body) return;
    doc.body.classList.add('file-mode');
    doc.body.innerHTML = '';
    const wrapper = doc.createElement('div');
    wrapper.className = 'file-overlay';

    const heading = doc.createElement('h2');
    heading.textContent = 'Serve this timeline';
    const copy = doc.createElement('p');
    copy.innerHTML =
      'The interactive matchup explorer needs to load schedule data over HTTP. Start the local server with <code>npm run web:serve</code> from the repository root, then open the page from that address.';

    const hint = doc.createElement('p');
    hint.innerHTML = 'Once the server is running, use this link to launch the full experience:';

    const link = doc.createElement('a');
    link.href = 'http://localhost:4173/web/matchup-timeline.html';
    link.textContent = 'Open http://localhost:4173/web/matchup-timeline.html';

    wrapper.append(heading, copy, hint, link);
    doc.body.appendChild(wrapper);
  }

  function chooseFallbackTeam(list, excludeId) {
    if (!list.length) return null;
    const fallback = list.find(team => team.id !== excludeId);
    return (fallback ?? list[0]).id;
  }

  return {
    state,
    applyState,
    updatePath,
    ready,
    init,
  };
}

async function defaultLoadData(fetchImpl, dataBase) {
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

function prepareSeasonModel(raw, season) {
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

function buildEdgeMap(games) {
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

function edgeKey(a, b) {
  return a < b ? `${a}__${b}` : `${b}__${a}`;
}

function buildAdjacency(edgeMap) {
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

function addNeighbor(adjacency, from, edge) {
  if (!adjacency.has(from)) {
    adjacency.set(from, []);
  }
  adjacency.get(from).push(edge);
}

function findShortestPath(adjacency, start, end) {
  if (!adjacency.has(start) || !adjacency.has(end)) return null;
  const dist = new Map([[start, 0]]);
  const prev = new Map();
  const queue = [{ node: start, distance: 0 }];

  while (queue.length) {
    queue.sort((a, b) => a.distance - b.distance);
    const current = queue.shift();
    if (!current) break;
    if (current.node === end) break;
    const neighbors = adjacency.get(current.node) ?? [];
    for (const edge of neighbors) {
      const nextDistance = current.distance + edge.weight;
      if (nextDistance < (dist.get(edge.to) ?? Number.POSITIVE_INFINITY)) {
        dist.set(edge.to, nextDistance);
        prev.set(edge.to, { node: current.node, edge });
        queue.push({ node: edge.to, distance: nextDistance });
      }
    }
  }

  if (!dist.has(end)) return null;

  const nodes = [];
  const edges = [];
  let cursor = end;
  while (cursor !== undefined) {
    nodes.push(cursor);
    const prevEntry = prev.get(cursor);
    if (!prevEntry) break;
    edges.push({
      from: prevEntry.node,
      to: cursor,
      key: prevEntry.edge.key,
      weight: prevEntry.edge.weight,
      bestGame: prevEntry.edge.best,
    });
    cursor = prevEntry.node;
  }
  nodes.reverse();
  edges.reverse();
  return { nodes, edges, distance: dist.get(end) ?? null };
}

export default createTimelineApp;
export { createTimelineApp };
