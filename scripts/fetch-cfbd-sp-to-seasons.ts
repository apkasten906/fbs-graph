import fs from 'node:fs';
import { parse } from 'csv-parse/sync';
import localenv from 'dotenv';
const API_KEY = process.env.CFBD_KEY || process.env.COLLEGE_FOOTBALL_API_KEY || localenv.config().parsed?.CFBD_KEY;
if (!API_KEY) {
  console.error('Missing CFBD_KEY');
  process.exit(1);
}
const YEAR = Number(process.env.YEAR || 2025);
function idify(s: string) {
  return s
    .toLowerCase()
    .replace(/[&.]/g, '')
    .replace(/[()]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
(async () => {
  const url = new URL('https://api.collegefootballdata.com/ratings/sp');
  url.searchParams.set('year', String(YEAR));
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${API_KEY}`, accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`CFBD /ratings/sp HTTP ${res.status}`);
  const data = (await res.json()) as any[];
  const map = new Map<string, number>();
  for (const r of data) {
    const team = r.team || r.school || r.schoolName;
    const rating = (r.rating ?? r.spRating ?? r.sp) as number | undefined;
    if (!team || typeof rating !== 'number') continue;
    map.set(idify(String(team)), Number(rating));
  }
  const path = 'csv/team_seasons.csv';
  const text = fs.readFileSync(path, 'utf-8');
  const rows = parse(text, { columns: true, skip_empty_lines: true });
  const outHeader = Object.keys(rows[0] || {}).includes('spPlus')
    ? Object.keys(rows[0])
    : [...Object.keys(rows[0] || {}), 'spPlus'];
  const out = [outHeader.join(',')];
  for (const r of rows) {
    const teamId = r.teamId;
    const sp = map.get(teamId);
    const obj: any = { ...r, spPlus: sp ?? r.spPlus ?? '' };
    out.push(outHeader.map(k => obj[k] ?? '').join(','));
  }
  fs.writeFileSync(path, out.join('\n') + '\n', 'utf-8');
  console.log(`Merged SP+ into ${path} for ${map.size} teams`);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
