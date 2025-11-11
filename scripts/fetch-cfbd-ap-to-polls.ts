import fs from 'node:fs';
import localenv from 'dotenv';
const API_KEY =
  process.env.CFBD_KEY ||
  process.env.COLLEGE_FOOTBALL_API_KEY ||
  localenv.config().parsed?.CFBD_KEY;
if (!API_KEY) {
  console.error('Missing CFBD_KEY');
  process.exit(1);
}
const YEAR = Number(process.env.YEAR || 2025);
type RankingWeek = {
  season: number;
  week: number;
  polls: { poll: string; ranks: { school: string; rank: number }[] }[];
};
(async () => {
  const url = new URL('https://api.collegefootballdata.com/rankings');
  url.searchParams.set('year', String(YEAR));
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${API_KEY}`, accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`CFBD /rankings HTTP ${res.status}`);
  const weeks = (await res.json()) as RankingWeek[];
  const lines = ['team,season,poll,week,rank,date'];
  for (const w of weeks) {
    const ap = (w.polls as any[]).find(p =>
      (p.poll || p.pollName || '').toString().toLowerCase().includes('ap')
    );
    if (!ap) continue;
    const date = new Date().toISOString();
    for (const r of ap.ranks) {
      const team = String(r.school).replace(/,/g, '');
      lines.push(`${team},${YEAR},AP,${w.week},${r.rank},${date}`);
    }
  }
  fs.mkdirSync('csv', { recursive: true });
  fs.writeFileSync('csv/polls.csv', lines.join('\n') + '\n', 'utf-8');
  console.log(`Wrote AP rankings -> csv/polls.csv (${lines.length - 1} rows)`);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
