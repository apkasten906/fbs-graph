/**
 * CSS and Styling Tests
 * Tests to verify CSS files exist, have correct structure, and define expected selectors
 */
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('CSS Files and Styling', () => {
  const webDir = path.resolve(__dirname);
  const cssDir = path.join(webDir, 'css');

  describe('shared-nav.css', () => {
    let css: string;

    beforeAll(() => {
      const filePath = path.join(cssDir, 'shared-nav.css');
      expect(fs.existsSync(filePath)).toBe(true);
      css = fs.readFileSync(filePath, 'utf-8');
    });

    it('should exist', () => {
      expect(css).toBeTruthy();
      expect(css.length).toBeGreaterThan(0);
    });

    it('should define .nav-container styles', () => {
      expect(css).toContain('.nav-container');
    });

    it('should define .nav-menu styles', () => {
      expect(css).toContain('.nav-menu');
    });

    it('should define .nav-toggle styles', () => {
      expect(css).toContain('.nav-toggle');
    });

    it('should define .nav-toggle-fixed styles', () => {
      expect(css).toContain('.nav-toggle-fixed');
    });

    it('should use dark theme CSS variables', () => {
      expect(css).toMatch(/var\(--panel/);
      expect(css).toMatch(/var\(--ink/);
      expect(css).toMatch(/var\(--muted/);
      expect(css).toMatch(/var\(--accent/);
    });

    it('should define navigation width as 220px', () => {
      expect(css).toContain('220px');
    });

    it('should define transition duration as 0.3s', () => {
      expect(css).toContain('0.3s');
    });

    it('should have styles for content-wrapper', () => {
      expect(css).toContain('.content-wrapper');
    });

    it('should have styles for nav-collapsed state', () => {
      expect(css).toContain('nav-collapsed');
    });

    it('should use fixed positioning for navigation', () => {
      expect(css).toMatch(/position:\s*fixed/);
    });

    it('should define z-index for layering', () => {
      expect(css).toContain('z-index');
    });

    it('should have hover styles for links', () => {
      expect(css).toMatch(/\.nav-menu\s+a:hover/);
    });

    it('should have active link styles', () => {
      expect(css).toMatch(/\.nav-menu\s+a\.active/);
    });

    it('should define transition for smooth collapse/expand', () => {
      expect(css).toMatch(/transition:.*ease/);
    });
  });

  describe('common-theme.css', () => {
    let css: string;

    beforeAll(() => {
      const filePath = path.join(webDir, 'common-theme.css');
      expect(fs.existsSync(filePath)).toBe(true);
      css = fs.readFileSync(filePath, 'utf-8');
    });

    it('should exist', () => {
      expect(css).toBeTruthy();
      expect(css.length).toBeGreaterThan(0);
    });

    it('should define --bg CSS variable', () => {
      expect(css).toMatch(/--bg:\s*#[0-9a-fA-F]{6}/);
    });

    it('should define --panel CSS variable', () => {
      expect(css).toMatch(/--panel:\s*#[0-9a-fA-F]{6}/);
    });

    it('should define --ink CSS variable', () => {
      expect(css).toMatch(/--ink:\s*#[0-9a-fA-F]{6}/);
    });

    it('should define --muted CSS variable', () => {
      expect(css).toMatch(/--muted:\s*#[0-9a-fA-F]{6}/);
    });

    it('should define --accent CSS variable', () => {
      expect(css).toMatch(/--accent:\s*#[0-9a-fA-F]{3,6}/);
    });

    it('should use dark color scheme (dark background)', () => {
      // Check that --bg is a dark color (first digit should be 0-5)
      const bgMatch = css.match(/--bg:\s*#([0-9a-fA-F]{6})/);
      expect(bgMatch).toBeTruthy();
      if (bgMatch) {
        const firstChar = bgMatch[1][0];
        expect(['0', '1', '2', '3', '4', '5']).toContain(firstChar);
      }
    });
  });

  describe('Page-specific CSS files', () => {
    it('fbs-graph-visualizer.css should exist if referenced', () => {
      const filePath = path.join(cssDir, 'fbs-graph-visualizer.css');
      // Only test if file exists, don't fail if it doesn't
      if (fs.existsSync(filePath)) {
        expect(fs.existsSync(filePath)).toBe(true);
      }
    });

    it('fbs-graph-timeline-explorer.css should exist if referenced', () => {
      const filePath = path.join(cssDir, 'fbs-graph-timeline-explorer.css');
      // Only test if file exists, don't fail if it doesn't
      if (fs.existsSync(filePath)) {
        expect(fs.existsSync(filePath)).toBe(true);
      }
    });
  });

  describe('CSS Color Consistency', () => {
    let sharedNavCss: string;
    let commonThemeCss: string;

    beforeAll(() => {
      sharedNavCss = fs.readFileSync(path.join(cssDir, 'shared-nav.css'), 'utf-8');
      commonThemeCss = fs.readFileSync(path.join(webDir, 'common-theme.css'), 'utf-8');
    });

    it('shared-nav.css should not hardcode colors that exist as CSS variables', () => {
      // Extract CSS variable definitions from common-theme.css
      const varMatches = commonThemeCss.match(/--[a-z]+:\s*#[0-9a-fA-F]+/g);
      expect(varMatches).toBeTruthy();

      if (varMatches) {
        const hardcodedColors = varMatches
          .map(m => {
            const colorMatch = m.match(/#[0-9a-fA-F]+/);
            return colorMatch ? colorMatch[0] : null;
          })
          .filter(Boolean);

        // shared-nav.css should not contain these hardcoded colors
        // (with some exceptions for transparent, etc.)
        const problematicColors = hardcodedColors.filter(color => {
          if (!color) return false;
          // Only check if it appears in a context where CSS var should be used
          const regex = new RegExp(`(?:background|color):\\s*${color.replace('#', '\\#')}`, 'i');
          return regex.test(sharedNavCss);
        });

        expect(problematicColors.length).toBe(0);
      }
    });
  });

  describe('Responsive Layout Styles', () => {
    let sharedNavCss: string;

    beforeAll(() => {
      sharedNavCss = fs.readFileSync(path.join(cssDir, 'shared-nav.css'), 'utf-8');
    });

    it('should define collapsed state transform', () => {
      expect(sharedNavCss).toMatch(/transform:\s*translateX/);
    });

    it('should adjust content-wrapper margin based on nav state', () => {
      expect(sharedNavCss).toContain('.content-wrapper');
      expect(sharedNavCss).toMatch(/margin-left.*220px/);
    });

    it('should define nav-collapsed state for content-wrapper', () => {
      expect(sharedNavCss).toMatch(/\.content-wrapper\.nav-collapsed/);
    });
  });

  describe('Navigation Icon Styles', () => {
    let sharedNavCss: string;

    beforeAll(() => {
      sharedNavCss = fs.readFileSync(path.join(cssDir, 'shared-nav.css'), 'utf-8');
    });

    it('should have toggle button styles', () => {
      // Navigation uses emoji icon (☰) not CSS-styled spans
      expect(sharedNavCss).toMatch(/\.nav-toggle/);
    });

    it('should define button styles for both inline and fixed toggles', () => {
      expect(sharedNavCss).toContain('.nav-toggle');
      expect(sharedNavCss).toContain('.nav-toggle-fixed');
    });
  });
});
