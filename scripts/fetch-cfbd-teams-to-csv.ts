import fs from 'node:fs';
import path from 'node:path';
const API_KEY = process.env.CFBD_KEY || process.env.COLLEGE_FOOTBALL_API_KEY;
if (!API_KEY) {
  console.error('Missing CFBD_KEY');
  process.exit(1);
}
const YEAR = Number(process.env.YEAR || 2025);
type Team = {
  school: string;
  abbreviation?: string | null;
  conference?: string | null;
  classification?: string | null;
};
function esc(v: any) {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function writeCSV(rows: any[], out: string) {
  const header = ['name', 'shortName', 'conferenceId'];
  const lines = [header.join(',')];
  for (const r of rows) lines.push(header.map(k => esc(r[k])).join(','));
  fs.mkdirSync(out.split('/').slice(0, -1).join('/') || '.', { recursive: true });
  fs.writeFileSync(out, lines.join('\n') + '\n');
}
function mapConferenceId(name?: string | null) {
  if (!name) return '';
  const m: Record<string, string> = {
    SEC: 'sec',
    'Big Ten': 'b1g',
    'Big 12': 'b12',
    ACC: 'acc',
    'American Athletic': 'aac',
    'Mountain West': 'mwc',
    'Mid-American': 'mac',
    'Sun Belt': 'sbc',
    'Conference USA': 'cusa',
    'FBS Independents': 'ind',
    Independent: 'ind',
    'Pac-12': 'pac12',
  };
  return m[name] || name.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function abbrev(t: Team) {
  if (t.abbreviation && t.abbreviation.trim()) return t.abbreviation.trim().toUpperCase();
  return t.school
    .split(/\s+/)
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 4);
}

(async () => {
  const url = new URL('https://api.collegefootballdata.com/teams');
  url.searchParams.set('year', String(YEAR));
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${API_KEY}`, accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`CFBD /teams HTTP ${res.status}`);
  const all = (await res.json()) as Team[];
  // Include both FBS and FCS teams (for cross-division games)
  const teams = all.filter(t => {
    const cls = (t.classification || '').toLowerCase();
    return cls === 'fbs' || cls === 'fcs';
  });
  const rows = teams.map(t => ({
    name: t.school,
    shortName: abbrev(t),
    conferenceId: mapConferenceId(
      t.conference || (['Notre Dame', 'UConn'].includes(t.school) ? 'FBS Independents' : '')
    ),
  }));
  const out = path.join('csv', 'teams.csv');
  writeCSV(rows, out);
  console.log(`Wrote ${rows.length} teams (FBS + FCS) -> ${out}`);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
