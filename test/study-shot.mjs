/**
 * Screenshot the built Study page.
 *
 * Served over HTTP rather than opened from disk: WXT emits root-absolute asset
 * paths (`/chunks/...`), which resolve to the drive root under file:// and are
 * then blocked by CORS. A throwaway static server on the output directory
 * reproduces the extension's origin closely enough.
 *
 * With no `chrome.storage` present the store falls back to MOCK_STATE, which
 * is exactly the state worth looking at: books on the shelf, post in the tray.
 * Nothing here needs the extension to be installed.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '.output', 'chrome-mv3');
const OUT = process.argv[2] ?? path.resolve(HERE, 'study.png');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.json': 'application/json',
};

const server = http.createServer((req, res) => {
  const rel = decodeURIComponent((req.url ?? '/').split('?')[0]);
  const file = path.join(ROOT, rel === '/' ? 'study.html' : rel);
  if (!file.startsWith(ROOT) || !fs.existsSync(file)) {
    console.info('404', rel);
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const { port } = server.address();

const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });

const problems = [];
page.on('console', (m) => m.type() === 'error' && problems.push(m.text()));
page.on('pageerror', (e) => problems.push(String(e)));

await page.goto(`http://127.0.0.1:${port}/study.html`, { waitUntil: 'networkidle' });
// Let the sprite sheets decode so the cat is not a blank box in the shot.
await page.waitForTimeout(1200);
await page.screenshot({ path: OUT, fullPage: true });
await browser.close();
server.close();

console.info(problems.length ? `errors:\n  ${problems.join('\n  ')}` : 'no console errors');
console.info('wrote', OUT);
