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

  const outDir = path.join(process.cwd(), 'web');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const html = renderHTML(data);
  fs.writeFileSync(path.join(outDir, 'playoff-preview.html'), html, 'utf-8');
  console.log('Wrote web/playoff-preview.html');
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
    // lazy import of helper to build AP rank map
    const { buildLatestAPRankMap } = await import('../src/lib/score.js');

    const apMap = buildLatestAPRankMap(polls, season, teamSeasons);

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
        const rank = apMap.get(ts.id);
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

function renderHTML(data: any) {
  const gamesHtml = (data.remainingHighLeverageGames || [])
    .map(
      (g: any) =>
        `<li>${new Date(g.date).toISOString().slice(0, 10)} — ${escapeHtml(g.home.name)} vs ${escapeHtml(g.away.name)} (lev: ${g.leverage})</li>`
    )
    .join('\n');
  const contendersHtml = (data.contenders || [])
    .map(
      (c: any) =>
        `<li>${escapeHtml(c.team.name)} (${escapeHtml(c.team.conference.shortName)}), rank: ${c.rank ?? '—'}, resume: ${c.resumeScore}, idx: ${c.leverageIndex}</li>`
    )
    .join('\n');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Playoff Preview — ${data.season}</title>
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <link rel="stylesheet" href="common-theme.css">
</head>
<body>
  <div class="container">
    <h1>Playoff Preview — ${data.season}</h1>
    <p style="color: var(--muted); font-size: 0.95rem">Generated: ${escapeHtml(data.generatedAt)}</p>

    <section>
      <h2 style="text-align:left">Remaining High-Leverage Games</h2>
      <ul style="text-align:left">
        ${gamesHtml}
      </ul>
    </section>

    <section>
      <h2 style="text-align:left">Top Contenders</h2>
      <ol style="text-align:left">
        ${contendersHtml}
      </ol>
    </section>

    <footer style="margin-top:1.25rem; color:var(--muted); font-size:0.85rem">Generated by fbs-graph</footer>
  </div>
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
