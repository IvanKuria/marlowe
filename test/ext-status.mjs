/** Ask Chrome itself what it thinks of the extension. */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EXT = path.resolve(HERE, '..', '.output', 'chrome-mv3');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: false,
  defaultViewport: { width: 1200, height: 800 },
  args: [
    `--disable-extensions-except=${EXT}`,
    `--load-extension=${EXT}`,
    '--disable-features=DisableLoadExtensionCommandLineSwitch',
    '--no-first-run',
    '--no-default-browser-check',
  ],
});

await sleep(2000);

const page = await browser.newPage();
await page.goto('chrome://extensions', { waitUntil: 'domcontentloaded' });
await sleep(1500);

// chrome://extensions is a nest of shadow roots; walk them all.
const info = await page.evaluate(() => {
  const out = [];
  function walk(root, depth) {
    if (depth > 12) return;
    for (const el of root.querySelectorAll('*')) {
      if (el.shadowRoot) walk(el.shadowRoot, depth + 1);
    }
    const t = root.textContent?.trim();
    if (t && t.length < 400) out.push(t.replace(/\s+/g, ' '));
  }
  walk(document, 0);
  return [...new Set(out)].slice(-40);
});
console.log(info.join('\n---\n'));

await page.screenshot({ path: path.join(HERE, 'extensions.png') });
await browser.close();
