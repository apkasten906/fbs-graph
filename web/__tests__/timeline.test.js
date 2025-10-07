import { describe, it, expect, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { createTimelineApp } from '../matchup-timeline.js';

function buildDom() {
  const dom = new JSDOM(
    `<!DOCTYPE html><body>
      <main>
        <section id="pathSummary"></section>
        <section id="filters"></section>
        <section id="timeline"></section>
      </main>
    </body>`,
    { url: 'http://localhost/web/matchup-timeline.html' }
  );
  return dom;
}

function createSampleData() {
  const conferences = [
    { id: 'sec', name: 'Southeastern Conference', shortName: 'SEC' },
    { id: 'acc', name: 'Atlantic Coast Conference', shortName: 'ACC' },
  ];
  const teams = [
    { id: 'alabama', name: 'Alabama', conferenceId: 'sec' },
    { id: 'georgia', name: 'Georgia', conferenceId: 'sec' },
    { id: 'clemson', name: 'Clemson', conferenceId: 'acc' },
  ];
  const teamSeasons = teams.map(team => ({
    id: `${team.id}-2025`,
    teamId: team.id,
    season: 2025,
    spPlus: 28,
  }));
  const polls = [];
  const games = [
    {
      id: '2025-week1-alabama-georgia',
      season: 2025,
      week: 1,
      phase: 'REGULAR',
      date: '2025-09-01T00:00:00Z',
      type: 'CONFERENCE',
      homeTeamId: 'alabama',
      awayTeamId: 'georgia',
      result: 'TBD',
    },
    {
      id: '2025-week5-georgia-clemson',
      season: 2025,
      week: 5,
      phase: 'REGULAR',
      date: '2025-10-01T00:00:00Z',
      type: 'NON_CONFERENCE',
      homeTeamId: 'georgia',
      awayTeamId: 'clemson',
      result: 'TBD',
    },
  ];
  return { conferences, teams, teamSeasons, polls, games };
}

describe('matchup timeline', () => {
  let dom;

  beforeEach(() => {
    dom = buildDom();
  });

  it('loads connections when teams are changed', async () => {
    const data = createSampleData();
    const app = createTimelineApp({
      window: dom.window,
      document: dom.window.document,
      loadData: async () => data,
    });

    await app.ready;

    const timelineBefore = Array.from(
      dom.window.document.querySelectorAll('.matchup-card')
    );
    expect(timelineBefore.length).toBeGreaterThan(0);

    const startSelect = dom.window.document.getElementById('startTeam');
    startSelect.value = 'georgia';
    startSelect.dispatchEvent(new dom.window.Event('change', { bubbles: true }));

    await Promise.resolve();

    const pathSummaryText = dom.window.document
      .getElementById('pathSummary')
      .textContent;
    expect(pathSummaryText).toContain('Georgia');
    expect(pathSummaryText).toContain('Clemson');

    const timelineAfter = Array.from(
      dom.window.document.querySelectorAll('.matchup-card')
    );
    expect(timelineAfter.length).toBeGreaterThan(0);
  });
});
