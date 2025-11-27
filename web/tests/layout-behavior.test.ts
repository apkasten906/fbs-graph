/**
 * Layout Behavior Tests
 * Tests to verify UI components appear in correct positions and respond to user interactions
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Layout Pattern Validation', () => {
  const webDir = path.resolve(__dirname);

  describe('Content Wrapper Pattern (Simple Pages)', () => {
    const simplePages = ['index.html', 'playoff-preview.html', 'rankings.html'];

    simplePages.forEach(pageName => {
      it(`${pageName} should have content-wrapper div`, () => {
        const filePath = path.join(webDir, pageName);

        // Skip if file doesn't exist (generated files)
        if (!fs.existsSync(filePath)) {
          return;
        }

        const html = fs.readFileSync(filePath, 'utf-8');
        expect(html).toContain('class="content-wrapper"');
      });

      it(`${pageName} should NOT have body margin-left override`, () => {
        const filePath = path.join(webDir, pageName);

        if (!fs.existsSync(filePath)) {
          return;
        }

        const html = fs.readFileSync(filePath, 'utf-8');

        // Should not have inline body margin styles
        expect(html).not.toMatch(/<style>[\s\S]*body\s*{[\s\S]*margin-left:\s*220px/);
      });
    });
  });

  describe('Body Margin Pattern (Visualizer Pages)', () => {
    const visualizerPages = [
      'matchup-timeline.html',
      'cfb-graph-timeline-explorer.html',
      'cfb-graph-visualizer.html',
    ];

    visualizerPages.forEach(pageName => {
      it(`${pageName} should NOT have content-wrapper div`, () => {
        const filePath = path.join(webDir, pageName);

        if (!fs.existsSync(filePath)) {
          return;
        }

        const html = fs.readFileSync(filePath, 'utf-8');

        // Should not have content-wrapper div
        expect(html).not.toContain('<div class="content-wrapper">');
      });

      it(`${pageName} should have body margin-left override`, () => {
        const filePath = path.join(webDir, pageName);

        if (!fs.existsSync(filePath)) {
          return;
        }

        const html = fs.readFileSync(filePath, 'utf-8');

        // Should have body margin-left style
        expect(html).toMatch(/body\s*{[\s\S]*margin-left:\s*220px/);
      });

      it(`${pageName} should have body.nav-collapsed margin reset`, () => {
        const filePath = path.join(webDir, pageName);

        if (!fs.existsSync(filePath)) {
          return;
        }

        const html = fs.readFileSync(filePath, 'utf-8');

        // Should have collapsed state reset
        expect(html).toMatch(/body\.nav-collapsed\s*{[\s\S]*margin-left:\s*0/);
      });

      it(`${pageName} should have transition on body for smooth nav toggle`, () => {
        const filePath = path.join(webDir, pageName);

        if (!fs.existsSync(filePath)) {
          return;
        }

        const html = fs.readFileSync(filePath, 'utf-8');

        // Should have transition
        expect(html).toMatch(/body\s*{[\s\S]*transition:.*margin-left/);
      });
    });
  });

  describe('Navigation Module Integration', () => {
    const allPages = [
      'index.html',
      'playoff-preview.html',
      'rankings.html',
      'matchup-timeline.html',
      'cfb-graph-timeline-explorer.html',
      'cfb-graph-visualizer.html',
    ];

    const pageActiveMappings: Record<string, string> = {
      'index.html': 'home',
      'playoff-preview.html': 'playoff-preview',
      'rankings.html': 'rankings',
      'matchup-timeline.html': 'matchup-timeline',
      'cfb-graph-timeline-explorer.html': 'cfb-graph-timeline-explorer',
      'cfb-graph-visualizer.html': 'cfb-graph',
    };

    allPages.forEach(pageName => {
      it(`${pageName} should import shared-nav module`, () => {
        const filePath = path.join(webDir, pageName);

        if (!fs.existsSync(filePath)) {
          return;
        }

        const html = fs.readFileSync(filePath, 'utf-8');
        expect(html).toContain("from './modules/shared-nav.js'");
      });

      it(`${pageName} should call initNavigation with correct page identifier`, () => {
        const filePath = path.join(webDir, pageName);

        if (!fs.existsSync(filePath)) {
          return;
        }

        const html = fs.readFileSync(filePath, 'utf-8');
        const expectedActivePage = pageActiveMappings[pageName];

        expect(html).toContain(`initNavigation('${expectedActivePage}')`);
      });

      it(`${pageName} should use ES6 module script type`, () => {
        const filePath = path.join(webDir, pageName);

        if (!fs.existsSync(filePath)) {
          return;
        }

        const html = fs.readFileSync(filePath, 'utf-8');
        expect(html).toMatch(/<script type="module">[\s\S]*initNavigation/);
      });
    });
  });

  describe('CSS Link Order and Dependencies', () => {
    const allPages = [
      'index.html',
      'playoff-preview.html',
      'rankings.html',
      'matchup-timeline.html',
      'fbs-graph-timeline-explorer.html',
      'fbs-graph-visualizer.html',
    ];

    allPages.forEach(pageName => {
      it(`${pageName} should include common-theme.css before shared-nav.css`, () => {
        const filePath = path.join(webDir, pageName);

        if (!fs.existsSync(filePath)) {
          return;
        }

        const html = fs.readFileSync(filePath, 'utf-8');

        const themeIndex = html.indexOf('common-theme.css');
        const navIndex = html.indexOf('shared-nav.css');

        expect(themeIndex).toBeGreaterThan(-1);
        expect(navIndex).toBeGreaterThan(-1);
        expect(themeIndex).toBeLessThan(navIndex);
      });
    });
  });

  describe('DOM Structure Requirements', () => {
    it('visualizer pages should have main as direct body child', () => {
      const visualizerPages = [
        'matchup-timeline.html',
        'cfb-graph-timeline-explorer.html',
        'cfb-graph-visualizer.html',
      ];

      visualizerPages.forEach(pageName => {
        const filePath = path.join(webDir, pageName);

        if (!fs.existsSync(filePath)) {
          return;
        }

        const html = fs.readFileSync(filePath, 'utf-8');

        // Main should not be nested inside content-wrapper
        expect(html).not.toMatch(/<div class="content-wrapper">[\s\S]*<main/);
      });
    });

    it('simple pages should have content nested inside content-wrapper', () => {
      const simplePages = ['index.html', 'playoff-preview.html', 'rankings.html'];

      simplePages.forEach(pageName => {
        const filePath = path.join(webDir, pageName);

        if (!fs.existsSync(filePath)) {
          return;
        }

        const html = fs.readFileSync(filePath, 'utf-8');

        // Content should have content-wrapper div
        expect(html).toContain('<div class="content-wrapper">');
      });
    });
  });

  describe('Navigation Constants', () => {
    it('all pages should use 220px as navigation width', () => {
      const allPages = [
        'matchup-timeline.html',
        'fbs-graph-timeline-explorer.html',
        'fbs-graph-visualizer.html',
      ];

      allPages.forEach(pageName => {
        const filePath = path.join(webDir, pageName);

        if (!fs.existsSync(filePath)) {
          return;
        }

        const html = fs.readFileSync(filePath, 'utf-8');
        expect(html).toContain('220px');
      });
    });

    it('all pages should use 0.3s as transition duration', () => {
      const allPages = [
        'matchup-timeline.html',
        'fbs-graph-timeline-explorer.html',
        'fbs-graph-visualizer.html',
      ];

      allPages.forEach(pageName => {
        const filePath = path.join(webDir, pageName);

        if (!fs.existsSync(filePath)) {
          return;
        }

        const html = fs.readFileSync(filePath, 'utf-8');
        expect(html).toMatch(/0\.3s/);
      });
    });
  });

  describe('Accessibility and Semantic HTML', () => {
    const allPages = [
      'index.html',
      'playoff-preview.html',
      'rankings.html',
      'matchup-timeline.html',
      'fbs-graph-timeline-explorer.html',
      'fbs-graph-visualizer.html',
    ];

    allPages.forEach(pageName => {
      it(`${pageName} should have proper DOCTYPE`, () => {
        const filePath = path.join(webDir, pageName);

        if (!fs.existsSync(filePath)) {
          return;
        }

        const html = fs.readFileSync(filePath, 'utf-8');
        expect(html.trim()).toMatch(/^<!DOCTYPE html>/i);
      });

      it(`${pageName} should have html, head, and body elements`, () => {
        const filePath = path.join(webDir, pageName);

        if (!fs.existsSync(filePath)) {
          return;
        }

        const html = fs.readFileSync(filePath, 'utf-8');
        expect(html).toContain('<html');
        expect(html).toContain('<head>');
        expect(html).toContain('<body>');
      });

      it(`${pageName} should have a title element`, () => {
        const filePath = path.join(webDir, pageName);

        if (!fs.existsSync(filePath)) {
          return;
        }

        const html = fs.readFileSync(filePath, 'utf-8');
        expect(html).toMatch(/<title>[\s\S]*<\/title>/);
      });
    });
  });

  describe('Script Loading Order', () => {
    const allPages = [
      'index.html',
      'playoff-preview.html',
      'rankings.html',
      'matchup-timeline.html',
      'fbs-graph-timeline-explorer.html',
      'fbs-graph-visualizer.html',
    ];

    allPages.forEach(pageName => {
      it(`${pageName} should load navigation module after DOM content`, () => {
        const filePath = path.join(webDir, pageName);

        if (!fs.existsSync(filePath)) {
          return;
        }

        const html = fs.readFileSync(filePath, 'utf-8');

        // Navigation script should be at the end of body
        const bodyEndIndex = html.lastIndexOf('</body>');
        const navScriptIndex = html.indexOf('initNavigation');

        expect(navScriptIndex).toBeGreaterThan(-1);
        expect(navScriptIndex).toBeLessThan(bodyEndIndex);

        // Script should be near the end (within last 3000 characters before </body> to account for data loading scripts)
        // Pages with static data adapters (like matchup-timeline) have larger script blocks
        expect(bodyEndIndex - navScriptIndex).toBeLessThan(3000);
      });
    });
  });
});
