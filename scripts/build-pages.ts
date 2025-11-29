/**
 * Build script for GitHub Pages deployment
 * Copies only the necessary web assets to a dist folder
 */

import fs from 'node:fs';
import path from 'node:path';

const DIST_DIR = path.join(process.cwd(), 'dist');
const WEB_DIR = path.join(process.cwd(), 'web');

// Ensure dist directory exists and is clean
if (fs.existsSync(DIST_DIR)) {
  // Safety guard: do not allow accidental removal of filesystem root or the project root
  const resolved = path.resolve(DIST_DIR);
  const root = path.parse(resolved).root;
  if (resolved === root) {
    throw new Error(`Refusing to remove root path: ${resolved}`);
  }
  // Ensure the resolved path is inside the project directory and is the expected 'dist' folder.
  const cwd = process.cwd();
  const relativePath = path.relative(cwd, resolved);
  // Reject paths that escape the repository (start with '..') or
  // resolved absolute paths located outside the cwd. Rely primarily on
  // `path.basename` to confirm the expected folder name is 'dist'.
  // Reject paths that escape the repository (start with '..').
  if (relativePath.startsWith('..')) {
    throw new Error(`Refusing to remove path outside project: ${resolved}`);
  }
  // Prevent accidental removal of the project root directory
  if (resolved === cwd) {
    throw new Error(`Refusing to remove project root path: ${resolved}`);
  }
  if (path.basename(resolved) !== 'dist') {
    throw new Error(`Refusing to remove unexpected directory: ${resolved}`);
  }
  try {
    fs.rmSync(DIST_DIR, { recursive: true, force: true });
  } catch (err) {
    console.error(`Failed to remove ${DIST_DIR}:`, err);
    throw err;
  }
}
fs.mkdirSync(DIST_DIR, { recursive: true });

// Copy web directory contents
function copyDirectory(src: string, dest: string) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

console.log('Building GitHub Pages distribution...');

// Copy web assets
console.log('Copying web assets...');
if (!fs.existsSync(WEB_DIR)) {
  console.error(`Web source directory does not exist: ${WEB_DIR}`);
  process.exitCode = 1;
  throw new Error(`Web directory not found: ${WEB_DIR}`);
}

try {
  copyDirectory(WEB_DIR, DIST_DIR);
} catch (err) {
  console.error('Failed while copying web assets:', err);
  process.exitCode = 2;
  throw err;
}

console.log(`✓ Build complete! Distribution ready in ${DIST_DIR}`);
