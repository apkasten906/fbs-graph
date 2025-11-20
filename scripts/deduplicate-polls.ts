import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const pollsPath = join(process.cwd(), 'src', 'data', 'polls.json');
const polls = JSON.parse(readFileSync(pollsPath, 'utf-8'));

console.log(`Original polls.json has ${polls.length} entries`);

// Group by (poll, week, rank) and keep only FBS entries, preferring latest by date
const deduped: any[] = [];
const seen = new Map<string, any>();

for (const p of polls) {
  const key = `${p.poll}|${p.week}|${p.rank}`;
  const existing = seen.get(key);
  
  if (!existing) {
    seen.set(key, p);
  } else {
    // Prefer entry with later date (more recent fetch)
    const existingDate = new Date(existing.date || 0);
    const currentDate = new Date(p.date || 0);
    if (currentDate > existingDate) {
      seen.set(key, p);
    }
  }
}

for (const entry of seen.values()) {
  deduped.push(entry);
}

// Sort by poll, week, rank for readability
deduped.sort((a, b) => {
  if (a.poll !== b.poll) return a.poll.localeCompare(b.poll);
  if (a.week !== b.week) return (a.week || 0) - (b.week || 0);
  return (a.rank || 0) - (b.rank || 0);
});

console.log(`Deduplicated polls.json has ${deduped.length} entries`);
console.log(`Removed ${polls.length - deduped.length} duplicates`);

// Write backup
const backupPath = join(process.cwd(), 'src', 'data', 'polls.backup.json');
writeFileSync(backupPath, JSON.stringify(polls, null, 2));
console.log(`Created backup at ${backupPath}`);

// Write deduplicated data
writeFileSync(pollsPath, JSON.stringify(deduped, null, 2));
console.log(`Wrote deduplicated data to ${pollsPath}`);
