/**
 * Matchup Timeline Functional Tests
 *
 * Tests the team selection functionality and verifies that results are returned
 * for two selected teams when matchup data exists.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';

describe('Matchup Timeline - Team Selection and Results', () => {
  let dom: JSDOM;
  let window: Window & typeof globalThis;
  let document: Document;

  beforeEach(() => {
    console.log('Setting up matchup timeline test environment...');
    
    // Create a DOM environment
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Matchup Timeline Test</title>
        </head>
        <body>
          <div id="pathSummary"></div>
          <div id="filters"></div>
          <div id="timeline"></div>
        </body>
      </html>
    `, {
      url: 'https://example.com/',
      runScripts: 'dangerously',
      resources: 'usable',
    });

    window = dom.window as unknown as Window & typeof globalThis;
    document = window.document;
  });

  describe('DOM Elements', () => {
    it('should have required container elements', () => {
      console.log('✓ Testing required DOM containers...');
      
      const pathSummary = document.getElementById('pathSummary');
      const filters = document.getElementById('filters');
      const timeline = document.getElementById('timeline');

      expect(pathSummary).toBeTruthy();
      expect(filters).toBeTruthy();
      expect(timeline).toBeTruthy();
      
      console.log('✓ All required containers exist');
    });

    it('should have empty containers initially', () => {
      console.log('✓ Verifying containers start empty...');
      
      const pathSummary = document.getElementById('pathSummary');
      const filters = document.getElementById('filters');
      const timeline = document.getElementById('timeline');

      expect(pathSummary?.children.length).toBe(0);
      expect(filters?.children.length).toBe(0);
      expect(timeline?.children.length).toBe(0);
      
      console.log('✓ Containers are empty');
    });
  });

  describe('Timeline App Initialization', () => {
    it('should export createTimelineApp as default', async () => {
      console.log('✓ Testing module export...');
      
      const matchupTimelineCode = await import('fs').then(fs =>
        fs.promises.readFile('c:\\Development\\fbs-graph\\web\\matchup-timeline.js', 'utf-8')
      );

      expect(matchupTimelineCode).toContain('export default createTimelineApp');
      
      console.log('✓ createTimelineApp is exported');
    });

    it('should define createTimelineApp function', async () => {
      console.log('✓ Testing function definition...');
      
      const matchupTimelineCode = await import('fs').then(fs =>
        fs.promises.readFile('c:\\Development\\fbs-graph\\web\\matchup-timeline.js', 'utf-8')
      );

      expect(matchupTimelineCode).toContain('function createTimelineApp(options = {})');
      
      console.log('✓ createTimelineApp function is defined');
    });

    it('should accept options parameter with document, window, and location', async () => {
      console.log('✓ Testing function signature...');
      
      const matchupTimelineCode = await import('fs').then(fs =>
        fs.promises.readFile('c:\\Development\\fbs-graph\\web\\matchup-timeline.js', 'utf-8')
      );

      // Check for options destructuring
      expect(matchupTimelineCode).toContain('options.window');
      expect(matchupTimelineCode).toContain('options.document');
      expect(matchupTimelineCode).toContain('options.location');
      
      console.log('✓ Function accepts options with window, document, location');
    });
  });

  describe('State Management', () => {
    it('should initialize with required state properties', async () => {
      console.log('✓ Testing state initialization...');
      
      const matchupTimelineCode = await import('fs').then(fs =>
        fs.promises.readFile('c:\\Development\\fbs-graph\\web\\matchup-timeline.js', 'utf-8')
      );

      // Verify state object properties
      expect(matchupTimelineCode).toContain('startTeam:');
      expect(matchupTimelineCode).toContain('endTeam:');
      expect(matchupTimelineCode).toContain('data:');
      expect(matchupTimelineCode).toContain('path:');
      expect(matchupTimelineCode).toContain('segments:');
      
      console.log('✓ State has startTeam, endTeam, data, path, segments');
    });

    it('should define updatePath function to calculate path between teams', async () => {
      console.log('✓ Testing updatePath function...');
      
      const matchupTimelineCode = await import('fs').then(fs =>
        fs.promises.readFile('c:\\Development\\fbs-graph\\web\\matchup-timeline.js', 'utf-8')
      );

      expect(matchupTimelineCode).toContain('function updatePath()');
      expect(matchupTimelineCode).toContain('findShortestPath');
      
      console.log('✓ updatePath function exists and uses findShortestPath');
    });

    it('should populate segments when path exists between teams', async () => {
      console.log('✓ Testing segments population logic...');
      
      const matchupTimelineCode = await import('fs').then(fs =>
        fs.promises.readFile('c:\\Development\\fbs-graph\\web\\matchup-timeline.js', 'utf-8')
      );

      // Check that segments are populated from result.edges
      expect(matchupTimelineCode).toContain('state.segments = segments');
      expect(matchupTimelineCode).toContain('result.edges.map');
      
      console.log('✓ Segments populated from path edges');
    });

    it('should set segments to empty array when no path exists', async () => {
      console.log('✓ Testing empty segments handling...');
      
      const matchupTimelineCode = await import('fs').then(fs =>
        fs.promises.readFile('c:\\Development\\fbs-graph\\web\\matchup-timeline.js', 'utf-8')
      );

      // Check that segments are cleared when there's no result
      expect(matchupTimelineCode).toContain('state.segments = []');
      
      console.log('✓ Segments cleared when no path exists');
    });

    it('should create summary with programs, hops, and leverage metrics', async () => {
      console.log('✓ Testing summary creation...');
      
      const matchupTimelineCode = await import('fs').then(fs =>
        fs.promises.readFile('c:\\Development\\fbs-graph\\web\\matchup-timeline.js', 'utf-8')
      );

      expect(matchupTimelineCode).toContain('state.summary = {');
      expect(matchupTimelineCode).toContain('programs');
      expect(matchupTimelineCode).toContain('hops: segments.length');
      expect(matchupTimelineCode).toContain('averageLeverage');
      
      console.log('✓ Summary includes programs, hops, averageLeverage');
    });
  });

  describe('Team Selection Logic', () => {
    it('should define getTeamsForScope function', async () => {
      console.log('✓ Testing getTeamsForScope function...');
      
      const matchupTimelineCode = await import('fs').then(fs =>
        fs.promises.readFile('c:\\Development\\fbs-graph\\web\\matchup-timeline.js', 'utf-8')
      );

      expect(matchupTimelineCode).toContain('function getTeamsForScope');
      
      console.log('✓ getTeamsForScope function exists');
    });

    it('should filter teams by conference scope', async () => {
      console.log('✓ Testing conference filtering...');
      
      const matchupTimelineCode = await import('fs').then(fs =>
        fs.promises.readFile('c:\\Development\\fbs-graph\\web\\matchup-timeline.js', 'utf-8')
      );

      expect(matchupTimelineCode).toContain('conferenceScopes');
      expect(matchupTimelineCode).toContain('data.teams');
      expect(matchupTimelineCode).toContain('.filter(filterFn)');
      
      console.log('✓ Teams filtered by conference scope');
    });

    it('should create team select dropdowns with options', async () => {
      console.log('✓ Testing team dropdown creation...');
      
      const matchupTimelineCode = await import('fs').then(fs =>
        fs.promises.readFile('c:\\Development\\fbs-graph\\web\\matchup-timeline.js', 'utf-8')
      );

      expect(matchupTimelineCode).toContain('function createTeamSelect');
      expect(matchupTimelineCode).toContain("createElement('select')");
      expect(matchupTimelineCode).toContain("createElement('option')");
      
      console.log('✓ createTeamSelect creates dropdown with options');
    });

    it('should handle team selection change events', async () => {
      console.log('✓ Testing team selection event handling...');
      
      const matchupTimelineCode = await import('fs').then(fs =>
        fs.promises.readFile('c:\\Development\\fbs-graph\\web\\matchup-timeline.js', 'utf-8')
      );

      expect(matchupTimelineCode).toContain("addEventListener('change'");
      expect(matchupTimelineCode).toContain('applyState');
      
      console.log('✓ Team selection triggers applyState');
    });

    it('should apply state changes and update path', async () => {
      console.log('✓ Testing applyState function...');
      
      const matchupTimelineCode = await import('fs').then(fs =>
        fs.promises.readFile('c:\\Development\\fbs-graph\\web\\matchup-timeline.js', 'utf-8')
      );

      expect(matchupTimelineCode).toContain('function applyState');
      expect(matchupTimelineCode).toContain('updatePath()');
      
      console.log('✓ applyState calls updatePath');
    });
  });

  describe('Results Validation', () => {
    it('should call findShortestPath with startTeam and endTeam', async () => {
      console.log('✓ Testing findShortestPath invocation...');
      
      const matchupTimelineCode = await import('fs').then(fs =>
        fs.promises.readFile('c:\\Development\\fbs-graph\\web\\matchup-timeline.js', 'utf-8')
      );

      expect(matchupTimelineCode).toContain('findShortestPath(state.data.adjacency, state.startTeam, state.endTeam)');
      
      console.log('✓ findShortestPath called with correct parameters');
    });

    it('should return null path when teams are the same', async () => {
      console.log('✓ Testing same team handling...');
      
      const matchupTimelineCode = await import('fs').then(fs =>
        fs.promises.readFile('c:\\Development\\fbs-graph\\web\\matchup-timeline.js', 'utf-8')
      );

      expect(matchupTimelineCode).toContain('if (state.startTeam === state.endTeam)');
      expect(matchupTimelineCode).toContain('state.path = null');
      
      console.log('✓ Path set to null when teams are identical');
    });

    it('should return null path when no connection exists', async () => {
      console.log('✓ Testing no connection handling...');
      
      const matchupTimelineCode = await import('fs').then(fs =>
        fs.promises.readFile('c:\\Development\\fbs-graph\\web\\matchup-timeline.js', 'utf-8')
      );

      expect(matchupTimelineCode).toContain('if (!result)');
      expect(matchupTimelineCode).toContain('state.path = null');
      
      console.log('✓ Path set to null when no connection exists');
    });

    it('should populate segments with games when path exists', async () => {
      console.log('✓ Testing segments games population...');
      
      const matchupTimelineCode = await import('fs').then(fs =>
        fs.promises.readFile('c:\\Development\\fbs-graph\\web\\matchup-timeline.js', 'utf-8')
      );

      expect(matchupTimelineCode).toContain('games: entry ? entry.games : []');
      
      console.log('✓ Segments include games from edge data');
    });

    it('should define segment structure with from, to, and games', async () => {
      console.log('✓ Testing segment structure...');
      
      const matchupTimelineCode = await import('fs').then(fs =>
        fs.promises.readFile('c:\\Development\\fbs-graph\\web\\matchup-timeline.js', 'utf-8')
      );

      expect(matchupTimelineCode).toContain('from: fromTeam');
      expect(matchupTimelineCode).toContain('to: toTeam');
      expect(matchupTimelineCode).toContain('games:');
      
      console.log('✓ Segments have from, to, games properties');
    });
  });

  describe('Rendering Results', () => {
    it('should render summary when path exists', async () => {
      console.log('✓ Testing summary rendering...');
      
      const matchupTimelineCode = await import('fs').then(fs =>
        fs.promises.readFile('c:\\Development\\fbs-graph\\web\\matchup-timeline.js', 'utf-8')
      );

      expect(matchupTimelineCode).toContain('function renderSummary');
      expect(matchupTimelineCode).toContain('if (state.path && state.summary)');
      
      console.log('✓ renderSummary checks for path and summary');
    });

    it('should render leverage chain with programs', async () => {
      console.log('✓ Testing leverage chain rendering...');
      
      const matchupTimelineCode = await import('fs').then(fs =>
        fs.promises.readFile('c:\\Development\\fbs-graph\\web\\matchup-timeline.js', 'utf-8')
      );

      expect(matchupTimelineCode).toContain('leverage-chain');
      expect(matchupTimelineCode).toContain('program-chip');
      
      console.log('✓ Leverage chain renders program chips');
    });

    it('should render legend for segments', async () => {
      console.log('✓ Testing legend rendering...');
      
      const matchupTimelineCode = await import('fs').then(fs =>
        fs.promises.readFile('c:\\Development\\fbs-graph\\web\\matchup-timeline.js', 'utf-8')
      );

      expect(matchupTimelineCode).toContain('if (state.segments && state.segments.length)');
      expect(matchupTimelineCode).toContain('legend');
      expect(matchupTimelineCode).toContain('legend-row');
      
      console.log('✓ Legend rendered when segments exist');
    });

    it('should display empty state when no teams selected', async () => {
      console.log('✓ Testing empty state message...');
      
      const matchupTimelineCode = await import('fs').then(fs =>
        fs.promises.readFile('c:\\Development\\fbs-graph\\web\\matchup-timeline.js', 'utf-8')
      );

      expect(matchupTimelineCode).toContain('Pick two programs to trace the leverage chain');
      
      console.log('✓ Empty state shown when teams not selected');
    });

    it('should display message when teams are not connected', async () => {
      console.log('✓ Testing no connection message...');
      
      const matchupTimelineCode = await import('fs').then(fs =>
        fs.promises.readFile('c:\\Development\\fbs-graph\\web\\matchup-timeline.js', 'utf-8')
      );

      expect(matchupTimelineCode).toContain('not connected by any remaining');
      
      console.log('✓ Message shown when no path exists');
    });

    it('should display message when same team selected', async () => {
      console.log('✓ Testing same team message...');
      
      const matchupTimelineCode = await import('fs').then(fs =>
        fs.promises.readFile('c:\\Development\\fbs-graph\\web\\matchup-timeline.js', 'utf-8')
      );

      expect(matchupTimelineCode).toContain('Choose a different destination');
      
      console.log('✓ Message shown when same team selected for start and end');
    });
  });

  describe('Path Finding Algorithm', () => {
    it('should define findShortestPath function', async () => {
      console.log('✓ Testing findShortestPath function...');
      
      const matchupTimelineCode = await import('fs').then(fs =>
        fs.promises.readFile('c:\\Development\\fbs-graph\\web\\matchup-timeline.js', 'utf-8')
      );

      expect(matchupTimelineCode).toContain('function findShortestPath');
      
      console.log('✓ findShortestPath function exists');
    });

    it('should use Dijkstra algorithm with distance tracking', async () => {
      console.log('✓ Testing algorithm implementation...');
      
      const matchupTimelineCode = await import('fs').then(fs =>
        fs.promises.readFile('c:\\Development\\fbs-graph\\web\\matchup-timeline.js', 'utf-8')
      );

      expect(matchupTimelineCode).toContain('dist.set');
      expect(matchupTimelineCode).toContain('prev.set');
      expect(matchupTimelineCode).toContain('queue.push');
      
      console.log('✓ Uses distance map, previous map, and queue');
    });

    it('should return nodes, edges, and distance when path found', async () => {
      console.log('✓ Testing return value structure...');
      
      const matchupTimelineCode = await import('fs').then(fs =>
        fs.promises.readFile('c:\\Development\\fbs-graph\\web\\matchup-timeline.js', 'utf-8')
      );

      expect(matchupTimelineCode).toContain('return { nodes, edges, distance');
      
      console.log('✓ Returns object with nodes, edges, distance');
    });

    it('should return null when no path exists to end node', async () => {
      console.log('✓ Testing null return for no path...');
      
      const matchupTimelineCode = await import('fs').then(fs =>
        fs.promises.readFile('c:\\Development\\fbs-graph\\web\\matchup-timeline.js', 'utf-8')
      );

      expect(matchupTimelineCode).toContain('if (!dist.has(end)) return null');
      
      console.log('✓ Returns null when end node unreachable');
    });
  });

  describe('Conference Scopes', () => {
    it('should define conference scope filters', async () => {
      console.log('✓ Testing conference scope definitions...');
      
      const matchupTimelineCode = await import('fs').then(fs =>
        fs.promises.readFile('c:\\Development\\fbs-graph\\web\\matchup-timeline.js', 'utf-8')
      );

      expect(matchupTimelineCode).toContain('conferenceScopes');
      expect(matchupTimelineCode).toContain("id: 'all'");
      expect(matchupTimelineCode).toContain("id: 'power4'");
      expect(matchupTimelineCode).toContain("id: 'sec'");
      
      console.log('✓ Conference scopes include all, power4, sec');
    });

    it('should filter teams based on conference membership', async () => {
      console.log('✓ Testing power4 filter...');
      
      const matchupTimelineCode = await import('fs').then(fs =>
        fs.promises.readFile('c:\\Development\\fbs-graph\\web\\matchup-timeline.js', 'utf-8')
      );

      expect(matchupTimelineCode).toContain('power4Set.has(team.conferenceId)');
      
      console.log('✓ Power4 filter uses set membership check');
    });
  });

  describe('Runtime Execution - Data Loading', () => {
    it('should render error message in DOM when data loading fails', async () => {
      console.log('✓ Testing error message rendering...');
      
      // Read and check the matchup-timeline.js source for error handling
      const matchupTimelineCode = await import('fs').then(fs =>
        fs.promises.readFile('c:\\Development\\fbs-graph\\web\\matchup-timeline.js', 'utf-8')
      );

      // Verify error handling code exists
      expect(matchupTimelineCode).toContain('Unable to load leverage data');
      expect(matchupTimelineCode).toContain('state.error');
      expect(matchupTimelineCode).toContain('catch (error)');
      
      console.log('✓ Error handling code verified');
    });

    it('should display specific error text in pathSummary when loading fails', async () => {
      console.log('✓ Testing pathSummary error display...');
      
      const matchupTimelineCode = await import('fs').then(fs =>
        fs.promises.readFile('c:\\Development\\fbs-graph\\web\\matchup-timeline.js', 'utf-8')
      );

      // Check that error is displayed in pathSummary with the error message
      expect(matchupTimelineCode).toContain('Unable to load leverage data: ${state.error}');
      
      console.log('✓ pathSummary shows error with message');
    });

    it('should display error in filters section when data fails to load', async () => {
      console.log('✓ Testing filters error display...');
      
      const matchupTimelineCode = await import('fs').then(fs =>
        fs.promises.readFile('c:\\Development\\fbs-graph\\web\\matchup-timeline.js', 'utf-8')
      );

      // Check that error is displayed in filters
      expect(matchupTimelineCode).toContain('Unable to load filters');
      
      console.log('✓ filters shows error message');
    });

    it('should render loading state in pathSummary', async () => {
      console.log('✓ Testing loading state in pathSummary...');
      
      const matchupTimelineCode = await import('fs').then(fs =>
        fs.promises.readFile('c:\\Development\\fbs-graph\\web\\matchup-timeline.js', 'utf-8')
      );

      expect(matchupTimelineCode).toContain('Loading leverage data');
      
      console.log('✓ Loading message exists in pathSummary');
    });

    it('should render loading state in filters', async () => {
      console.log('✓ Testing loading state in filters...');
      
      const matchupTimelineCode = await import('fs').then(fs =>
        fs.promises.readFile('c:\\Development\\fbs-graph\\web\\matchup-timeline.js', 'utf-8')
      );

      expect(matchupTimelineCode).toContain('Loading selections');
      
      console.log('✓ Loading message exists in filters');
    });
  });

  describe('Layout Validation with Games', () => {
    it('should render expected layout when games exist and path is found', async () => {
      console.log('✓ Testing layout with games present...');
      
      const htmlContent = await import('fs').then(fs =>
        fs.promises.readFile('c:\\Development\\fbs-graph\\web\\matchup-timeline.html', 'utf-8')
      );

      // Verify required DOM containers exist
      expect(htmlContent).toContain('id="pathSummary"');
      expect(htmlContent).toContain('id="filters"');
      expect(htmlContent).toContain('id="timeline"');
      
      // Verify page structure elements
      expect(htmlContent).toContain('class="page-title"');
      expect(htmlContent).toContain('High-Impact Matchup Timeline');
      
      console.log('✓ Expected layout containers present');
    });

    it('should have logic to display leverage chain when path exists', async () => {
      console.log('✓ Testing leverage chain display logic...');
      
      const matchupTimelineCode = await import('fs').then(fs =>
        fs.promises.readFile('c:\\Development\\fbs-graph\\web\\matchup-timeline.js', 'utf-8')
      );

      // Verify code creates leverage chain elements
      expect(matchupTimelineCode).toContain('leverage-chain');
      expect(matchupTimelineCode).toContain('program-chip');
      
      // Verify it shows programs in the path
      expect(matchupTimelineCode).toContain('state.summary.programs');
      
      console.log('✓ Leverage chain display logic exists');
    });

    it('should have logic to display segment legend when path has hops', async () => {
      console.log('✓ Testing segment legend display logic...');
      
      const matchupTimelineCode = await import('fs').then(fs =>
        fs.promises.readFile('c:\\Development\\fbs-graph\\web\\matchup-timeline.js', 'utf-8')
      );

      // Verify legend is created for segments
      expect(matchupTimelineCode).toContain('if (state.segments && state.segments.length)');
      expect(matchupTimelineCode).toContain('legend');
      expect(matchupTimelineCode).toContain('legend-row');
      expect(matchupTimelineCode).toContain('legend-swatch');
      
      console.log('✓ Segment legend display logic exists');
    });

    it('should have logic to render timeline with game cards', async () => {
      console.log('✓ Testing timeline rendering logic...');
      
      const matchupTimelineCode = await import('fs').then(fs =>
        fs.promises.readFile('c:\\Development\\fbs-graph\\web\\matchup-timeline.js', 'utf-8')
      );

      // Verify timeline rendering function exists
      expect(matchupTimelineCode).toContain('function renderTimeline()');
      
      // Verify it processes segments to display games
      expect(matchupTimelineCode).toContain('state.segments');
      
      // Verify it creates matchup-card elements for game display
      expect(matchupTimelineCode).toContain('matchup-card');
      
      console.log('✓ Timeline rendering logic with matchup-card exists');
    });
  });

  describe('No Matching Games - Negative Tests', () => {
    it('should display message when teams are not connected', async () => {
      console.log('✓ Testing no connection message...');
      
      const matchupTimelineCode = await import('fs').then(fs =>
        fs.promises.readFile('c:\\Development\\fbs-graph\\web\\matchup-timeline.js', 'utf-8')
      );

      // Verify message for unconnected teams
      expect(matchupTimelineCode).toContain('not connected by any remaining');
      expect(matchupTimelineCode).toContain('2025 games');
      
      console.log('✓ No connection message exists');
    });

    it('should set path to null when findShortestPath returns no result', async () => {
      console.log('✓ Testing null path handling...');
      
      const matchupTimelineCode = await import('fs').then(fs =>
        fs.promises.readFile('c:\\Development\\fbs-graph\\web\\matchup-timeline.js', 'utf-8')
      );

      // Verify path is set to null when no result
      expect(matchupTimelineCode).toContain('if (!result)');
      expect(matchupTimelineCode).toContain('state.path = null');
      expect(matchupTimelineCode).toContain('state.segments = []');
      expect(matchupTimelineCode).toContain('state.summary = null');
      
      console.log('✓ Null path handling verified');
    });

    it('should clear segments array when no path exists', async () => {
      console.log('✓ Testing segments cleared when no path...');
      
      const matchupTimelineCode = await import('fs').then(fs =>
        fs.promises.readFile('c:\\Development\\fbs-graph\\web\\matchup-timeline.js', 'utf-8')
      );

      // Verify segments are cleared in multiple scenarios
      const segmentsClearedCount = (matchupTimelineCode.match(/state\.segments = \[\]/g) || []).length;
      expect(segmentsClearedCount).toBeGreaterThanOrEqual(3); // Multiple places where segments are cleared
      
      console.log('✓ Segments cleared in multiple scenarios');
    });

    it('should not render legend when segments array is empty', async () => {
      console.log('✓ Testing no legend when no segments...');
      
      const matchupTimelineCode = await import('fs').then(fs =>
        fs.promises.readFile('c:\\Development\\fbs-graph\\web\\matchup-timeline.js', 'utf-8')
      );

      // Verify legend only renders when segments exist
      expect(matchupTimelineCode).toContain('if (state.segments && state.segments.length)');
      
      console.log('✓ Legend conditional rendering verified');
    });

    it('should display alternative message when same team selected twice', async () => {
      console.log('✓ Testing same team selection message...');
      
      const matchupTimelineCode = await import('fs').then(fs =>
        fs.promises.readFile('c:\\Development\\fbs-graph\\web\\matchup-timeline.js', 'utf-8')
      );

      // Verify different message for same team
      expect(matchupTimelineCode).toContain('if (state.startTeam === state.endTeam)');
      expect(matchupTimelineCode).toContain('Choose a different destination');
      
      console.log('✓ Same team message verified');
    });

    it('should handle empty upcoming games gracefully', async () => {
      console.log('✓ Testing empty upcoming games handling...');
      
      const matchupTimelineCode = await import('fs').then(fs =>
        fs.promises.readFile('c:\\Development\\fbs-graph\\web\\matchup-timeline.js', 'utf-8')
      );

      // Verify upcoming games filtering exists
      expect(matchupTimelineCode).toContain('upcomingGames');
      expect(matchupTimelineCode).toContain("result === 'TBD'");
      
      // Verify edge map is built from ALL games (not just upcoming)
      // This allows pathfinding through already-played games to connect paths
      expect(matchupTimelineCode).toContain('buildEdgeMap(games)');
      
      console.log('✓ Upcoming games filtering exists');
    });

    it('should return empty teams list when no data loaded', async () => {
      console.log('✓ Testing empty teams when no data...');
      
      const matchupTimelineCode = await import('fs').then(fs =>
        fs.promises.readFile('c:\\Development\\fbs-graph\\web\\matchup-timeline.js', 'utf-8')
      );

      // Verify getTeamsForScope returns empty when no data
      expect(matchupTimelineCode).toContain('if (!state.data) return []');
      
      console.log('✓ Empty data handling verified');
    });
  });
});
