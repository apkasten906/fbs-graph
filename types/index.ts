export type Division = 'FBS';

export interface Conference {
  id: string;
  name: string;
  shortName: string;
  division: Division;
}

export interface Team {
  id: string;
  name: string;
  shortName: string;
  conferenceId: string;
}

export interface RecordRow {
  wins: number;
  losses: number;
  ties: number;
  confWins: number;
  confLosses: number;
}

export interface TeamSeason {
  id: string;
  teamId: string;
  season: number;
  coach?: string | null;
  spPlus?: number | null;
  elo?: number | null;
  returningProduction?: number | null;
  record?: RecordRow;
}

export type PollType = 'AP' | 'COACHES' | 'CFP' | 'ELO' | 'SP_PLUS' | 'CUSTOM' | 'AVERAGE';

export interface PollSnapshot {
  teamSeasonId: string;
  poll: PollType;
  week: number;
  rank: number;
  date: string; // ISO
}

export type GamePhase = 'PRESEASON' | 'REGULAR' | 'POSTSEASON';
export type GameType = 'CONFERENCE' | 'NON_CONFERENCE' | 'BOWL' | 'PLAYOFF' | 'CHAMPIONSHIP';
export type GameResult = 'TBD' | 'HOME_WIN' | 'AWAY_WIN' | 'TIE' | 'CANCELLED' | 'NO_CONTEST';

export interface Game {
  id: string;
  season: number;
  week?: number;
  phase: GamePhase;
  date?: string;
  type: GameType;
  homeTeamId: string;
  awayTeamId: string;
  result: GameResult;
  homePoints?: number | null;
  awayPoints?: number | null;
  // Computed/scored fields added at runtime:
  leverage?: number;
  rankWeightHome?: number;
  rankWeightAway?: number;
  bridgeBoost?: number;
  timingBoost?: number;
}

export interface PlayoffContender {
  season: number;
  teamId: string;
  rank?: number;
  resumeScore: number;
  leverageIndex: number;
  upcomingGames: Game[];
  nextGame?: Game;
}

export interface PlayoffPreview {
  season: number;
  generatedAt: string;
  leverageThreshold: number;
  remainingHighLeverageGames: Game[];
  contenders: PlayoffContender[];
}
