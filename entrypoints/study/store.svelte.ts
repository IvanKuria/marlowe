import type { MarloweState, MailItem } from './state';
import { loadState, normalize, patchState, subscribe } from './state';
import { MOCK_STATE } from './mock';
import { computeStreak } from './streak';

/** `mock` means there is no extension storage to read — a standalone preview. */
type Source = 'live' | 'mock';

/** Shown on the sample study so the streak figure isn't a lonely zero. */
const MOCK_STREAK = 14;

function hasStorage(): boolean {
  return typeof chrome !== 'undefined' && !!chrome?.storage?.local;
}

class StudyStore {
  data = $state<MarloweState>(normalize(MOCK_STATE));
  source = $state<Source>('mock');
  streak = $state(MOCK_STREAK);

  /**
   * Reads shared state once, then follows it. Returns a teardown function.
   * Inside the extension this always goes live — a brand new profile shows a
   * genuinely empty study, which is the truthful first run.
   */
  start(): () => void {
    if (!hasStorage()) return () => {};

    loadState()
      .then((s) => this.#adopt(s, 'live'))
      .catch(() => {
        /* keep the sample study on screen rather than a blank page */
      });

    return subscribe((s) => this.#adopt(s, 'live'));
  }

  #adopt(next: MarloweState, source: Source) {
    this.data = next;
    this.source = source;
    if (source !== 'live') {
      this.streak = MOCK_STREAK;
      return;
    }
    // The day log is appended by the background worker, not here — the Study
    // is a reader of the streak, never its recorder.
    this.streak = computeStreak(next);
  }

  /**
   * Applies a change on screen straight away, then lands it in shared state.
   * `patchState` re-reads storage first, so a write here can't clobber
   * keystrokes counted by the background worker in the meantime.
   */
  async #commit(mutate: (s: MarloweState) => MarloweState) {
    this.data = mutate(this.data);
    if (this.source !== 'live') return;
    try {
      await patchState((draft) => mutate(draft));
    } catch {
      /* the change stays on screen; the next write or event will resync */
    }
  }

  equipLocation(id: string) {
    if (!this.data.inventory.locations.includes(id)) return;
    this.#commit((s) => ({ ...s, equipped: { ...s.equipped, location: id } }));
  }

  markRead(id: string) {
    const item = this.data.mail.find((m) => m.id === id);
    if (!item || item.read) return;
    this.#commit((s) => ({
      ...s,
      mail: s.mail.map((m): MailItem => (m.id === id ? { ...m, read: true } : m)),
    }));
  }
}

export const study = new StudyStore();
