/**
 * Run the built content script in Node with minimal DOM stubs.
 *
 * A content script crash happens in an isolated world, so it never reaches
 * page.on('pageerror'), and WXT stubs its own logger to a no-op in production
 * builds. The result is a script that fails completely silently. This harness
 * surfaces the throw without a browser.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.resolve(HERE, '..', '.output', 'chrome-mv3', 'content-scripts', 'content.js');
const src = fs.readFileSync(FILE, 'utf8');

const listeners = [];
function el(tag = 'div') {
  const node = {
    tagName: String(tag).toUpperCase(),
    style: { cssText: '', setProperty() {} },
    children: [],
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    dataset: {},
    setAttribute() {},
    getAttribute: () => null,
    appendChild(c) { this.children.push(c); return c; },
    append(...c) { this.children.push(...c); },
    remove() {},
    addEventListener() {},
    removeEventListener() {},
    attachShadow: () => el('shadow'),
    getBoundingClientRect: () => ({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }),
    setPointerCapture() {},
    releasePointerCapture() {},
    hasPointerCapture: () => false,
    get textContent() { return this._t ?? ''; },
    set textContent(v) { this._t = v; },
  };
  return node;
}

const documentEl = el('html');
const sandbox = {
  console,
  performance: { now: () => Date.now() },
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  queueMicrotask,
  Promise,
  URL,
  location: { hostname: 'example.com', href: 'https://example.com/' },
  Event,
  CustomEvent,
  AbortController,
  EventTarget,
  requestAnimationFrame: (f) => setTimeout(f, 16),
  cancelAnimationFrame: clearTimeout,
  requestIdleCallback: (f) => setTimeout(f, 1),
  cancelIdleCallback: clearTimeout,
  postMessage() {},
  navigator: { userAgent: 'node' },
  innerWidth: 1200,
  innerHeight: 800,
  getComputedStyle: () => ({ display: 'block' }),
  HTMLInputElement: class HTMLInputElement {},
  Document: class Document {},
  Window: class Window {},
  document: {
    documentElement: documentEl,
    createElement: (t) => el(t),
    addEventListener: (t, f) => listeners.push(t),
    removeEventListener() {},
    dispatchEvent: () => true,
    visibilityState: 'visible',
    fullscreenElement: null,
    readyState: 'complete',
  },
  chrome: {
    runtime: {
      id: 'test',
      sendMessage: async () => undefined,
      onMessage: { addListener() {} },
      getURL: (p) => `chrome-extension://test/${p}`,
    },
    storage: {
      local: {
        get: async () => ({}),
        set: async () => undefined,
      },
      onChanged: { addListener() {}, removeListener() {} },
    },
  },
};
sandbox.window = sandbox;
sandbox.self = sandbox;
sandbox.globalThis = sandbox;
sandbox.window.top = sandbox;
sandbox.window.self = sandbox;

try {
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: 'content.js' });
  console.log('MODULE INIT: ok — script evaluated without throwing');
  console.log('document listeners registered:', listeners);
  console.log('documentElement children:', documentEl.children.length);
} catch (err) {
  console.log('MODULE INIT: THREW');
  console.log('  name   :', err?.name);
  console.log('  message:', err?.message);
  // The bundle is one enormous minified line, so a raw stack dumps the whole
  // file. Print only the frame locations.
  const frames = String(err?.stack ?? '')
    .split('\n')
    .filter((l) => /^\s+at /.test(l))
    .slice(0, 6);
  console.log('  frames :\n' + frames.join('\n'));
}
