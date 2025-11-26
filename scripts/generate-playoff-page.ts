import fs from 'node:fs';
import path from 'node:path';
import { createApolloServer } from '../src/server.js';

async function generate(season = 2025, limit = 12, gameLimit = 6, leverageThreshold = 0.75) {
  const server = createApolloServer();
  await server.start();

  const result = await server.executeOperation({
    query: `#graphql
      query PlayoffPreview($season: Int!, $limit: Int, $gameLimit: Int, $leverageThreshold: Float) {
        playoffPreview(season: $season, limit: $limit, gameLimit: $gameLimit, leverageThreshold: $leverageThreshold) {
          generatedAt
          season
          leverageThreshold
          remainingHighLeverageGames {
            id
            date
            leverage
            home { name }
            away { name }
          }
          contenders {
            team { name conference { shortName } }
            rank
            resumeScore
            leverageIndex
            nextGame { id date }
          }
        }
      }
    `,
    variables: { season, limit, gameLimit, leverageThreshold },
  });

  await server.stop();

  if (result.body.kind !== 'single') {
    throw new Error('Unexpected response body kind');
  }
  if (result.body.singleResult.errors?.length) {
    console.error('GraphQL errors:', result.body.singleResult.errors);
    process.exitCode = 1;
    return;
  }
  const data = result.body.singleResult.data?.playoffPreview;
  if (!data) {
    console.error('No playoffPreview data returned');
    process.exitCode = 1;
    return;
  }
  // Load local data to support client-side filtering (weeks and poll snapshots)
  const DATA_DIR = path.join(process.cwd(), 'src', 'data');
  const teamSeasons: any[] = JSON.parse(
    fs.readFileSync(path.join(DATA_DIR, 'teamSeasons.json'), 'utf-8')
  );
  const teams: any[] = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'teams.json'), 'utf-8'));
  const polls: any[] = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'polls.json'), 'utf-8'));
  const conferences: any[] = JSON.parse(
    fs.readFileSync(path.join(DATA_DIR, 'conferences.json'), 'utf-8')
  );

  const outDir = path.join(process.cwd(), 'web');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const { playoffHtml, rankingsHtml } = renderHTML(data, {
    polls,
    teams,
    teamSeasons,
    conferences,
    dataDir: DATA_DIR,
  });
  fs.writeFileSync(path.join(outDir, 'playoff-preview.html'), playoffHtml, 'utf-8');
  fs.writeFileSync(path.join(outDir, 'rankings.html'), rankingsHtml, 'utf-8');
  console.log('Wrote web/playoff-preview.html');
  console.log('Wrote web/rankings.html');
}

// If the resolver returned fewer contenders than requested, attempt to
// supplement the list by reading the local data files and ranking team
// seasons by a resume score similar to the server logic.
async function supplementContendersIfNeeded(data: any, limit: number, season: number) {
  if ((data.contenders || []).length >= limit) return data;
  try {
    const DATA_DIR = path.join(process.cwd(), 'src', 'data');
    const teamSeasons: any[] = JSON.parse(
      fs.readFileSync(path.join(DATA_DIR, 'teamSeasons.json'), 'utf-8')
    );
    const teams: any[] = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'teams.json'), 'utf-8'));
    const conferences: any[] = JSON.parse(
      fs.readFileSync(path.join(DATA_DIR, 'conferences.json'), 'utf-8')
    );
    const polls: any[] = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'polls.json'), 'utf-8'));
    // lazy import of helper to build rank maps; prefer CFP -> COACHES -> AP
    const { buildLatestRankMap } = await import('../src/lib/score.js');

    let rankMap = buildLatestRankMap(polls, season, 'CFP');
    if (!rankMap || rankMap.size === 0) {
      rankMap = buildLatestRankMap(polls, season, 'COACHES');
    }
    if (!rankMap || rankMap.size === 0) {
      rankMap = buildLatestRankMap(polls, season, 'AP');
    }

    // normalize spPlus for fallback resume score
    const spVals = teamSeasons
      .filter(ts => ts.season === season && typeof ts.spPlus === 'number')
      .map(ts => ts.spPlus as number);
    const minSp = spVals.length ? Math.min(...spVals) : 0;
    const maxSp = spVals.length ? Math.max(...spVals) : 1;
    const span = Math.max(1e-6, maxSp - minSp);

    function normalizedSpPlus(spPlus?: number) {
      if (spPlus === undefined) return undefined;
      const clamped = Math.max(-10, Math.min(35, spPlus));
      return (clamped + 10) / 45;
    }
    function winPercentage(record?: any) {
      if (!record) return undefined;
      const total = record.wins + record.losses + record.ties;
      if (!total) return undefined;
      return (record.wins + record.ties * 0.5) / total;
    }
    function computeResumeScore(rank: number | undefined, ts?: any): number {
      let base: number | undefined;
      if (rank !== undefined) base = (26 - rank) / 25;
      if (base === undefined && ts) base = normalizedSpPlus(ts.spPlus);
      if (base === undefined) base = 0.45;
      const winPct = winPercentage(ts?.record);
      if (winPct !== undefined) base = base * 0.6 + winPct * 0.4;
      return Number(Math.max(0, Math.min(1, base)).toFixed(3));
    }

    const existingIds = new Set((data.contenders || []).map((c: any) => c.team?.name || c.teamId));
    const candidates = teamSeasons
      .filter(ts => ts.season === season)
      .map(ts => {
        const rank = rankMap.get(ts.id);
        const resume = computeResumeScore(rank, ts);
        const team = teams.find(t => t.id === ts.teamId);
        const conf = conferences.find(c => c.id === team?.conferenceId);
        return {
          teamName: team?.name ?? ts.teamId,
          conferenceShort: conf?.shortName ?? '',
          teamId: ts.teamId,
          rank,
          resume,
        };
      })
      .filter(c => !existingIds.has(c.teamName));

    candidates.sort((a, b) => {
      if (a.rank !== undefined && b.rank !== undefined) return a.rank - b.rank;
      if (a.rank !== undefined) return -1;
      if (b.rank !== undefined) return 1;
      return b.resume - a.resume;
    });

    for (const c of candidates) {
      if ((data.contenders || []).length >= limit) break;
      data.contenders.push({
        team: { name: c.teamName, conference: { shortName: c.conferenceShort } },
        rank: c.rank,
        resumeScore: c.resume,
        leverageIndex: c.resume,
        nextGame: null,
      });
    }
    return data;
  } catch (err) {
    // if anything goes wrong, return original data
    return data;
  }
}

function renderHTML(
  data: any,
  ctx: { polls: any[]; teams: any[]; teamSeasons: any[]; conferences: any[]; dataDir: string }
) {
  // Prefer grouping by the existing `week` field on Game, falling back to ISO week-start from the date.
  const games = (data.remainingHighLeverageGames || []).map((g: any) => ({
    ...g,
    dateObj: g.date ? new Date(g.date) : undefined,
    week: g.week,
  }));

  // Load all games from local data to expand beyond high-leverage games
  const allGames: any[] = JSON.parse(
    fs.readFileSync(path.join(ctx.dataDir, 'games.json'), 'utf-8')
  );

  // Build poll -> week -> rank -> teamSeasonId map for client-side filtering
  const pollsData = ctx.polls || [];
  const pollTypes = ['CFP', 'COACHES', 'AP'];
  // Structure: ranksByPollWeek[poll][week][rank] = teamSeasonId
  const ranksByPollWeek: Record<string, Record<string, Record<string, string>>> = {};
  for (const pt of pollTypes) ranksByPollWeek[pt] = {};
  for (const p of pollsData) {
    const poll = (p.poll || '').toString();
    if (!pollTypes.includes(poll)) continue;
    const week = typeof p.week === 'number' ? String(p.week) : 'unknown';
    ranksByPollWeek[poll][week] = ranksByPollWeek[poll][week] || {};
    if (p.teamSeasonId && typeof p.rank === 'number')
      ranksByPollWeek[poll][week][String(p.rank)] = String(p.teamSeasonId);
  }

  // Build set of FBS teamSeason IDs for the season so we can prune non-FBS entries
  // Build mapping teamName -> teamSeasonId for the season using teams + teamSeasons
  const teamNameToSeasonId: Record<string, string> = {};
  const season = data.season;
  // Build set of FBS teamSeason IDs for the season so we can prune non-FBS entries
  const fbsTeamSeasonIds = new Set<string>();
  // Determine which teams are FBS by looking up each team's conference
  const conferences = ctx.conferences || [];
  const fbsTeamIds = new Set<string>();
  for (const t of ctx.teams || []) {
    const conf = conferences.find((c: any) => c.id === t.conferenceId);
    if (conf && String(conf.division).toUpperCase() === 'FBS') fbsTeamIds.add(t.id);
  }
  // Populate teamNameToSeasonId only for FBS teamSeasons
  for (const ts of ctx.teamSeasons || []) {
    if (ts.season !== season) continue;
    if (!fbsTeamIds.has(ts.teamId)) continue;
    const team = (ctx.teams || []).find((t: any) => t.id === ts.teamId);
    if (team && team.name) teamNameToSeasonId[team.name] = ts.id;
    fbsTeamSeasonIds.add(ts.id);
  }

  // Prune ranksByPollWeek to only include FBS teamSeasonIds. Also remove empty ranks/weeks.
  for (const poll of Object.keys(ranksByPollWeek)) {
    const weeks = Object.keys(ranksByPollWeek[poll] || {});
    for (const w of weeks) {
      const rankMap = ranksByPollWeek[poll][w] || {};
      for (const rk of Object.keys(rankMap)) {
        const tsid = rankMap[rk];
        if (!fbsTeamSeasonIds.has(tsid)) {
          delete rankMap[rk];
        }
      }
      // if rankMap is now empty, remove the week
      if (Object.keys(rankMap).length === 0) delete ranksByPollWeek[poll][w];
    }
    // if poll has no weeks left, ensure it's an empty object
    if (Object.keys(ranksByPollWeek[poll]).length === 0) ranksByPollWeek[poll] = {};
  }

  function weekStartIso(d: Date) {
    const dt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const day = dt.getUTCDay();
    const diff = (day + 6) % 7; // days since Monday
    dt.setUTCDate(dt.getUTCDate() - diff);
    dt.setUTCHours(0, 0, 0, 0);
    return dt.toISOString().slice(0, 10);
  }

  // Find latest poll week across all polls to get current top 25
  let latestTop25 = new Set<string>();
  for (const poll of ['CFP', 'COACHES', 'AP']) {
    const pollWeeks = ranksByPollWeek[poll];
    if (!pollWeeks) continue;
    const numericWeeks = Object.keys(pollWeeks)
      .filter(w => w !== 'unknown')
      .map(Number)
      .sort((a, b) => b - a);
    if (numericWeeks.length === 0) continue;
    const latestWeek = String(numericWeeks[0]);
    const rankMap = pollWeeks[latestWeek];
    if (rankMap) {
      // Get all teams ranked 1-25
      for (let rank = 1; rank <= 25; rank++) {
        const teamSeasonId = rankMap[String(rank)];
        if (teamSeasonId) latestTop25.add(teamSeasonId);
      }
      break; // Use first available poll's top 25
    }
  }

  // Filter games to those involving top 25 teams and still in the future
  const now = new Date();

  // Create a map of game IDs to leverage scores from high-leverage games
  const leverageMap = new Map<string, number>();
  for (const g of games) {
    if (g.id && typeof g.leverage === 'number') {
      leverageMap.set(g.id, g.leverage);
    }
  }

  // Build reverse map from teamSeasonId to CFP rank
  const cfpRankMap = new Map<string, number>();
  const cfpPollOrder = ['CFP', 'COACHES', 'AP'];
  for (const pollType of cfpPollOrder) {
    const pollWeeks = ranksByPollWeek[pollType];
    if (!pollWeeks || Object.keys(pollWeeks).length === 0) continue;
    const numericWeeks = Object.keys(pollWeeks)
      .filter(w => w !== 'unknown')
      .map(Number)
      .sort((a, b) => b - a);
    if (numericWeeks.length === 0) continue;
    const latestWeek = String(numericWeeks[0]);
    const rankMap = pollWeeks[latestWeek];
    if (rankMap) {
      for (const [rank, teamSeasonId] of Object.entries(rankMap)) {
        cfpRankMap.set(teamSeasonId as string, Number(rank));
      }
      break; // Use first available poll
    }
  }

  const upcomingTop25Games = allGames
    .filter(g => {
      if (g.season !== season) return false;
      if (g.result && g.result !== 'TBD') return false; // Game already played
      const gameDate = g.date ? new Date(g.date) : null;
      if (gameDate && gameDate < now) return false; // Game in the past
      const homeTeamSeasonId = `${g.homeTeamId}-${season}`;
      const awayTeamSeasonId = `${g.awayTeamId}-${season}`;
      return latestTop25.has(homeTeamSeasonId) || latestTop25.has(awayTeamSeasonId);
    })
    .map(g => ({
      ...g,
      dateObj: g.date ? new Date(g.date) : undefined,
      leverage: leverageMap.get(g.id), // Add leverage if available
      home: {
        name: (ctx.teams || []).find((t: any) => t.id === g.homeTeamId)?.name || g.homeTeamId,
        seasonId: `${g.homeTeamId}-${season}`,
        cfpRank: cfpRankMap.get(`${g.homeTeamId}-${season}`),
      },
      away: {
        name: (ctx.teams || []).find((t: any) => t.id === g.awayTeamId)?.name || g.awayTeamId,
        seasonId: `${g.awayTeamId}-${season}`,
        cfpRank: cfpRankMap.get(`${g.awayTeamId}-${season}`),
      },
    }));

  const gamesByWeek: Record<string, any[]> = {};
  for (const g of upcomingTop25Games) {
    const weekLabel =
      typeof g.week === 'number'
        ? `Week ${g.week}`
        : g.dateObj
          ? `Week of ${weekStartIso(g.dateObj)}`
          : 'Unscheduled';
    if (!gamesByWeek[weekLabel]) gamesByWeek[weekLabel] = [];
    gamesByWeek[weekLabel].push(g);
  }

  // Sort weeks naturally: try numeric week numbers first, then ISO dates, then others
  const sortedWeeks = Object.keys(gamesByWeek).sort((a, b) => {
    const numA = a.match(/^Week (\d+)$/)?.[1];
    const numB = b.match(/^Week (\d+)$/)?.[1];
    if (numA && numB) return Number(numA) - Number(numB);
    if (numA) return -1;
    if (numB) return 1;
    // compare ISO date strings if present
    const dateA = a.match(/^Week of (\d{4}-\d{2}-\d{2})$/)?.[1];
    const dateB = b.match(/^Week of (\d{4}-\d{2}-\d{2})$/)?.[1];
    if (dateA && dateB) return dateA.localeCompare(dateB);
    return a.localeCompare(b);
  });

  // Filter weeks to only include those with at least one future game
  const filteredWeeks = sortedWeeks.filter(week => {
    const weekGames = gamesByWeek[week];
    return weekGames.some(g => {
      const gameDate = g.dateObj;
      return !gameDate || gameDate >= now;
    });
  });

  const gamesHtml = filteredWeeks
    .map(week => {
      const rows = gamesByWeek[week]
        .sort((a, b) => {
          // Sort by date if available, otherwise by leverage if available
          if (a.dateObj && b.dateObj) return a.dateObj.getTime() - b.dateObj.getTime();
          return (b.leverage ?? 0) - (a.leverage ?? 0);
        })
        .map((g: any) => {
          const dateStr = g.date
            ? `<span class="game-time" data-time="${g.date}">${new Date(g.date).toISOString().slice(0, 10)}</span> — `
            : '';
          const homeRank = g.home.cfpRank ? `#${g.home.cfpRank} ` : '';
          const awayRank = g.away.cfpRank ? `#${g.away.cfpRank} ` : '';
          const leverageStr = typeof g.leverage === 'number' ? ` (lev: ${g.leverage.toFixed(4)})` : '';
          return `<li>${dateStr}${homeRank}${escapeHtml(
            g.home.name
          )} vs ${awayRank}${escapeHtml(g.away.name)}${leverageStr}</li>`;
        })
        .join('\n');
      return `<li><strong>${escapeHtml(week)}</strong><ul>${rows}</ul></li>`;
    })
    .join('\n');
  // Filter server-returned contenders to FBS teams only
  const fbsContenders = (data.contenders || []).filter((c: any) => {
    // If we can map the team name to a teamSeasonId that belonged to FBS, keep it
    const tsId = teamNameToSeasonId[c.team?.name];
    return Boolean(tsId);
  });

  // If server returned no contenders (or filtered them all out), fall back to using teamNameToSeasonId order
  const contendersToRender = fbsContenders.length
    ? fbsContenders
    : (data.contenders || []).filter((c: any) => {
        // keep only those whose teamSeason exists in FBS set (try to derive teamSeason from known mapping too)
        const tsId = teamNameToSeasonId[c.team?.name];
        return Boolean(tsId);
      });

  const contendersHtml = contendersToRender
    .map((c: any) => {
      const tsId = teamNameToSeasonId[c.team?.name] || '';
      return `
        <li data-teamseason="${escapeHtml(tsId)}" data-resume="${c.resumeScore}" data-idx="${c.leverageIndex}">
          ${escapeHtml(c.team.name)} (${escapeHtml(c.team.conference.shortName)}), CFP Rank: ${c.rank ?? '—'}, resume: ${c.resumeScore}, idx: ${c.leverageIndex}
        </li>`;
    })
    .join('\n');

  // Generate rankings HTML for separate page
  const rankingsHtml = generateRankingsPage(data, ranksByPollWeek, teamNameToSeasonId, ctx);

  const playoffHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Playoff Preview — ${data.season}</title>
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <link rel="stylesheet" href="common-theme.css">
  <link rel="stylesheet" href="css/shared-nav.css">
  <style>
    .container {
      padding: 1.5rem 2rem;
    }
    
    /* Hide bullet points for matchup lists */
    section ul {
      list-style-type: none;
      padding-left: 0;
    }
    section ul ul {
      padding-left: 1.5rem;
      margin-top: 0.25rem;
    }
  </style>
</head>
<body>
  <div class="content-wrapper">
    <h1>Playoff Preview — ${data.season}</h1>
    <p style="color: var(--muted); font-size: 0.95rem">Generated: ${escapeHtml(data.generatedAt)}</p>

    <section>
      <h2 style="text-align:left">Upcoming Games (Top 25 Teams)</h2>
      <ul style="text-align:left">
        ${gamesHtml}
      </ul>
    </section>

    <script>
      // Format game times in user's local timezone
      (function formatGameTimes() {
        const gameTimeElements = document.querySelectorAll('.game-time');
        gameTimeElements.forEach(el => {
          const isoTime = el.getAttribute('data-time');
          if (!isoTime) return;
          const date = new Date(isoTime);
          const dateStr = date.toLocaleDateString(undefined, { 
            month: 'short', 
            day: 'numeric' 
          });
          const timeStr = date.toLocaleTimeString(undefined, { 
            hour: 'numeric', 
            minute: '2-digit',
            hour12: true 
          });
          el.textContent = \`\${dateStr} at \${timeStr}\`;
        });
      })();
  </script>

  <script type="module">
    import { initNavigation } from './modules/shared-nav.js';
    initNavigation('playoff-preview');
  </script>
</body>
</html>`;

  return { playoffHtml, rankingsHtml };
}

function generateRankingsPage(data: any, ranksByPollWeek: any, teamNameToSeasonId: any, ctx: any) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Rankings — ${data.season}</title>
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <link rel="stylesheet" href="common-theme.css">
  <link rel="stylesheet" href="css/shared-nav.css">
  <style>
    .container {
      padding: 1.5rem 2rem;
    }
  </style>
</head>
<body>
  <div class="content-wrapper">
    <h1>Top 25 Rankings — ${data.season}</h1>
    <p style="color: var(--muted); font-size: 0.95rem">Generated: ${escapeHtml(data.generatedAt)}</p>

    <section>
      <h2 style="text-align:left">Rankings</h2>
      <div style="margin-bottom:0.5rem">
        <label for="pollSelect">Poll:</label>
        <select id="pollSelect">
          <option>CFP</option>
          <option>COACHES</option>
          <option>AP</option>
        </select>
        <label for="weekSelect" style="margin-left:1rem">Week:</label>
        <select id="weekSelect"></select>
      </div>
      <div style="overflow-x:auto">
        <table id="rankingsTable" style="width:100%; border-collapse:collapse; text-align:left">
          <!-- Populated by JavaScript from poll data -->
        </table>
      </div>
    </section>

    <script>
      // Embed ranksByPollWeek, team mappings, and team season data
      const ranksByPollWeek = ${JSON.stringify(ranksByPollWeek)};
      const teamNameToSeasonId = ${JSON.stringify(teamNameToSeasonId)};
      const teamSeasonIdToName = ${JSON.stringify(
        Object.fromEntries(Object.entries(teamNameToSeasonId).map(([k, v]) => [v, k]))
      )};
      const teamSeasonData = ${JSON.stringify(
        Object.fromEntries(
          ctx.teamSeasons
            .filter((ts: any) => ts.season === data.season)
            .map((ts: any) => [ts.id, ts])
        )
      )};
      const season = ${data.season};

      function renderRankings() {
        const poll = document.getElementById('pollSelect').value || 'AP';
        const week = document.getElementById('weekSelect').value;
        const table = document.getElementById('rankingsTable');
        
        if (!week || week === 'select') {
          table.innerHTML = '<tr><td style="color:var(--muted)">Select a week to view rankings</td></tr>';
          return;
        }

        const rankMap = (ranksByPollWeek[poll] && ranksByPollWeek[poll][week]) || {};
        const ranks = Object.keys(rankMap).map(Number).sort((a,b)=>a-b);
        
        if (ranks.length === 0) {
          table.innerHTML = '<tr><td style="color:var(--muted)">No rankings available for this poll/week</td></tr>';
          return;
        }

        // Build table header
        let html = \`
          <thead>
            <tr style="border-bottom: 2px solid var(--border)">
              <th style="padding: 0.5rem">Rank</th>
              <th style="padding: 0.5rem">Team</th>
              <th style="padding: 0.5rem">Record</th>
              <th style="padding: 0.5rem">SP+</th>
            </tr>
          </thead>
          <tbody>
        \`;
        
        // Build table rows
        for (const rank of ranks) {
          const tsId = rankMap[String(rank)];
          const teamName = teamSeasonIdToName[tsId] || tsId;
          const ts = teamSeasonData[tsId] || {};
          const record = ts.record || {};
          const recordStr = \`\${record.wins || 0}-\${record.losses || 0}\${record.ties ? \`-\${record.ties}\` : ''}\`;
          const spPlus = ts.spPlus != null ? ts.spPlus.toFixed(1) : '—';
          
          html += \`
            <tr style="border-bottom: 1px solid var(--border)">
              <td style="padding: 0.5rem"><strong>#\${rank}</strong></td>
              <td style="padding: 0.5rem">\${teamName}</td>
              <td style="padding: 0.5rem">\${recordStr}</td>
              <td style="padding: 0.5rem">\${spPlus}</td>
            </tr>
          \`;
        }
        
        html += '</tbody>';
        table.innerHTML = html;
      }

      function populateWeekOptionsForPoll(poll) {
        const weekSelect = document.getElementById('weekSelect');
        weekSelect.innerHTML = '';
        const weekSet = new Set();
        for (const w of Object.keys(ranksByPollWeek[poll] || {})) weekSet.add(w);
        const pollWeeks = Array.from(weekSet).sort((a,b)=>{ 
          if (a==='unknown') return 1; 
          if (b==='unknown') return -1; 
          return Number(a)-Number(b); 
        });
        
        const selectOpt = document.createElement('option');
        selectOpt.value = 'select';
        selectOpt.text = '-- Select Week --';
        weekSelect.appendChild(selectOpt);
        
        for (const w of pollWeeks) {
          const opt = document.createElement('option');
          opt.value = w;
          opt.text = w==='unknown' ? 'Unknown' : 'Week ' + w;
          weekSelect.appendChild(opt);
        }
        return pollWeeks;
      }

      // Initialize: pick first poll that has data (CFP -> COACHES -> AP)
      (function init(){
        const pollSelect = document.getElementById('pollSelect');
        const pollOrder = ['CFP','COACHES','AP'];
        let defaultPoll = 'AP';
        for (const p of pollOrder) {
          if (Object.keys(ranksByPollWeek[p] || {}).length > 0) { 
            defaultPoll = p; 
            break; 
          }
        }
        pollSelect.value = defaultPoll;

        const pollWeeks = populateWeekOptionsForPoll(defaultPoll);
        // choose latest numeric week from the chosen poll if available
        const numericWeeks = Object.keys(ranksByPollWeek[defaultPoll] || {})
          .filter(w=>w!=='unknown')
          .map(Number)
          .sort((a,b)=>b-a);
        const defaultWeek = numericWeeks.length ? String(numericWeeks[0]) : (pollWeeks[0] || 'select');
        document.getElementById('weekSelect').value = defaultWeek;

        pollSelect.addEventListener('change', ()=>{
          const newPollWeeks = populateWeekOptionsForPoll(pollSelect.value);
          const newNumericWeeks = Object.keys(ranksByPollWeek[pollSelect.value] || {})
            .filter(w=>w!=='unknown')
            .map(Number)
            .sort((a,b)=>b-a);
          const newDefaultWeek = newNumericWeeks.length ? String(newNumericWeeks[0]) : (newPollWeeks[0] || 'select');
          document.getElementById('weekSelect').value = newDefaultWeek;
          renderRankings();
        });
        
        document.getElementById('weekSelect').addEventListener('change', renderRankings);
        
        // Render initial rankings
        renderRankings();
      })();

      // Format game times in user's local timezone
      (function formatGameTimes() {
        const gameTimeElements = document.querySelectorAll('.game-time');
        gameTimeElements.forEach(el => {
          const isoTime = el.getAttribute('data-time');
          if (!isoTime) return;
          const date = new Date(isoTime);
          const dateStr = date.toLocaleDateString(undefined, { 
            month: 'short', 
            day: 'numeric' 
          });
          const timeStr = date.toLocaleTimeString(undefined, { 
            hour: 'numeric', 
            minute: '2-digit',
            hour12: true 
          });
          el.textContent = \`\${dateStr} at \${timeStr}\`;
        });
      })();
    </script>

    <footer style="margin-top:1.25rem; color:var(--muted); font-size:0.85rem">Generated by fbs-graph</footer>
  </div>

  <script type="module">
    import { initNavigation } from './modules/shared-nav.js';
    initNavigation('rankings');
  </script>
</body>
</html>`;
}

function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Allow running from CLI with optional args
const argv = process.argv.slice(2);
const opts: any = {};
for (const a of argv) {
  const [k, v] = a.split('=');
  if (k === '--season') opts.season = Number(v);
  if (k === '--limit') opts.limit = Number(v);
  if (k === '--gameLimit') opts.gameLimit = Number(v);
  if (k === '--leverageThreshold') opts.leverageThreshold = Number(v);
}

generate(
  opts.season ?? 2025,
  opts.limit ?? 12,
  opts.gameLimit ?? 6,
  opts.leverageThreshold ?? 0.75
).catch(err => {
  console.error(err);
  process.exitCode = 2;
});
