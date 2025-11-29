// Centralized conference color map for web modules
// Includes FBS and FCS placeholders and many historical conferences used in the app.
export const CONFERENCE_COLORS = {
  // Power Conferences / FBS (brand-approximate)
  acc: '#D50032', // ACC red (per request)
  b1g: '#1E90FF', // Big Ten vivid blue
  b12: '#FF6A00', // Big 12 orange
  sec: '#FDB827', // SEC gold-forward to separate from other navies

  // Group of 5 / FBS
  aac: '#0B4F6C', // American Athletic teal-blue
  cusa: '#004B8D', // Conference USA blue (separate from ACC/B1G)
  mac: '#006747', // MAC green
  mwc: '#582C83', // Mountain West deep purple
  sbc: '#F9A602', // Sun Belt gold-orange

  // Independents and other FBS
  ind: '#4B4B4B', // neutral gray for independents
  wac: '#008272',

  // Historical / regional (kept as accents)
  be: '#9CCC65', // Big East (historic)
  pac12: '#1E88E5', // Pac-12 bright blue to avoid clashing with C-USA
  pac10: '#1E88E5',
  pac8: '#1E88E5',
  swc: '#FF6B35', // Southwest Conference
  big8: '#FF9E00',
  big7: '#FFA500',
  big6: '#FFB84D',

  // Minor / other
  ivy: '#0B4F1E',
  southland: '#7CB342',
  bw: '#26C6DA', // Big West
  pcaa: '#4DD0E1',
  aawu: '#AB47BC',
  pcc: '#BA68C8',
  swac: '#D4AF37',
  mvc: '#8D6E63',
  mviaa: '#A1887F',
  skyline: '#78909C',
  biaa: '#90A4AE',
  western: '#BCAAA4',
  southern: '#B0BEC5',
  rmc: '#CFD8DC',
  msac: '#E0E0E0',

  // FBS / FCS placeholders
  fbs: '#1f77b4',
  fcs: '#ff7f0e',

  // Fallback
  other: '#444444',
};

export function getConferenceColor(id) {
  if (!id) return CONFERENCE_COLORS.other;
  return CONFERENCE_COLORS[id] || CONFERENCE_COLORS.other;
}

export default CONFERENCE_COLORS;
