/**
 * UI Rendering functions for the FBS Timeline App
 */
import { tierLabels, tierColor, conferenceScopes, determineTier, conferenceMap } from './config.js';
import {
  formatLeverage,
  formatDateTime,
  formatGameType,
  formatPhase,
  formatDateGroup,
  compareDateKeys,
} from './formatters.js';

export function createUIRenderer(doc) {
  function createEmptyState(message) {
    const div = doc.createElement('div');
    div.className = 'empty-state';
    div.textContent = message;
    return div;
  }

  function renderSummary(state, pathSummary) {
    if (!pathSummary) return;
    pathSummary.replaceChildren();

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
      // Group by conference, get full name, sort alphabetically
      let legendEntries = state.segments.map(segment => {
        // Try to extract conferenceId from segment label or data
        let confId = segment.from?.conferenceId || segment.to?.conferenceId || null;
        let confInfo = confId && conferenceMap[confId] ? conferenceMap[confId] : null;
        let confLabel = confInfo ? `${confInfo.name} (${confInfo.shortName})` : segment.label;
        return {
          color: segment.color,
          label: confLabel,
          confName: confInfo ? confInfo.name : segment.label,
        };
      });
      legendEntries = legendEntries.sort((a, b) => a.confName.localeCompare(b.confName));
      legendEntries.forEach(entry => {
        const item = doc.createElement('div');
        item.className = 'legend-row';
        const swatch = doc.createElement('span');
        swatch.className = 'legend-swatch';
        swatch.style.background = entry.color;
        item.appendChild(swatch);
        const text = doc.createElement('span');
        text.textContent = entry.label;
        item.appendChild(text);
        legend.appendChild(item);
      });
      pathSummary.appendChild(legend);
    }
  }

  function renderFilters(state, filters, getTeamsForScope, applyState) {
    if (!filters) return;
    filters.replaceChildren();

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
    const startSelect = createTeamSelect(
      'startTeam',
      state.startTeam,
      getTeamsForScope,
      applyState
    );
    startControl.append(startLabel, startSelect);

    const endControl = doc.createElement('div');
    endControl.className = 'control';
    const endLabel = doc.createElement('label');
    endLabel.setAttribute('for', 'endTeam');
    endLabel.textContent = 'Destination program';
    const endSelect = createTeamSelect('endTeam', state.endTeam, getTeamsForScope, applyState);
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

  function createTeamSelect(key, value, getTeamsForScope, applyState) {
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

  function renderTimeline(state, timeline) {
    if (!timeline) return;
    timeline.replaceChildren();

    if (state.loading) {
      timeline.appendChild(createEmptyState('Loading timeline…'));
      return;
    }
    if (state.error) {
      timeline.appendChild(createEmptyState(`Unable to load timeline: ${state.error}`));
      return;
    }
    if (!state.segments.length) {
      let message;
      if (!state.startTeam || !state.endTeam) {
        message = 'Select two programs to generate the timeline.';
      } else if (state.startTeam === state.endTeam) {
        message = 'Select two different programs to generate a leverage path.';
      } else {
        message = 'No leverage-connected games remain between these programs.';
      }
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
            const card = createMatchupCard(game);
            item.appendChild(card);
          });

        timeline.appendChild(item);
      });
  }

  function createMatchupCard(game) {
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
    return card;
  }

  function renderFileModeNotice() {
    if (!doc?.body) return;
    doc.body.classList.add('file-mode');
    doc.body.replaceChildren();
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
    link.href = './matchup-timeline.html';
    link.textContent = 'Open Matchup Timeline';

    wrapper.append(heading, copy, hint, link);
    doc.body.appendChild(wrapper);
  }

  return {
    renderSummary,
    renderFilters,
    renderTimeline,
    renderFileModeNotice,
  };
}

// Helper functions
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
  const homeWeight = typeof game.rankWeightHome === 'number' ? game.rankWeightHome.toFixed(3) : '—';
  const awayWeight = typeof game.rankWeightAway === 'number' ? game.rankWeightAway.toFixed(3) : '—';

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

function chooseFallbackTeam(list, excludeId) {
  if (!list.length) return null;
  const fallback = list.find(team => team.id !== excludeId);
  return (fallback ?? list[0]).id;
}
