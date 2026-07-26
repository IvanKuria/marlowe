/**
 * The sprite overlay.
 *
 * Everything lives inside a CLOSED shadow root on a host <div> attached to
 * document.documentElement. Nothing leaks either way: the page cannot select
 * our nodes (closed root), the page's stylesheets do not cascade into us, and
 * our stylesheet cannot reach the page.
 *
 * The animation is pure CSS: `steps(n)` over background-position, played
 * forward-then-backward via `animation-direction: alternate`. Typing swaps a
 * cycle class (write / idle / sleep); animating costs zero JS per frame.
 *
 * Per-location, per-cycle sheets and durations live in ./sprites.
 */

import { CYCLES, DEFAULT_LOCATION, SPRITES, hasLocation, spriteCss, type Cycle } from './sprites';
import { loadState, patchState, subscribe, type MarloweState } from '~/lib/state';

// 80px, not 64. Measured: the desk scene reads fine at 64 because the cat
// dominates and the prop is one horizontal bar, but prop-heavy scenes (the
// armchair, the bookshelf beside it) turn to mush. 80 is still tiny on screen
// and is what makes those locations viable at all.
const SIZE = 80;

// He stops writing shortly after you do, then nods off after a longer quiet
// spell. Both are wall-clock only — nothing here persists, so a reload simply
// starts him awake.
const IDLE_AFTER_MS = 1500;
const SLEEP_AFTER_MS = 90_000;
const DRAG_THRESHOLD_PX = 4;
const COLLAPSE_TUCK_PX = 46;
const EDGE_MARGIN = 8;

type Corner = MarloweState['settings']['peek']['corner'];
type Peek = MarloweState['settings']['peek'];

const CSS = `
:host { all: initial; }

.stage {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.sprite {
  position: absolute;
  width: ${SIZE}px;
  height: ${SIZE}px;
  background-repeat: no-repeat;
  background-position: 0 0;
  pointer-events: auto;
  cursor: grab;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  transition: transform 180ms ease, opacity 180ms ease;
  /* Forward then backward: seamless without the source clip needing a
     naturally cyclic motion. Sheet, duration and step count come from the
     per-location-per-cycle rules below.

     Note there is no paused state. Idle and sleep are animated cycles of their
     own (breathing, the odd blink) — a companion that freezes solid the moment
     you stop typing reads as broken rather than resting. */
  animation-direction: alternate;
  animation-iteration-count: infinite;
}

.sprite.dragging { cursor: grabbing; transition: none; }

.sprite.collapsed { opacity: 0.55; }
.sprite.collapsed.edge-l { transform: translateX(-${COLLAPSE_TUCK_PX}px); }
.sprite.collapsed.edge-r { transform: translateX(${COLLAPSE_TUCK_PX}px); }
.sprite.collapsed:hover { opacity: 1; transform: none; }

${spriteCss(SIZE)}

/* Reduced motion is handled inside spriteCss(): the cycles are slowed rather
   than stopped, because freezing the companion outright makes the product
   useless for anyone who simply turned Windows animation effects off. Only the
   incidental UI transitions are dropped here. */
@media (prefers-reduced-motion: reduce) {
  .sprite { transition: none; }
}
`;

export interface Overlay {
  /** Called on every credited keystroke; runs the animation, then idles. */
  markTyping(): void;
  destroy(): void;
}

export async function mountOverlay(): Promise<Overlay> {
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  // Decoration only: never focusable, never a stop in the tab order.
  host.style.cssText = [
    'position: fixed',
    'top: 0',
    'left: 0',
    'width: 100%',
    'height: 100%',
    'margin: 0',
    'padding: 0',
    'border: 0',
    'z-index: 2147483647',
    'pointer-events: none',
    'color-scheme: normal',
  ].join(';');

  const root = host.attachShadow({ mode: 'closed' });

  const style = document.createElement('style');
  style.textContent = CSS;

  const stage = document.createElement('div');
  stage.className = 'stage';

  const sprite = document.createElement('div');
  sprite.className = 'sprite';

  stage.appendChild(sprite);
  root.append(style, stage);
  document.documentElement.appendChild(host);

  /* ---------------- state mirror ---------------- */

  let peek: Peek = { corner: 'br', dx: 24, dy: 24, collapsed: false };
  let mutedHosts: string[] = [];
  let enabled = true;
  let equippedLocation = DEFAULT_LOCATION;
  let cycle: Cycle = 'idle';
  let motion: MarloweState['settings']['motion'] = 'auto';

  const initial = await loadState();
  peek = initial.settings.peek;
  mutedHosts = initial.settings.mutedHosts;
  enabled = initial.settings.enabled;
  equippedLocation = initial.equipped?.location ?? DEFAULT_LOCATION;
  motion = initial.settings.motion ?? 'auto';

  // Open the browser after a long break and he should already be asleep, not
  // sitting bolt upright waiting. lastKeyAt is persisted, so this survives
  // reloads and new tabs.
  const quietFor = Date.now() - (initial.lastKeyAt || 0);
  cycle = quietFor > SLEEP_AFTER_MS ? 'sleep' : 'idle';

  applyPeek();
  applyScene();
  applyVisibility();

  let lastSeenKeyAt = initial.lastKeyAt || 0;

  const unsubscribe = subscribe((next) => {
    // Typing may have happened in a sub-frame — Google Docs routes every
    // keystroke through a hidden iframe, so the top frame's own keydown
    // listener never fires there. The persisted lastKeyAt advancing is our
    // signal that the user is writing, wherever they actually are.
    const keyAt = next.lastKeyAt || 0;
    if (keyAt > lastSeenKeyAt) {
      lastSeenKeyAt = keyAt;
      markTyping();
    }

    if (dragging) return; // never fight the user's finger
    peek = next.settings.peek;
    mutedHosts = next.settings.mutedHosts;
    enabled = next.settings.enabled;
    equippedLocation = next.equipped?.location ?? DEFAULT_LOCATION;
    motion = next.settings.motion ?? 'auto';
    applyPeek();
    applyScene();
    applyVisibility();
  });

  /** Apply the current location × cycle pair as two classes. */
  function applyScene(): void {
    const loc = hasLocation(equippedLocation) ? equippedLocation : DEFAULT_LOCATION;
    for (const key of Object.keys(SPRITES)) {
      sprite.classList.toggle(`loc-${key}`, key === loc);
    }
    for (const c of CYCLES) {
      sprite.classList.toggle(`cy-${c}`, c === cycle);
    }
    // An explicit choice beats the OS hint in either direction.
    sprite.classList.toggle('motion-full', motion === 'full');
    sprite.classList.toggle('motion-reduced', motion === 'reduced');
  }

  function setCycle(next: Cycle): void {
    if (cycle === next) return;
    cycle = next;
    applyScene();
  }

  /* ---------------- placement ---------------- */

  function applyPeek(): void {
    sprite.style.left = '';
    sprite.style.right = '';
    sprite.style.top = '';
    sprite.style.bottom = '';

    const maxX = Math.max(EDGE_MARGIN, window.innerWidth - SIZE - EDGE_MARGIN);
    const maxY = Math.max(EDGE_MARGIN, window.innerHeight - SIZE - EDGE_MARGIN);
    const dx = clamp(peek.dx, 0, maxX);
    const dy = clamp(peek.dy, 0, maxY);

    const top = peek.corner[0] === 't';
    const left = peek.corner[1] === 'l';

    sprite.style[left ? 'left' : 'right'] = `${dx}px`;
    sprite.style[top ? 'top' : 'bottom'] = `${dy}px`;

    sprite.classList.toggle('edge-l', left);
    sprite.classList.toggle('edge-r', !left);
    sprite.classList.toggle('collapsed', peek.collapsed);
  }

  function isMuted(): boolean {
    if (!enabled) return true;
    const hostname = location.hostname;
    return mutedHosts.some(
      (h) => h === hostname || (h.startsWith('*.') && hostname.endsWith(h.slice(1))),
    );
  }

  function applyVisibility(): void {
    const hidden = Boolean(document.fullscreenElement) || isMuted();
    host.style.display = hidden ? 'none' : 'block';
  }

  /* ---------------- animation gate ---------------- */

  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  let sleepTimer: ReturnType<typeof setTimeout> | undefined;

  function markTyping(): void {
    setCycle('write');
    if (idleTimer !== undefined) clearTimeout(idleTimer);
    if (sleepTimer !== undefined) clearTimeout(sleepTimer);
    idleTimer = setTimeout(() => setCycle('idle'), IDLE_AFTER_MS);
    sleepTimer = setTimeout(() => setCycle('sleep'), SLEEP_AFTER_MS);
  }

  /* ---------------- drag / click ---------------- */

  let dragging = false;
  let pointerId: number | null = null;
  let startX = 0;
  let startY = 0;
  let originLeft = 0;
  let originTop = 0;
  let moved = false;

  function onPointerDown(e: PointerEvent): void {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const rect = sprite.getBoundingClientRect();
    pointerId = e.pointerId;
    startX = e.clientX;
    startY = e.clientY;
    originLeft = rect.left;
    originTop = rect.top;
    moved = false;
    dragging = true;
    sprite.setPointerCapture(e.pointerId);
    e.preventDefault();
    e.stopPropagation();
  }

  function onPointerMove(e: PointerEvent): void {
    if (!dragging || e.pointerId !== pointerId) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (!moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;

    if (!moved) {
      moved = true;
      sprite.classList.add('dragging');
      // Switch from corner anchoring to absolute placement for the drag.
      sprite.style.right = '';
      sprite.style.bottom = '';
      sprite.classList.remove('collapsed');
    }

    const maxX = Math.max(0, window.innerWidth - SIZE);
    const maxY = Math.max(0, window.innerHeight - SIZE);
    sprite.style.left = `${clamp(originLeft + dx, 0, maxX)}px`;
    sprite.style.top = `${clamp(originTop + dy, 0, maxY)}px`;
    e.preventDefault();
  }

  function onPointerUp(e: PointerEvent): void {
    if (!dragging || e.pointerId !== pointerId) return;
    dragging = false;
    pointerId = null;
    sprite.classList.remove('dragging');
    if (sprite.hasPointerCapture(e.pointerId)) sprite.releasePointerCapture(e.pointerId);

    if (!moved) {
      // A tap with no travel is a click: open the Study.
      void sendOpenStudy();
      return;
    }
    void snapToCorner();
  }

  function onPointerCancel(): void {
    dragging = false;
    pointerId = null;
    sprite.classList.remove('dragging');
    applyPeek();
  }

  async function snapToCorner(): Promise<void> {
    const rect = sprite.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    const left = cx < window.innerWidth / 2;
    const top = cy < window.innerHeight / 2;
    const corner = `${top ? 't' : 'b'}${left ? 'l' : 'r'}` as Corner;

    const dx = Math.round(left ? rect.left : window.innerWidth - rect.right);
    const dy = Math.round(top ? rect.top : window.innerHeight - rect.bottom);

    peek = {
      ...peek,
      corner,
      dx: clamp(dx, EDGE_MARGIN, Math.max(EDGE_MARGIN, window.innerWidth - SIZE - EDGE_MARGIN)),
      dy: clamp(dy, EDGE_MARGIN, Math.max(EDGE_MARGIN, window.innerHeight - SIZE - EDGE_MARGIN)),
    };
    applyPeek();

    try {
      await patchState((draft) => {
        draft.settings.peek = { ...draft.settings.peek, ...peek };
      });
    } catch {
      /* extension context may have been invalidated mid-drag */
    }
  }

  async function sendOpenStudy(): Promise<void> {
    try {
      await chrome.runtime.sendMessage({ type: 'open-study' });
    } catch {
      /* background asleep mid-reload; nothing useful to do */
    }
  }

  /* ---------------- listeners ---------------- */

  const onFullscreenChange = () => applyVisibility();
  const onResize = () => {
    if (!dragging) applyPeek();
  };

  sprite.addEventListener('pointerdown', onPointerDown);
  sprite.addEventListener('pointermove', onPointerMove);
  sprite.addEventListener('pointerup', onPointerUp);
  sprite.addEventListener('pointercancel', onPointerCancel);
  // Suppress the synthetic click so the page never sees it.
  sprite.addEventListener('click', (e) => e.stopPropagation());
  sprite.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('fullscreenchange', onFullscreenChange);
  window.addEventListener('resize', onResize);

  return {
    markTyping,
    destroy() {
      unsubscribe();
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      window.removeEventListener('resize', onResize);
      if (idleTimer !== undefined) clearTimeout(idleTimer);
      if (sleepTimer !== undefined) clearTimeout(sleepTimer);
      host.remove();
    },
  };
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
}
