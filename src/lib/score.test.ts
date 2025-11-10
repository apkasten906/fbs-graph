import { describe, it, expect } from 'vitest';
import {
  buildAPRankMap,
  buildNormalizedSpPlus,
  buildNormalizedElo,
  computeLeverageForGame,
} from './score';
import type { Game, TeamSeason, PollSnapshot } from '../../types/index';

describe('Score and Leverage Calculations', () => {
  describe('buildAPRankMap', () => {
    it('should build a map of team season IDs to AP ranks', () => {
      const polls: PollSnapshot[] = [
        {
          teamSeasonId: 'alabama-2025',
          poll: 'AP',
          week: 1,
          rank: 1,
          date: '2025-08-25T00:00:00.000Z',
        },
        {
          teamSeasonId: 'georgia-2025',
          poll: 'AP',
          week: 1,
          rank: 2,
          date: '2025-08-25T00:00:00.000Z',
        },
        {
          teamSeasonId: 'alabama-2025',
          poll: 'AP',
          week: 2,
          rank: 3,
          date: '2025-09-01T00:00:00.000Z',
        },
      ];

      const rankMap = buildAPRankMap(polls, 2025);

      expect(rankMap.get('alabama-2025')).toBe(3); // Latest week
      expect(rankMap.get('georgia-2025')).toBe(2);
    });

    it('should only include AP polls', () => {
      const polls: PollSnapshot[] = [
        {
          teamSeasonId: 'alabama-2025',
          poll: 'AP',
          week: 1,
          rank: 1,
          date: '2025-08-25T00:00:00.000Z',
        },
        {
          teamSeasonId: 'georgia-2025',
          poll: 'COACHES',
          week: 1,
          rank: 5,
          date: '2025-08-25T00:00:00.000Z',
        },
      ];

      const rankMap = buildAPRankMap(polls, 2025);

      expect(rankMap.has('alabama-2025')).toBe(true);
      expect(rankMap.has('georgia-2025')).toBe(false); // COACHES poll excluded
    });
  });

  describe('buildNormalizedSpPlus', () => {
    it('should normalize SP+ ratings to 0-1 range', () => {
      const teamSeasons: TeamSeason[] = [
        {
          id: 'team1-2025',
          teamId: 'team1',
          season: 2025,
          spPlus: 30.0,
          record: { wins: 0, losses: 0, ties: 0, confWins: 0, confLosses: 0 },
        },
        {
          id: 'team2-2025',
          teamId: 'team2',
          season: 2025,
          spPlus: 10.0,
          record: { wins: 0, losses: 0, ties: 0, confWins: 0, confLosses: 0 },
        },
        {
          id: 'team3-2025',
          teamId: 'team3',
          season: 2025,
          spPlus: 20.0,
          record: { wins: 0, losses: 0, ties: 0, confWins: 0, confLosses: 0 },
        },
      ];

      const normalized = buildNormalizedSpPlus(teamSeasons, 2025);

      expect(normalized.get('team1-2025')).toBe(1.0); // Max value
      expect(normalized.get('team2-2025')).toBe(0.0); // Min value
      expect(normalized.get('team3-2025')).toBe(0.5); // Middle value
    });

    it('should handle seasons with no SP+ data', () => {
      const teamSeasons: TeamSeason[] = [
        {
          id: 'team1-2025',
          teamId: 'team1',
          season: 2025,
          spPlus: null,
          record: { wins: 0, losses: 0, ties: 0, confWins: 0, confLosses: 0 },
        },
      ];

      const normalized = buildNormalizedSpPlus(teamSeasons, 2025);

      expect(normalized.size).toBe(0);
    });
  });

  describe('computeLeverageForGame', () => {
    it('should calculate leverage for a game between ranked teams', () => {
      const game: Game = {
        id: 'game1',
        season: 2025,
        week: 1,
        phase: 'REGULAR',
        date: '2025-08-30T00:00:00.000Z',
        type: 'NON_CONFERENCE',
        homeTeamId: 'alabama',
        awayTeamId: 'georgia',
        result: 'TBD',
      };

      const teamSeasons: TeamSeason[] = [
        {
          id: 'alabama-2025',
          teamId: 'alabama',
          season: 2025,
          spPlus: 30.0,
          elo: 1800,
          record: { wins: 0, losses: 0, ties: 0, confWins: 0, confLosses: 0 },
        },
        {
          id: 'georgia-2025',
          teamId: 'georgia',
          season: 2025,
          spPlus: 28.0,
          elo: 1780,
          record: { wins: 0, losses: 0, ties: 0, confWins: 0, confLosses: 0 },
        },
      ];

      const apRanks = new Map([
        ['alabama-2025', 1],
        ['georgia-2025', 2],
      ]);

      const spNorm = buildNormalizedSpPlus(teamSeasons, 2025);
      const eloNorm = buildNormalizedElo(teamSeasons, 2025);

      const enrichedGame = computeLeverageForGame(
        game,
        teamSeasons,
        apRanks,
        spNorm,
        eloNorm,
        'AVERAGE'
      );

      expect(enrichedGame.leverage).toBeGreaterThan(0);
      expect(enrichedGame.rankWeightHome).toBeDefined();
      expect(enrichedGame.rankWeightAway).toBeDefined();
      expect(enrichedGame.bridgeBoost).toBe(1.2); // Non-conference game
      expect(enrichedGame.timingBoost).toBeDefined();
    });

    it('should apply bridge boost for non-conference games', () => {
      const game: Game = {
        id: 'game1',
        season: 2025,
        week: 1,
        phase: 'REGULAR',
        type: 'NON_CONFERENCE',
        homeTeamId: 'team1',
        awayTeamId: 'team2',
        result: 'TBD',
      };

      const enrichedGame = computeLeverageForGame(game, [], new Map(), new Map(), new Map(), 'AP');

      expect(enrichedGame.bridgeBoost).toBe(1.2);
    });

    it('should apply timing boost for late season games', () => {
      const game: Game = {
        id: 'game1',
        season: 2025,
        week: 12,
        phase: 'REGULAR',
        type: 'CONFERENCE',
        homeTeamId: 'team1',
        awayTeamId: 'team2',
        result: 'TBD',
      };

      const enrichedGame = computeLeverageForGame(game, [], new Map(), new Map(), new Map(), 'AP');

      expect(enrichedGame.timingBoost).toBe(1.15);
    });

    it('should apply higher timing boost for playoff games', () => {
      const game: Game = {
        id: 'game1',
        season: 2025,
        week: 16, // Postseason week for timing boost calculation
        phase: 'POSTSEASON',
        type: 'PLAYOFF',
        homeTeamId: 'team1',
        awayTeamId: 'team2',
        result: 'TBD',
      };

      const enrichedGame = computeLeverageForGame(game, [], new Map(), new Map(), new Map(), 'AP');

      expect(enrichedGame.timingBoost).toBe(1.25);
    });
  });
});
