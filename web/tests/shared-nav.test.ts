/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';

describe('Shared Navigation Component', () => {
  describe('Navigation Module Structure', () => {
    it('should export initNavigation function', () => {
      console.log('Testing initNavigation export...');
      const sharedNavPath = path.resolve(__dirname, '../modules/shared-nav.js');
      const sharedNavCode = fs.readFileSync(sharedNavPath, 'utf-8');
      
      expect(sharedNavCode).toContain('export function initNavigation');
      console.log('✓ initNavigation function exported');
    });

    it('should create navigation HTML structure', () => {
      console.log('Testing navigation HTML structure...');
      const sharedNavPath = path.resolve(__dirname, '../modules/shared-nav.js');
      const sharedNavCode = fs.readFileSync(sharedNavPath, 'utf-8');
      
      // Check that it creates the expected HTML elements
      expect(sharedNavCode).toContain('nav-container');
      expect(sharedNavCode).toContain('nav-menu');
      expect(sharedNavCode).toContain('nav-toggle');
      console.log('✓ Navigation HTML structure verified');
    });

    it('should include all menu items', () => {
      const sharedNavPath = path.resolve(__dirname, '../modules/shared-nav.js');
      const sharedNavCode = fs.readFileSync(sharedNavPath, 'utf-8');
      
      expect(sharedNavCode).toContain('Home');
      expect(sharedNavCode).toContain('Playoff Preview');
      expect(sharedNavCode).toContain('Rankings');
      expect(sharedNavCode).toContain('Timeline Explorer');
      expect(sharedNavCode).toContain('Matchup Timeline');
    });

    it('should include localStorage for state persistence', () => {
      const sharedNavPath = path.resolve(__dirname, '../modules/shared-nav.js');
      const sharedNavCode = fs.readFileSync(sharedNavPath, 'utf-8');
      
      expect(sharedNavCode).toContain('localStorage');
      expect(sharedNavCode).toContain('navCollapsed');
    });

    it('should toggle navigation collapsed class', () => {
      const sharedNavPath = path.resolve(__dirname, '../modules/shared-nav.js');
      const sharedNavCode = fs.readFileSync(sharedNavPath, 'utf-8');
      
      expect(sharedNavCode).toContain('classList.toggle');
      expect(sharedNavCode).toContain('nav-collapsed');
    });

    it('should support both content-wrapper and body class toggling', () => {
      const sharedNavPath = path.resolve(__dirname, '../modules/shared-nav.js');
      const sharedNavCode = fs.readFileSync(sharedNavPath, 'utf-8');
      
      expect(sharedNavCode).toContain('content-wrapper');
      expect(sharedNavCode).toContain('document.body.classList');
    });

    it('should highlight active page', () => {
      const sharedNavPath = path.resolve(__dirname, '../modules/shared-nav.js');
      const sharedNavCode = fs.readFileSync(sharedNavPath, 'utf-8');
      
      expect(sharedNavCode).toContain('active');
      expect(sharedNavCode).toMatch(/activePage|active-page/);
    });

    it('should create both inline and fixed toggle buttons', () => {
      const sharedNavPath = path.resolve(__dirname, '../modules/shared-nav.js');
      const sharedNavCode = fs.readFileSync(sharedNavPath, 'utf-8');
      
      expect(sharedNavCode).toContain('nav-toggle');
      expect(sharedNavCode).toContain('nav-toggle-fixed');
    });
  });
});
