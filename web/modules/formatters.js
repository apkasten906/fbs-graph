/**
 * Formatting utilities for the FBS Timeline App
 */

export function formatLeverage(value) {
  return typeof value === 'number' && !Number.isNaN(value) ? value.toFixed(3) : '—';
}

export function formatDateGroup(key) {
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

export function formatDateTime(iso) {
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

export function formatGameType(type) {
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

export function formatPhase(phase) {
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

export function compareDateKeys(a, b) {
  if (a === b) return 0;
  if (a === 'TBD') return 1;
  if (b === 'TBD') return -1;
  return new Date(`${a}T00:00:00Z`) - new Date(`${b}T00:00:00Z`);
}