/** Load the built extension, open a page, type, and screenshot. */
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
  ignoreDefaultArgs: ['--disable-extensions'],
  defaultViewport: { width: 1100, height: 700 },
  args: [
    `--disable-extensions-except=${EXT}`,
    `--load-extension=${EXT}`,
    '--disable-features=DisableLoadExtensionCommandLineSwitch',
    '--no-first-run',
    '--no-default-browser-check',
  ],
});
await sleep(1500);

const page = await browser.newPage();
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e}`));

await page.goto('https://example.com', { waitUntil: 'domcontentloaded' });
await sleep(2000);

const probe = await page.evaluate(() => {
  const kids = [...document.documentElement.children].map((el) => ({
    tag: el.tagName,
    aria: el.getAttribute('aria-hidden'),
    z: el.style?.zIndex ?? '',
  }));
  const host = [...document.documentElement.children].find(
    (el) => el.tagName === 'DIV' && el.getAttribute('aria-hidden') === 'true',
  );
  return {
    childTags: kids,
    hostFound: Boolean(host),
    hostDisplay: host ? getComputedStyle(host).display : null,
    hostRect: host ? host.getBoundingClientRect().toJSON() : null,
  };
});
console.log('probe:', JSON.stringify(probe, null, 2));

// type into the body to trigger the cat
await page.evaluate(() => {
  const ta = document.createElement('textarea');
  ta.id = 'gwtest';
  ta.style.cssText = 'position:fixed;left:20px;top:20px;width:300px;height:80px;z-index:5';
  document.body.appendChild(ta);
  ta.focus();
});
await page.type('#gwtest', 'the cat should be writing now', { delay: 40 });
await sleep(600);

await page.screenshot({ path: path.join(HERE, 'shot.png') });
console.log('screenshot written');
console.log('console logs:', logs.length ? logs.join('\n') : '(none)');

await browser.close();
