import { describe, it, expect } from 'vitest';
import { idify } from './dataLoader';

describe('Data Loader Utilities', () => {
  describe('idify', () => {
    it('should convert team names to lowercase IDs', () => {
      expect(idify('Ohio State')).toBe('ohio-state');
      expect(idify('Alabama')).toBe('alabama');
      expect(idify('Penn State')).toBe('penn-state');
    });

    it('should remove special characters', () => {
      expect(idify("Hawai'i")).toBe('hawaii');
      expect(idify('Texas A&M')).toBe('texas-aandm');
      expect(idify('Miami (FL)')).toBe('miami-fl');
    });

    it('should replace multiple spaces with single hyphen', () => {
      expect(idify('Notre  Dame')).toBe('notre-dame');
      expect(idify('Texas   Christian')).toBe('texas-christian');
    });

    it('should handle already formatted IDs', () => {
      expect(idify('ohio-state')).toBe('ohio-state');
      expect(idify('alabama')).toBe('alabama');
    });

    it('should handle empty strings', () => {
      expect(idify('')).toBe('');
    });

    it('should handle names with dots', () => {
      expect(idify("St. John's")).toBe('st-johns');
      expect(idify('U.S.C.')).toBe('usc');
    });
  });
});
