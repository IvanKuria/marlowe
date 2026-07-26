/**
 * End-to-end smoke test for the Ghostwriter extension.
 *
 * Loads the built extension into the real Chrome, then checks the things that
 * can only fail in a browser:
 *   1. the overlay actually mounts (and its shadow root is genuinely closed)
 *   2. it survives a page with a strict Content-Security-Policy
 *   3. keystrokes are counted, and key-repeat / password fields are not
 *   4. nothing is logged to the console
 *   5. the Study page loads
 *
 * Run: node test/smoke.mjs
 */
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EXT = path.resolve(HERE, '..', '.output', 'chrome-mv3');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 8731;

const results = [];
const ok = (name, detail = '') => results.push({ pass: true, name, detail });
const fail = (name, detail = '') => results.push({ pass: false, name, detail });

/** A page with a CSP strict enough to block chrome-extension:// images. */
function startServer() {
  const body = `<!doctype html><meta charset="utf-8"><title>strict</title>
<body><h1>Strict CSP page</h1>
<textarea id="t" rows="4" cols="40"></textarea>
<input id="pw" type="password">
</body>`;
  const server = http.createServer((req, res) => {
    res.writeHead(200, {
      'content-type': 'text/html; charset=utf-8',
      'content-security-policy':
        "default-src 'self'; img-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'",
    });
    res.end(body);
  });
  return new Promise((resolve) => server.listen(PORT, () => resolve(server)));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getState(worker) {
  return worker.evaluate(async () => {
    const got = await chrome.storage.local.get('gw:state');
    return got['gw:state'] ?? null;
  });
}

const server = await startServer();

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: false,
  args: [
    `--disable-extensions-except=${EXT}`,
    `--load-extension=${EXT}`,
    // Chrome 137+ ignores --load-extension unless this kill-switch is disabled.
    // Without it the browser starts fine and simply has no extension, which
    // looks exactly like the extension failing to load.
    '--disable-features=DisableLoadExtensionCommandLineSwitch',
    '--no-first-run',
    '--no-default-browser-check',
  ],
});

try {
  // Chrome 137+ neutered the --load-extension switch, so load via the CDP
  // Extensions domain instead. It hands back the extension id directly.
  const cdp = await browser.target().createCDPSession();
  const loaded = await cdp.send('Extensions.loadUnpacked', { path: EXT });
  const extId = loaded?.id;
  if (!extId) throw new Error('Extensions.loadUnpacked returned no id');
  ok('extension loads', extId);
  await sleep(800);

  // Wake the service worker: MV3 workers are event-driven, so nothing is
  // running until a content script messages one. Visiting a page does it.
  const warmup = await browser.newPage();
  await warmup.goto('https://example.com', { waitUntil: 'domcontentloaded' });
  await sleep(1500);

  // Find the worker through raw CDP. Puppeteer's target list filters service
  // workers out, and a normal tab cannot navigate to chrome-extension:// URLs
  // (ERR_BLOCKED_BY_CLIENT), so neither of the obvious routes works.
  await cdp.send('Target.setDiscoverTargets', { discover: true });
  let swTargetId = null;
  for (let i = 0; i < 40 && !swTargetId; i++) {
    const { targetInfos } = await cdp.send('Target.getTargets');
    const hit = targetInfos.find(
      (t) => t.url.includes(extId) && (t.type === 'service_worker' || t.type === 'background_page'),
    );
    if (hit) swTargetId = hit.targetId;
    else await sleep(250);
  }
  if (!swTargetId) {
    const { targetInfos } = await cdp.send('Target.getTargets');
    throw new Error(
      `no extension worker. targets: ${targetInfos.map((t) => `${t.type}:${t.url.slice(0, 50)}`).join(' | ')}`,
    );
  }
  ok('service worker running', swTargetId.slice(0, 12));

  const { sessionId } = await cdp.send('Target.attachToTarget', {
    targetId: swTargetId,
    flatten: true,
  });
  const swSession = cdp.connection().session(sessionId);

  /** Evaluate an async expression inside the service worker. */
  const sw = {
    async evaluate(fn) {
      const { result } = await swSession.send('Runtime.evaluate', {
        expression: `(${fn.toString()})()`,
        awaitPromise: true,
        returnByValue: true,
      });
      return result?.value ?? null;
    },
  };
  await warmup.close();

  // ---- 1. overlay mounts on an ordinary page -----------------------------
  const page = await browser.newPage();
  const consoleErrors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  page.on('pageerror', (e) => consoleErrors.push(String(e)));

  await page.goto('https://example.com', { waitUntil: 'domcontentloaded' });
  await sleep(1200);

  const mounted = await page.evaluate(() => {
    const hosts = [...document.documentElement.children].filter(
      (el) => el.tagName === 'DIV' && el.getAttribute('aria-hidden') === 'true',
    );
    return {
      count: hosts.length,
      zIndex: hosts[0]?.style.zIndex ?? null,
      pointerEvents: hosts[0]?.style.pointerEvents ?? null,
      // A CLOSED shadow root is invisible to page script — this must be null.
      shadowReachable: hosts[0]?.shadowRoot !== null && hosts[0]?.shadowRoot !== undefined,
    };
  });

  mounted.count === 1
    ? ok('overlay mounts', '1 host element')
    : fail('overlay mounts', `found ${mounted.count} hosts`);
  mounted.zIndex === '2147483647' ? ok('z-index maxed') : fail('z-index maxed', mounted.zIndex);
  mounted.pointerEvents === 'none'
    ? ok('host does not swallow clicks')
    : fail('host does not swallow clicks', mounted.pointerEvents);
  mounted.shadowReachable
    ? fail('shadow root is closed', 'page script can reach it')
    : ok('shadow root is closed', 'invisible to page script');

  // ---- 2. strict-CSP page ------------------------------------------------
  const csp = await browser.newPage();
  const cspErrors = [];
  csp.on('console', (m) => {
    if (m.type() === 'error') cspErrors.push(m.text());
  });
  await csp.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
  await sleep(1200);

  const cspMounted = await csp.evaluate(
    () =>
      [...document.documentElement.children].filter(
        (el) => el.tagName === 'DIV' && el.getAttribute('aria-hidden') === 'true',
      ).length,
  );
  cspMounted === 1
    ? ok('mounts under strict CSP', "img-src 'self'")
    : fail('mounts under strict CSP', `${cspMounted} hosts`);

  const cspBlocked = cspErrors.filter((e) => /Content Security Policy/i.test(e));
  cspBlocked.length === 0
    ? ok('no CSP violations', 'sprite inlined as data: URI')
    : fail('no CSP violations', cspBlocked[0]);

  // ---- 3. keystroke counting --------------------------------------------
  const before = (await getState(sw))?.totalKeystrokes ?? 0;

  await csp.focus('#t');
  await csp.type('#t', 'hello world', { delay: 30 });
  await sleep(900);
  const afterTyping = (await getState(sw))?.totalKeystrokes ?? 0;
  const counted = afterTyping - before;
  counted >= 10 && counted <= 13
    ? ok('counts keystrokes', `${counted} for 11 chars`)
    : fail('counts keystrokes', `expected ~11, got ${counted}`);

  // key repeat must earn nothing
  await csp.focus('#t');
  await csp.keyboard.down('a');
  await sleep(700);
  await csp.keyboard.up('a');
  await sleep(700);
  const afterRepeat = (await getState(sw))?.totalKeystrokes ?? 0;
  const repeatGain = afterRepeat - afterTyping;
  repeatGain <= 2
    ? ok('key repeat earns nothing', `+${repeatGain} while held`)
    : fail('key repeat earns nothing', `+${repeatGain} while held`);

  // password fields must be excluded
  await csp.focus('#pw');
  await csp.type('#pw', 'hunter2hunter2', { delay: 25 });
  await sleep(900);
  const afterPw = (await getState(sw))?.totalKeystrokes ?? 0;
  afterPw - afterRepeat === 0
    ? ok('password fields excluded', '+0')
    : fail('password fields excluded', `+${afterPw - afterRepeat}`);

  // ---- 4. words derived --------------------------------------------------
  const st = await getState(sw);
  st && st.totalWords === Math.floor(st.totalKeystrokes / 2)
    ? ok('words derived from keystrokes', `${st.totalWords}w / ${st.totalKeystrokes}k`)
    : fail('words derived from keystrokes', JSON.stringify(st?.totalWords));

  // ---- 5. the Study loads ------------------------------------------------
  const study = await browser.newPage();
  const studyErrors = [];
  study.on('console', (m) => {
    if (m.type() === 'error') studyErrors.push(m.text());
  });
  study.on('pageerror', (e) => studyErrors.push(String(e)));
  await study.goto(`chrome-extension://${extId}/study.html`, { waitUntil: 'domcontentloaded' });
  await sleep(1200);
  const studyText = await study.evaluate(() => document.body.innerText.slice(0, 200));
  studyText.trim().length > 0
    ? ok('Study renders', studyText.split('\n')[0].slice(0, 48))
    : fail('Study renders', 'empty body');
  studyErrors.length === 0
    ? ok('Study has no console errors')
    : fail('Study has no console errors', studyErrors[0]);

  // ---- 6. no console noise on content pages ------------------------------
  consoleErrors.length === 0
    ? ok('no console errors on page')
    : fail('no console errors on page', consoleErrors[0]);
} catch (err) {
  fail('harness', String(err));
} finally {
  await browser.close();
  server.close();
}

const passed = results.filter((r) => r.pass).length;
console.log('');
for (const r of results) {
  console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  — ${r.detail}` : ''}`);
}
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
