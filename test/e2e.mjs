/**
 * End-to-end test for the Ghostwriter extension.
 *
 * Follows the approach WXT points at: Playwright, with the extension loaded
 * into a PERSISTENT context. Chrome will not load an unpacked extension into
 * the throwaway profile that `launch()` creates — it needs a real user-data
 * dir, which is why `launchPersistentContext` is mandatory rather than
 * stylistic.
 *
 * Run: node test/e2e.mjs
 */
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EXT = path.resolve(HERE, '..', '.output', 'chrome-mv3');
const PORT = 8731;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const results = [];
const ok = (name, detail = '') => results.push({ pass: true, name, detail });
const bad = (name, detail = '') => results.push({ pass: false, name, detail });

/** A page whose CSP is strict enough to block chrome-extension:// images. */
function startServer() {
  const body = `<!doctype html><meta charset="utf-8"><title>strict</title>
<body><h1>Strict CSP page</h1>
<textarea id="t" rows="4" cols="40"></textarea>
<input id="pw" type="password">
</body>`;
  const server = http.createServer((_req, res) => {
    res.writeHead(200, {
      'content-type': 'text/html; charset=utf-8',
      'content-security-policy':
        "default-src 'self'; img-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'",
    });
    res.end(body);
  });
  return new Promise((resolve) => server.listen(PORT, () => resolve(server)));
}

const server = await startServer();
const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gw-e2e-'));

const context = await chromium.launchPersistentContext(userDataDir, {
  channel: 'chrome',
  headless: false,
  viewport: { width: 1100, height: 720 },
  args: [
    `--disable-extensions-except=${EXT}`,
    `--load-extension=${EXT}`,
    // Chrome 137+ ignores --load-extension unless this kill-switch is disabled.
    // Without it the browser starts cleanly and simply has no extension, which
    // is indistinguishable from the extension failing to load.
    '--disable-features=DisableLoadExtensionCommandLineSwitch',
  ],
});

try {
  // ---- overlay mounts ----------------------------------------------------
  // Open a page BEFORE hunting for the service worker: MV3 workers are
  // event-driven, so nothing is running until the content script messages one.
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
  await sleep(2000);

  // ---- extension registered? --------------------------------------------
  let [worker] = context.serviceWorkers();
  if (!worker) {
    try {
      worker = await context.waitForEvent('serviceworker', { timeout: 10000 });
    } catch {
      /* fall through — the overlay checks below still tell us plenty */
    }
  }
  if (worker) ok('extension loads', new URL(worker.url()).host);
  else bad('extension loads', 'no service worker registered');
  const extId = worker ? new URL(worker.url()).host : null;

  const readState = async () =>
    worker
      ? worker.evaluate(async () => (await chrome.storage.local.get('gw:state'))['gw:state'] ?? null)
      : null;

  const host = await page.evaluate(() => {
    const el = [...document.documentElement.children].find(
      (n) => n.tagName === 'DIV' && n.getAttribute('aria-hidden') === 'true',
    );
    if (!el) return null;
    return {
      z: el.style.zIndex,
      pointer: el.style.pointerEvents,
      display: getComputedStyle(el).display,
      // A closed shadow root is unreachable from page script — must be false.
      shadowReachable: Boolean(el.shadowRoot),
    };
  });

  if (!host) {
    bad('overlay mounts', 'no host element on documentElement');
  } else {
    ok('overlay mounts', `display:${host.display}`);
    host.z === '2147483647' ? ok('z-index maxed') : bad('z-index maxed', host.z);
    host.pointer === 'none'
      ? ok('does not swallow page clicks')
      : bad('does not swallow page clicks', host.pointer);
    host.shadowReachable
      ? bad('shadow root closed', 'page script can reach it')
      : ok('shadow root closed');
  }

  // ---- survives strict CSP ----------------------------------------------
  const cspBlocked = errors.filter((e) => /Content Security Policy/i.test(e));
  cspBlocked.length === 0
    ? ok('no CSP violations', "img-src 'self' page")
    : bad('no CSP violations', cspBlocked[0]);

  // ---- keystroke counting ------------------------------------------------
  const before = (await readState())?.totalKeystrokes ?? 0;
  await page.click('#t');
  await page.type('#t', 'hello world', { delay: 40 });
  await sleep(900);
  const afterType = (await readState())?.totalKeystrokes ?? 0;
  const typed = afterType - before;
  typed >= 9 && typed <= 13
    ? ok('counts keystrokes', `+${typed} for 11 chars`)
    : bad('counts keystrokes', `expected ~11, got +${typed}`);

  // held key must earn nothing
  await page.click('#t');
  await page.keyboard.down('a');
  await sleep(800);
  await page.keyboard.up('a');
  await sleep(800);
  const afterHold = (await readState())?.totalKeystrokes ?? 0;
  afterHold - afterType <= 2
    ? ok('key repeat earns nothing', `+${afterHold - afterType}`)
    : bad('key repeat earns nothing', `+${afterHold - afterType}`);

  // password field must be excluded
  await page.click('#pw');
  await page.type('#pw', 'hunter2hunter2', { delay: 30 });
  await sleep(900);
  const afterPw = (await readState())?.totalKeystrokes ?? 0;
  afterPw - afterHold === 0
    ? ok('password field excluded', '+0')
    : bad('password field excluded', `+${afterPw - afterHold}`);

  // ---- words derived -----------------------------------------------------
  const st = await readState();
  st && st.totalWords === Math.floor(st.totalKeystrokes / 2)
    ? ok('words derived', `${st.totalWords}w / ${st.totalKeystrokes}k`)
    : bad('words derived', JSON.stringify(st?.totalWords ?? null));

  // ---- the Study ---------------------------------------------------------
  const study = await context.newPage();
  const studyErrors = [];
  study.on('console', (m) => m.type() === 'error' && studyErrors.push(m.text()));
  study.on('pageerror', (e) => studyErrors.push(String(e)));
  await study.goto(`chrome-extension://${extId}/study.html`, { waitUntil: 'domcontentloaded' });
  await sleep(1500);
  const heading = await study.evaluate(() => document.body.innerText.trim().split('\n')[0] ?? '');
  heading.length > 0 ? ok('Study renders', heading.slice(0, 46)) : bad('Study renders', 'empty');
  studyErrors.length === 0 ? ok('Study clean') : bad('Study clean', studyErrors[0]);

  await page.screenshot({ path: path.join(HERE, 'overlay.png') });
  await study.screenshot({ path: path.join(HERE, 'study.png'), fullPage: true });

  errors.length === 0 ? ok('no console errors') : bad('no console errors', errors[0]);
} catch (err) {
  bad('harness', String(err).slice(0, 200));
} finally {
  await context.close();
  server.close();
  fs.rmSync(userDataDir, { recursive: true, force: true });
}

console.log('');
for (const r of results) {
  console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  — ${r.detail}` : ''}`);
}
const passed = results.filter((r) => r.pass).length;
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
