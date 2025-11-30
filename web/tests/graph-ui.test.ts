import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';

// @ts-ignore - importing JS module from TS test
import { showEdgeGames, buildLegend, buildSelectors } from '../modules/graph-ui.js';

// Type definitions for test data
type Team = { id: string; name: string; conference?: { id: string } };
type Game = {
  id: string;
  home: { id: string; name: string };
  away: { id: string; name: string };
  type: string;
  leverage?: number;
  date?: string;
};

describe('graph-ui', () => {
  let dom: JSDOM;
  let document: Document;

  beforeEach(() => {
    // Setup a fresh DOM for each test
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div id="pathInfo"></div>
          <div id="legend"></div>
          <select id="srcSel"></select>
          <select id="dstSel"></select>
          <button id="pathBtn">Compare</button>
        </body>
      </html>
    `);
    document = dom.window.document;
    global.document = document as any;
  });

  afterEach(() => {
    // @ts-ignore
    delete global.document;
  });

  describe('showEdgeGames', () => {
    it('should display games for an edge', () => {
      const mockGames: Game[] = [
        {
          id: 'g1',
          home: { id: 'ohio-state', name: 'Ohio State' },
          away: { id: 'michigan', name: 'Michigan' },
          type: 'CONFERENCE',
          leverage: 0.85,
          date: '2024-11-30T17:00:00.000Z',
        },
        {
          id: 'g2',
          home: { id: 'michigan', name: 'Michigan' },
          away: { id: 'ohio-state', name: 'Ohio State' },
          type: 'CONFERENCE',
          leverage: 0.92,
          date: '2023-11-25T17:00:00.000Z',
        },
      ];

      const pairGames = new Map();
      pairGames.set('michigan__ohio-state', mockGames);

      const edgeData = { id: 'e_michigan__ohio-state' };

      showEdgeGames(edgeData, pairGames);

      const container = document.getElementById('pathInfo');
      expect(container).toBeTruthy();
      expect(container?.textContent).toContain('Games on this connection (2)');
      expect(container?.textContent).toContain('Ohio State');
      expect(container?.textContent).toContain('Michigan');
      expect(container?.textContent).toContain('lev 0.850');
      expect(container?.textContent).toContain('lev 0.920');
    });

    it('should handle empty games array', () => {
      const pairGames = new Map();
      const edgeData = { id: 'e_team1__team2' };

      showEdgeGames(edgeData, pairGames);

      const container = document.getElementById('pathInfo');
      expect(container?.textContent).toContain('Games on this connection (0)');
    });

    it('should handle custom container ID', () => {
      const customDiv = document.createElement('div');
      customDiv.id = 'customContainer';
      document.body.appendChild(customDiv);

      const pairGames = new Map();
      const edgeData = { id: 'e_team1__team2' };

      showEdgeGames(edgeData, pairGames, 'customContainer');

      expect(customDiv.textContent).toContain('Games on this connection (0)');
    });

    it('should handle missing container gracefully', () => {
      const pairGames = new Map();
      const edgeData = { id: 'e_team1__team2' };
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      showEdgeGames(edgeData, pairGames, 'nonexistent');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Container element 'nonexistent' not found")
      );
      consoleSpy.mockRestore();
    });

    it('should sort games by date', () => {
      const mockGames: Game[] = [
        {
          id: 'g2',
          home: { id: 'ohio-state', name: 'Ohio State' },
          away: { id: 'michigan', name: 'Michigan' },
          type: 'CONFERENCE',
          leverage: 0.85,
          date: '2024-11-30T17:00:00.000Z',
        },
        {
          id: 'g1',
          home: { id: 'michigan', name: 'Michigan' },
          away: { id: 'ohio-state', name: 'Ohio State' },
          type: 'CONFERENCE',
          leverage: 0.92,
          date: '2023-11-25T17:00:00.000Z',
        },
      ];

      const pairGames = new Map();
      pairGames.set('test', mockGames);

      const edgeData = { id: 'e_test' };

      showEdgeGames(edgeData, pairGames);

      const container = document.getElementById('pathInfo');
      const rows = container?.querySelectorAll('.mono');
      expect(rows).toBeTruthy();
      expect(rows?.length).toBe(2);
      // Earlier date should be first
      expect(rows?.[0].textContent).toContain('2023');
      expect(rows?.[1].textContent).toContain('2024');
    });
  });

  describe('buildLegend', () => {
    it('should build legend from teams data', async () => {
      const teams: Team[] = [
        { id: 'ohio-state', name: 'Ohio State', conference: { id: 'b1g' } },
        { id: 'michigan', name: 'Michigan', conference: { id: 'b1g' } },
        { id: 'georgia', name: 'Georgia', conference: { id: 'sec' } },
      ];

      const conferenceMeta = [
        { id: 'b1g', name: 'Big Ten', shortName: 'B1G' },
        { id: 'sec', name: 'SEC', shortName: 'SEC' },
      ];

      // @ts-ignore - import canonical colors
      const { CONFERENCE_COLORS } = await import('../modules/conference-colors.js');
      const colors = {
        b1g: CONFERENCE_COLORS.b1g,
        sec: CONFERENCE_COLORS.sec,
        other: CONFERENCE_COLORS.other,
      };

      buildLegend(teams, conferenceMeta, colors);

      const container = document.getElementById('legend');
      expect(container?.children.length).toBeGreaterThan(0);
      expect(container?.textContent).toContain('Big Ten');
      expect(container?.textContent).toContain('SEC');

      const dots = container?.querySelectorAll('.dot');
      expect(dots?.length).toBe(2); // 2 conferences
    });

    it('should handle teams without conferences', () => {
      const teams: Team[] = [
        { id: 'notre-dame', name: 'Notre Dame' }, // No conference
      ];

      const conferenceMeta: any[] = [];
      const colors = { other: '#444444' };

      buildLegend(teams, conferenceMeta, colors);

      const container = document.getElementById('legend');
      expect(container?.textContent).toContain('OTHER');
    });

    it('should sort legend entries alphabetically', async () => {
      const teams: Team[] = [
        { id: 't1', name: 'Team 1', conference: { id: 'sec' } },
        { id: 't2', name: 'Team 2', conference: { id: 'acc' } },
        { id: 't3', name: 'Team 3', conference: { id: 'b1g' } },
      ];

      const conferenceMeta = [
        { id: 'sec', name: 'SEC', shortName: 'SEC' },
        { id: 'acc', name: 'ACC', shortName: 'ACC' },
        { id: 'b1g', name: 'Big Ten', shortName: 'B1G' },
      ];

      // @ts-ignore - import canonical colors
      const { CONFERENCE_COLORS: C2 } = await import('../modules/conference-colors.js');
      const colors = { sec: C2.sec, acc: C2.acc, b1g: C2.b1g, other: C2.other };

      buildLegend(teams, conferenceMeta, colors);

      const container = document.getElementById('legend');
      const labels = Array.from(container?.children || [])
        .filter(el => !el.classList.contains('dot'))
        .map(el => el.textContent);

      // Should be sorted: ACC, Big Ten, SEC
      expect(labels[0]).toContain('ACC');
      expect(labels[1]).toContain('Big Ten');
      expect(labels[2]).toContain('SEC');
    });

    it('should handle missing container gracefully', () => {
      const teams: Team[] = [];
      const conferenceMeta: any[] = [];
      const colors = { other: '#444444' };
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      buildLegend(teams, conferenceMeta, colors, 'nonexistent');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Container element 'nonexistent' not found")
      );
      consoleSpy.mockRestore();
    });
  });

  describe('buildSelectors', () => {
    it('should populate team selectors', () => {
      const teams: Team[] = [
        { id: 'ohio-state', name: 'Ohio State', conference: { id: 'b1g' } },
        { id: 'michigan', name: 'Michigan', conference: { id: 'b1g' } },
        { id: 'georgia', name: 'Georgia', conference: { id: 'sec' } },
      ];

      buildSelectors(teams, 'srcSel', 'dstSel', { autoTrigger: false });

      const srcSel = document.getElementById('srcSel') as HTMLSelectElement;
      const dstSel = document.getElementById('dstSel') as HTMLSelectElement;

      expect(srcSel.options.length).toBe(3);
      expect(dstSel.options.length).toBe(3);
    });

    it('should sort teams alphabetically', () => {
      const teams: Team[] = [
        { id: 'georgia', name: 'Georgia', conference: { id: 'sec' } },
        { id: 'ohio-state', name: 'Ohio State', conference: { id: 'b1g' } },
        { id: 'alabama', name: 'Alabama', conference: { id: 'sec' } },
      ];

      buildSelectors(teams, 'srcSel', 'dstSel', { autoTrigger: false });

      const srcSel = document.getElementById('srcSel') as HTMLSelectElement;

      expect(srcSel.options[0].text).toBe('Alabama');
      expect(srcSel.options[1].text).toBe('Georgia');
      expect(srcSel.options[2].text).toBe('Ohio State');
    });

    it('should set default selections', () => {
      const teams: Team[] = [
        { id: 'ohio-state', name: 'Ohio State', conference: { id: 'b1g' } },
        { id: 'michigan', name: 'Michigan', conference: { id: 'b1g' } },
        { id: 'georgia', name: 'Georgia', conference: { id: 'sec' } },
      ];

      buildSelectors(teams, 'srcSel', 'dstSel', { autoTrigger: false });

      const srcSel = document.getElementById('srcSel') as HTMLSelectElement;
      const dstSel = document.getElementById('dstSel') as HTMLSelectElement;

      expect(srcSel.value).toBe('ohio-state');
      expect(dstSel.value).toBe('georgia');
    });

    it('should use custom default selections', () => {
      const teams: Team[] = [
        { id: 'alabama', name: 'Alabama', conference: { id: 'sec' } },
        { id: 'michigan', name: 'Michigan', conference: { id: 'b1g' } },
        { id: 'texas', name: 'Texas', conference: { id: 'sec' } },
      ];

      buildSelectors(teams, 'srcSel', 'dstSel', {
        defaultSrc: 'alabama',
        defaultDst: 'texas',
        autoTrigger: false,
      });

      const srcSel = document.getElementById('srcSel') as HTMLSelectElement;
      const dstSel = document.getElementById('dstSel') as HTMLSelectElement;

      expect(srcSel.value).toBe('alabama');
      expect(dstSel.value).toBe('texas');
    });

    it('should handle missing selectors gracefully', () => {
      const teams: Team[] = [];
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      buildSelectors(teams, 'nonexistent1', 'nonexistent2', { autoTrigger: false });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Selector elements not found')
      );
      consoleSpy.mockRestore();
    });

    it('should auto-trigger button click when enabled', () => {
      vi.useFakeTimers();

      const teams: Team[] = [{ id: 'ohio-state', name: 'Ohio State', conference: { id: 'b1g' } }];

      const btn = document.getElementById('pathBtn') as HTMLButtonElement;
      const clickSpy = vi.spyOn(btn, 'click');

      buildSelectors(teams, 'srcSel', 'dstSel', { autoTrigger: true });

      vi.advanceTimersByTime(100);

      expect(clickSpy).toHaveBeenCalled();

      vi.useRealTimers();
      clickSpy.mockRestore();
    });

    it('should not auto-trigger when disabled', () => {
      vi.useFakeTimers();

      const teams: Team[] = [{ id: 'ohio-state', name: 'Ohio State', conference: { id: 'b1g' } }];

      const btn = document.getElementById('pathBtn') as HTMLButtonElement;
      const clickSpy = vi.spyOn(btn, 'click');

      buildSelectors(teams, 'srcSel', 'dstSel', { autoTrigger: false });

      vi.advanceTimersByTime(100);

      expect(clickSpy).not.toHaveBeenCalled();

      vi.useRealTimers();
      clickSpy.mockRestore();
    });
  });
});
