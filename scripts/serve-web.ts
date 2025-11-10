import http from 'node:http';
import { createReadStream, promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const defaultPort = Number.parseInt(process.env.PORT ?? '', 10) || 4173;

const mimeTypes: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

function getContentType(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  return mimeTypes[ext] ?? 'application/octet-stream';
}

function isPathInside(base: string, target: string) {
  const relative = path.relative(base, target);
  return !relative.startsWith('..') && !path.isAbsolute(relative);
}

async function resolvePath(requestPath: string) {
  const decoded = decodeURIComponent(requestPath);
  const candidate = path.normalize(path.join(projectRoot, decoded));
  if (!isPathInside(projectRoot, candidate)) {
    return null;
  }
  let stats;
  try {
    stats = await fs.stat(candidate);
  } catch (error) {
    console.error(`Error accessing path "${candidate}":`, error);
    return null;
  }
  if (stats.isDirectory()) {
    const indexPath = path.join(candidate, 'index.html');
    try {
      await fs.access(indexPath);
      return indexPath;
    } catch (error) {
      console.error(`Error accessing index file "${indexPath}":`, error);
      return null;
    }
  }
  return candidate;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  const filePath = await resolvePath(url.pathname === '/' ? 'web/index.html' : url.pathname);
  if (!filePath) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }

  const contentType = getContentType(filePath);
  res.writeHead(200, { 'Content-Type': contentType });
  createReadStream(filePath).pipe(res);
});

server.listen(defaultPort, () => {
  console.log(`Serving fbs-graph static assets on http://localhost:${defaultPort}`);
  console.log('Open /web/matchup-timeline.html in your browser to explore the timeline.');
});
