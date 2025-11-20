import fs from 'node:fs';
import localenv from 'dotenv';

// Load API key from env or .env
const API_KEY =
  process.env.CFBD_KEY ||
  process.env.COLLEGE_FOOTBALL_API_KEY ||
  localenv.config().parsed?.CFBD_KEY;
if (!API_KEY) {
  console.error('Missing CFBD_KEY');
  process.exit(1);
}

// CLI flags: --pollType=AP|CFP|COACHES|ALL and --year
const argv = process.argv.slice(2);
function argValue(k: string) {
  const m = argv.find(a => a.startsWith(`--${k}=`));
  if (!m) return undefined;
  return m.split('=')[1];
}
const POLL_TYPE = (argValue('pollType') || 'ALL').toUpperCase();
const YEAR = Number(argValue('year') || process.env.YEAR || 2025);

type RankingWeek = {
  season: number;
  week: number;
  polls: { poll: string; ranks: { school: string; rank: number }[] }[];
};

function normalizePollName(raw: string): string | null {
  const s = (raw || '').toString().toLowerCase();
  if (s.includes('ap')) return 'AP';
  if (s.includes('cfp')) return 'CFP';
  if (s.includes('coach') || s.includes('usa') || s.includes('coaches')) return 'COACHES';
  return null;
}

function shouldInclude(pollLabel: string) {
  if (POLL_TYPE === 'ALL') return true;
  return POLL_TYPE === pollLabel;
}

(async () => {
  const url = new URL('https://api.collegefootballdata.com/rankings');
  url.searchParams.set('year', String(YEAR));
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${API_KEY}`, accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`CFBD /rankings HTTP ${res.status}`);
  const weeks = (await res.json()) as RankingWeek[];
  const header = 'team,season,poll,week,rank,date';
  const newLines: string[] = [];
  for (const w of weeks) {
    for (const p of w.polls as any[]) {
      const pollLabel = normalizePollName(p.poll || p.pollName || '');
      if (!pollLabel) continue;
      if (!shouldInclude(pollLabel)) continue;
      const date = new Date().toISOString();
      for (const r of p.ranks) {
        const team = String(r.school).replace(/,/g, '');
        newLines.push(`${team},${YEAR},${pollLabel},${w.week},${r.rank},${date}`);
      }
    }
  }

  fs.mkdirSync('csv', { recursive: true });
  const outPath = 'csv/polls.csv';
  // Merge with existing CSV (avoid exact duplicates)
  const existing = fs.existsSync(outPath) ? fs.readFileSync(outPath, 'utf-8').split(/\r?\n/) : [];
  const existingSet = new Set(existing.filter(Boolean));
  const merged = [header];
  // include existing unique rows
  for (const line of existing) {
    if (!line) continue;
    // ensure header not duplicated
    if (line.trim().toLowerCase() === header.toLowerCase()) continue;
    merged.push(line);
  }
  // add new lines if not present
  let added = 0;
  for (const nl of newLines) {
    if (existingSet.has(nl)) continue;
    merged.push(nl);
    added++;
  }
  fs.writeFileSync(outPath, merged.join('\n') + '\n', 'utf-8');
  console.log(`Wrote ${outPath} (+${added} new rows)`);
  if (POLL_TYPE !== 'ALL') console.log(`Filtered pollType=${POLL_TYPE}`);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
