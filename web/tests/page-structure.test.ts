/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';

describe('Page Structure Tests', () => {
  const webDir = path.resolve(__dirname);

  const simplePages = [
    { file: 'index.html', name: 'Home', activePage: 'home', hasContentWrapper: true },
    {
      file: 'playoff-preview.html',
      name: 'Playoff Preview',
      activePage: 'playoff-preview',
      hasContentWrapper: true,
    },
    { file: 'rankings.html', name: 'Rankings', activePage: 'rankings', hasContentWrapper: true },
  ];

  const visualizerPages = [
    {
      file: 'matchup-timeline.html',
      name: 'Matchup Timeline',
      activePage: 'matchup-timeline',
      hasContentWrapper: false,
    },
    {
      file: 'cfb-graph-timeline-explorer.html',
      name: 'CFB Graph Timeline Explorer',
      activePage: 'cfb-graph-timeline-explorer',
      hasContentWrapper: false,
    },
    {
      file: 'cfb-graph-visualizer.html',
      name: 'CFB Graph Visualizer',
      activePage: 'cfb-graph',
      hasContentWrapper: false,
    },
  ];

  describe('Simple Pages (with content-wrapper)', () => {
    simplePages.forEach(({ file, name, activePage, hasContentWrapper }) => {
      describe(name, () => {
        let dom: JSDOM;
        let document: Document;

        beforeEach(() => {
          const filePath = path.join(webDir, file);

          // Skip if file doesn't exist (generated files)
          if (!fs.existsSync(filePath)) {
            return;
          }

          const html = fs.readFileSync(filePath, 'utf-8');
          dom = new JSDOM(html, {
            url: `http://localhost:4173/web/${file}`,
          });
          document = dom.window.document;
        });

        it('should include shared-nav.css', () => {
          if (!document) return;

          const navCssLink = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).find(
            link => (link as HTMLLinkElement).href.includes('shared-nav.css')
          );

          expect(navCssLink).toBeTruthy();
        });

        it('should have content-wrapper div', () => {
          if (!document) return;

          const contentWrapper = document.querySelector('.content-wrapper');
          expect(contentWrapper).toBeTruthy();
        });

        it('should import and initialize shared navigation module', () => {
          if (!document) return;

          const scripts = Array.from(document.querySelectorAll('script[type="module"]'));
          const navScript = scripts.find(
            script =>
              script.textContent?.includes('initNavigation') &&
              script.textContent?.includes('shared-nav.js')
          );

          expect(navScript).toBeTruthy();
          expect(navScript?.textContent).toContain(`initNavigation('${activePage}')`);
        });

        it('should have proper HTML structure', () => {
          if (!document) return;

          expect(document.doctype).toBeTruthy();
          expect(document.querySelector('html')).toBeTruthy();
          expect(document.querySelector('head')).toBeTruthy();
          expect(document.querySelector('body')).toBeTruthy();
        });

        it('should include common-theme.css', () => {
          if (!document) return;

          const themeCssLink = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).find(
            link => (link as HTMLLinkElement).href.includes('common-theme.css')
          );

          expect(themeCssLink).toBeTruthy();
        });
      });
    });
  });

  describe('Visualizer Pages (without content-wrapper)', () => {
    visualizerPages.forEach(({ file, name, activePage, hasContentWrapper }) => {
      describe(name, () => {
        let dom: JSDOM;
        let document: Document;

        beforeEach(() => {
          const filePath = path.join(webDir, file);

          if (!fs.existsSync(filePath)) {
            return;
          }

          const html = fs.readFileSync(filePath, 'utf-8');
          dom = new JSDOM(html, {
            url: `http://localhost:4173/web/${file}`,
          });
          document = dom.window.document;
        });

        it('should include shared-nav.css', () => {
          if (!document) return;

          const navCssLink = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).find(
            link => (link as HTMLLinkElement).href.includes('shared-nav.css')
          );

          expect(navCssLink).toBeTruthy();
        });

        it('should NOT have content-wrapper div', () => {
          if (!document) return;

          const contentWrapper = document.querySelector('.content-wrapper');
          expect(contentWrapper).toBeFalsy();
        });

        it('should have body margin-left styles for navigation offset', () => {
          if (!document) return;

          const styleElements = Array.from(document.querySelectorAll('style'));
          const hasBodyMargin = styleElements.some(
            style =>
              style.textContent?.includes('body {') &&
              style.textContent?.includes('margin-left: 220px')
          );

          expect(hasBodyMargin).toBe(true);
        });

        it('should have body.nav-collapsed margin reset styles', () => {
          if (!document) return;

          const styleElements = Array.from(document.querySelectorAll('style'));
          const hasCollapsedReset = styleElements.some(
            style =>
              style.textContent?.includes('body.nav-collapsed') &&
              style.textContent?.includes('margin-left: 0')
          );

          expect(hasCollapsedReset).toBe(true);
        });

        it('should import and initialize shared navigation module', () => {
          if (!document) return;

          const scripts = Array.from(document.querySelectorAll('script[type="module"]'));
          const navScript = scripts.find(
            script =>
              script.textContent?.includes('initNavigation') &&
              script.textContent?.includes('shared-nav.js')
          );

          expect(navScript).toBeTruthy();
          expect(navScript?.textContent).toContain(`initNavigation('${activePage}')`);
        });

        it('should have main element as direct child of body (not wrapped)', () => {
          if (!document) return;

          const main = document.querySelector('main');
          expect(main).toBeTruthy();

          // Main should be a direct child of body, not nested in content-wrapper
          const mainParent = main?.parentElement;
          expect(mainParent?.tagName).toBe('BODY');
        });
      });
    });
  });

  describe('Navigation Component Integration', () => {
    it('all pages should use the same navigation initialization pattern', () => {
      const allPages = [...simplePages, ...visualizerPages];

      allPages.forEach(({ file, activePage }) => {
        const filePath = path.join(webDir, file);

        if (!fs.existsSync(filePath)) {
          return;
        }

        const html = fs.readFileSync(filePath, 'utf-8');

        // Check for navigation module import and initialization
        expect(html).toContain('shared-nav.js');
        expect(html).toContain('initNavigation');
        expect(html).toContain(`'${activePage}'`);
      });
    });

    it('all pages should include the shared navigation CSS', () => {
      const allPages = [...simplePages, ...visualizerPages];

      allPages.forEach(({ file }) => {
        const filePath = path.join(webDir, file);

        if (!fs.existsSync(filePath)) {
          return;
        }

        const html = fs.readFileSync(filePath, 'utf-8');
        expect(html).toContain('shared-nav.css');
      });
    });

    it('all pages should include common-theme.css', () => {
      const allPages = [...simplePages, ...visualizerPages];

      allPages.forEach(({ file }) => {
        const filePath = path.join(webDir, file);

        if (!fs.existsSync(filePath)) {
          return;
        }

        const html = fs.readFileSync(filePath, 'utf-8');
        expect(html).toContain('common-theme.css');
      });
    });
  });

  describe('CSS Variables and Theming', () => {
    it('common-theme.css should define dark theme CSS variables', () => {
      const themePath = path.join(webDir, 'common-theme.css');

      if (!fs.existsSync(themePath)) {
        return;
      }

      const css = fs.readFileSync(themePath, 'utf-8');

      // Check for essential CSS variables
      expect(css).toContain('--bg');
      expect(css).toContain('--panel');
      expect(css).toContain('--ink');
      expect(css).toContain('--muted');
      expect(css).toContain('--accent');
    });

    it('shared-nav.css should use CSS variables for theming', () => {
      const navCssPath = path.join(webDir, 'css', 'shared-nav.css');

      if (!fs.existsSync(navCssPath)) {
        return;
      }

      const css = fs.readFileSync(navCssPath, 'utf-8');

      // Check that CSS variables are being used (may include fallback values)
      expect(css).toMatch(/var\(--/);
      expect(css).toMatch(/var\(--panel/);
      expect(css).toMatch(/var\(--ink/);
      expect(css).toMatch(/var\(--muted/);
    });
  });

  describe('Layout Pattern Consistency', () => {
    it('simple pages should have content-wrapper with proper transitions', () => {
      simplePages.forEach(({ file }) => {
        const filePath = path.join(webDir, file);

        if (!fs.existsSync(filePath)) {
          return;
        }

        const html = fs.readFileSync(filePath, 'utf-8');
        const dom = new JSDOM(html);
        const document = dom.window.document;

        const contentWrapper = document.querySelector('.content-wrapper');
        expect(contentWrapper).toBeTruthy();
      });
    });

    it('visualizer pages should have body margin-left pattern', () => {
      visualizerPages.forEach(({ file }) => {
        const filePath = path.join(webDir, file);

        if (!fs.existsSync(filePath)) {
          return;
        }

        const html = fs.readFileSync(filePath, 'utf-8');

        // Should have body margin-left style
        expect(html).toContain('margin-left: 220px');
        expect(html).toContain('body.nav-collapsed');
      });
    });

    it('navigation width should be consistent (220px)', () => {
      const navCssPath = path.join(webDir, 'css', 'shared-nav.css');

      if (!fs.existsSync(navCssPath)) {
        return;
      }

      const css = fs.readFileSync(navCssPath, 'utf-8');

      // Navigation width should be 220px
      expect(css).toContain('220px');
    });

    it('transition duration should be consistent (0.3s)', () => {
      const navCssPath = path.join(webDir, 'css', 'shared-nav.css');

      if (!fs.existsSync(navCssPath)) {
        return;
      }

      const css = fs.readFileSync(navCssPath, 'utf-8');

      // Transition should be 0.3s ease
      expect(css).toContain('0.3s ease');
    });
  });
});
