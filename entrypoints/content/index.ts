import { mountOverlay, type Overlay } from './overlay';
import type { KeysMessage } from '~/lib/state';

/**
 * Marlowe content script.
 *
 * Counts keystrokes. It never reads `event.key` for anything other than
 * discarding bare modifier presses, and nothing about what was typed ever
 * leaves this function.
 */

/** Credited keystrokes per second. Mashing beyond this earns nothing. */
const MAX_KEYS_PER_SECOND = 12;
/** Never send more than one message per this many ms. */
const BATCH_MS = 250;

const BARE_MODIFIERS = new Set([
  'Shift',
  'Control',
  'Alt',
  'Meta',
  'CapsLock',
  'NumLock',
  'ScrollLock',
  'Fn',
  'FnLock',
  'Hyper',
  'Super',
  'AltGraph',
  'ContextMenu',
]);

export default defineContentScript({
  matches: ['<all_urls>'],

  // MUST be true, and this is the single most important line in the file.
  //
  // Google Docs focuses an invisible iframe (`iframe.docs-texteventtarget-iframe`)
  // to receive keyboard input. Keydown fires INSIDE that frame and never
  // reaches the top-level document, so `allFrames: false` sees exactly zero
  // keystrokes on Docs — the cat renders and then does nothing forever. Plenty
  // of other rich editors embed their input surface the same way.
  //
  // So: count everywhere, draw only in the top frame (see `isTopFrame` below).
  allFrames: true,
  // Docs' event-target frame is about:blank, which is skipped without this.
  matchAboutBlank: true,
  runAt: 'document_idle',

  main() {
    const isTopFrame = window.top === window.self;

    // The overlay needs a storage round-trip before it can place itself.
    // Counting must not wait on that, so it is mounted out of band and a
    // failure to mount never takes keystroke counting down with it.
    let overlay: Overlay | null = null;

    // console.error, not console.debug. WXT stubs its own logger to a no-op in
    // production builds, and Chrome hides console.debug behind the Verbose log
    // level, so a mount failure was previously invisible in every channel at
    // once. If this ever breaks again it must be loud.
    console.info(
      '[marlowe] content script running on',
      location.hostname,
      isTopFrame ? '(top frame)' : '(sub-frame, counting only)',
    );

    // Only the top frame draws. Every frame counts.
    if (isTopFrame) {
      void mountOverlay().then(
        (o) => {
          overlay = o;
          console.info('[marlowe] overlay mounted');
        },
        (err) => console.error('[marlowe] overlay failed to mount', err),
      );
    }

    /* ---------- rate limiter (token bucket) ---------- */

    let tokens = MAX_KEYS_PER_SECOND;
    let lastRefill = performance.now();

    function takeToken(): boolean {
      const now = performance.now();
      tokens = Math.min(
        MAX_KEYS_PER_SECOND,
        tokens + ((now - lastRefill) / 1000) * MAX_KEYS_PER_SECOND,
      );
      lastRefill = now;
      if (tokens < 1) return false;
      tokens -= 1;
      return true;
    }

    /* ---------- batching ---------- */

    let pending = 0;
    let lastKeyAt = 0;
    let flushTimer: ReturnType<typeof setTimeout> | null = null;

    function flush(): void {
      if (flushTimer !== null) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }
      if (pending <= 0) return;
      const message: KeysMessage = { type: 'keys', count: pending, at: lastKeyAt || Date.now() };
      pending = 0;
      try {
        // Fire and forget. The background worker may be cold; Chrome spins it
        // back up for us. Errors here are always context-invalidation noise.
        void chrome.runtime.sendMessage(message).catch(() => {});
      } catch {
        /* extension reloaded out from under us */
      }
    }

    function scheduleFlush(): void {
      if (flushTimer !== null) return;
      flushTimer = setTimeout(flush, BATCH_MS);
    }

    /* ---------- keystrokes ---------- */

    function isPasswordTarget(event: KeyboardEvent): boolean {
      const path =
        typeof event.composedPath === 'function' ? event.composedPath() : [event.target];
      for (const node of path) {
        if (node instanceof HTMLInputElement && node.type === 'password') return true;
        // Stop climbing once we leave element land.
        if (node instanceof Document || node instanceof Window) break;
      }
      return false;
    }

    function onKeyDown(event: KeyboardEvent): void {
      // Auto-repeat earns nothing: holding a key down is not writing.
      if (event.repeat) return;
      if (!event.isTrusted) return;
      if (BARE_MODIFIERS.has(event.key)) return;
      if (isPasswordTarget(event)) return;
      if (!takeToken()) return;

      pending += 1;
      lastKeyAt = Date.now();
      overlay?.markTyping();
      scheduleFlush();
    }

    // Capture phase so pages that swallow keydown do not starve the cat.
    document.addEventListener('keydown', onKeyDown, { capture: true, passive: true });

    // Do not lose a partial batch when the tab goes away.
    const onHide = () => flush();
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush();
    });
  },
});
