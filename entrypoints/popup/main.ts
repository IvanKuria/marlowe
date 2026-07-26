/**
 * Toolbar popup.
 *
 * Reason to exist beyond the pin: `mutedHosts`, `motion` and the master switch
 * were all in state with no interface anywhere that could set them. It is also
 * the only way back to the Study if you have hidden the sprite.
 *
 * Every write goes through the worker (`set-settings`) rather than straight to
 * `chrome.storage`, so it queues behind in-flight keystroke batches instead of
 * racing them.
 */
import deskIdle from '~/assets/sprites/desk-idle.png?inline';
import {
  CHAPTERS_PER_WORK,
  type MarloweState,
} from '~/lib/state';

const FRAMES = 24;
const SIZE = 56;
const IDLE_MS = 2600;

/** Hostname of the tab the popup was opened over, or null on chrome:// pages. */
async function currentHost(): Promise<string | null> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url) return null;
    const url = new URL(tab.url);
    // Only http(s) pages can host a content script, so nothing else is mutable.
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.hostname;
  } catch {
    return null;
  }
}

function send<T>(message: unknown): Promise<T> {
  return chrome.runtime.sendMessage(message) as Promise<T>;
}

function mountCat(): void {
  const el = document.getElementById('cat');
  if (!el) return;
  const style = document.createElement('style');
  style.textContent = `@keyframes gwPopupIdle { to { background-position: -${SIZE * FRAMES}px 0; } }`;
  document.head.appendChild(style);
  Object.assign(el.style, {
    backgroundImage: `url("${deskIdle}")`,
    backgroundSize: `${SIZE * FRAMES}px ${SIZE}px`,
    animationName: 'gwPopupIdle',
    animationDuration: `${IDLE_MS}ms`,
    animationTimingFunction: `steps(${FRAMES})`,
  });
}

function renderWork(state: MarloweState): void {
  const words = state.today.words;
  const today = document.getElementById('today');
  if (today) {
    today.textContent =
      words > 0
        ? `${words.toLocaleString()} ${words === 1 ? 'word' : 'words'} today`
        : 'nothing written today yet';
  }

  const title = document.getElementById('title');
  if (title) title.textContent = state.current.title;

  const chapters = document.getElementById('chapters');
  if (chapters) {
    chapters.replaceChildren();
    for (let c = 1; c <= CHAPTERS_PER_WORK; c++) {
      const pip = document.createElement('i');
      if (c < state.current.chapter) pip.className = 'done';
      else if (c === state.current.chapter) pip.className = 'here';
      chapters.appendChild(pip);
    }
  }

  const chap = document.getElementById('chap');
  if (chap) {
    chap.textContent = `chapter ${state.current.chapter} of ${CHAPTERS_PER_WORK}, ${state.current.genre}`;
  }
}

function renderSettings(state: MarloweState, host: string | null): void {
  const mute = document.getElementById('mute') as HTMLInputElement | null;
  const label = document.getElementById('hideLabel');
  if (mute && label) {
    if (host) {
      label.textContent = `Hide him on ${host}`;
      mute.checked = state.settings.mutedHosts.includes(host);
      mute.disabled = false;
    } else {
      // chrome:// pages, the Web Store and the Study itself never had a cat on
      // them, so offering to hide him would be a lie.
      label.textContent = 'Nothing to hide on this page';
      mute.checked = false;
      mute.disabled = true;
    }
  }

  const off = document.getElementById('off') as HTMLInputElement | null;
  if (off) off.checked = !state.settings.enabled;

  for (const button of document.querySelectorAll<HTMLButtonElement>('.seg button')) {
    button.setAttribute('aria-checked', String(button.dataset.motion === state.settings.motion));
  }
}

async function main(): Promise<void> {
  mountCat();

  const host = await currentHost();
  const first = await send<{ ok: boolean; state: MarloweState }>({ type: 'get-state' });
  if (!first?.ok) return;

  let state = first.state;
  renderWork(state);
  renderSettings(state, host);

  async function patch(p: Partial<MarloweState['settings']>): Promise<void> {
    const res = await send<{ ok: boolean; state: MarloweState }>({
      type: 'set-settings',
      patch: p,
    });
    if (res?.ok) {
      state = res.state;
      renderSettings(state, host);
    }
  }

  document.getElementById('open')?.addEventListener('click', () => {
    void send({ type: 'open-study' }).then(() => window.close());
  });

  document.getElementById('mute')?.addEventListener('change', (event) => {
    if (!host) return;
    const on = (event.target as HTMLInputElement).checked;
    const next = on
      ? [...new Set([...state.settings.mutedHosts, host])]
      : state.settings.mutedHosts.filter((h) => h !== host);
    void patch({ mutedHosts: next });
  });

  document.getElementById('off')?.addEventListener('change', (event) => {
    void patch({ enabled: !(event.target as HTMLInputElement).checked });
  });

  for (const button of document.querySelectorAll<HTMLButtonElement>('.seg button')) {
    button.addEventListener('click', () => {
      const motion = button.dataset.motion as MarloweState['settings']['motion'];
      void patch({ motion });
    });
  }
}

void main();
