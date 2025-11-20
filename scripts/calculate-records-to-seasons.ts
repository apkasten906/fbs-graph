import fs from 'node:fs';
import { parse } from 'csv-parse/sync';

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
  // Read schedules CSV
  const schedulesPath = `csv/schedules_${YEAR}.csv`;
  if (!fs.existsSync(schedulesPath)) {
    console.error(`Schedules file not found: ${schedulesPath}`);
    process.exit(1);
  }

  const schedulesText = fs.readFileSync(schedulesPath, 'utf-8');
  const games = parse(schedulesText, { columns: true, skip_empty_lines: true });

  // Calculate records for each team
  const records = new Map<string, { wins: number; losses: number; ties: number; confWins: number; confLosses: number }>();

  for (const g of games) {
    const homeId = idify(g.home);
    const awayId = idify(g.away);
    const result = g.result;
    const isConf = g.conferenceGame === 'true';

    // Initialize records if not exists
    if (!records.has(homeId)) {
      records.set(homeId, { wins: 0, losses: 0, ties: 0, confWins: 0, confLosses: 0 });
    }
    if (!records.has(awayId)) {
      records.set(awayId, { wins: 0, losses: 0, ties: 0, confWins: 0, confLosses: 0 });
    }

    const homeRec = records.get(homeId)!;
    const awayRec = records.get(awayId)!;

    // Update records based on result
    if (result === 'HOME_WIN') {
      homeRec.wins++;
      awayRec.losses++;
      if (isConf) {
        homeRec.confWins++;
        awayRec.confLosses++;
      }
    } else if (result === 'AWAY_WIN') {
      awayRec.wins++;
      homeRec.losses++;
      if (isConf) {
        awayRec.confWins++;
        homeRec.confLosses++;
      }
    } else if (result === 'TIE') {
      homeRec.ties++;
      awayRec.ties++;
    }
  }

  // Update team_seasons.csv
  const teamSeasonsPath = 'csv/team_seasons.csv';
  const teamSeasonsText = fs.readFileSync(teamSeasonsPath, 'utf-8');
  const rows = parse(teamSeasonsText, { columns: true, skip_empty_lines: true });

  const outHeader = Object.keys(rows[0] || {});
  const out = [outHeader.join(',')];

  for (const r of rows) {
    const teamId = r.teamId;
    const rec = records.get(teamId);

    const obj: any = {
      ...r,
      wins: rec?.wins ?? r.wins ?? 0,
      losses: rec?.losses ?? r.losses ?? 0,
      ties: rec?.ties ?? r.ties ?? 0,
      confWins: rec?.confWins ?? r.confWins ?? 0,
      confLosses: rec?.confLosses ?? r.confLosses ?? 0,
    };

    out.push(outHeader.map(k => obj[k] ?? '').join(','));
  }

  fs.writeFileSync(teamSeasonsPath, out.join('\n') + '\n', 'utf-8');
  console.log(`Updated records in ${teamSeasonsPath} for ${records.size} teams from ${games.length} games`);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
