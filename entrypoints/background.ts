import {
  CHAPTERS_PER_WORK,
  KEYSTROKES_PER_WORD,
  MAX_MAIL,
  SPINE_COLORS,
  WORDS_PER_CHAPTER,
  loadState,
  newId,
  newProject,
  patchState,
  recordDay,
  todayKey,
  type MarloweMessage,
  type MarloweState,
  type MailItem,
} from '~/lib/state';

/**
 * MV3 service worker.
 *
 * Hard rule for this file: NO module-scope mutable state, no setInterval, no
 * setTimeout. Chrome kills this worker after ~30s idle and restarts it on the
 * next event, so anything held in memory is lost without warning and any timer
 * simply never fires. Every handler does a read-modify-write against
 * chrome.storage.local, and anything time-dependent is derived from timestamps
 * that were persisted alongside the data.
 */

// A regular extension page, NOT a chrome_url_overrides newtab replacement.
// Locations are baked into the sprite and therefore visible on every page, so
// there is no reason to hijack the user's new tab.
const STUDY_PAGE = 'study.html';

/* ------------------------------------------------------------------ */
/* progress                                                            */
/* ------------------------------------------------------------------ */

/** Roll `today` over if the stored date is no longer today. */
function rollDay(state: MarloweState, at: number): void {
  const key = todayKey(at);
  if (state.today.date !== key) {
    state.today = { date: key, words: 0 };
  }
}

function publishCurrentWork(state: MarloweState, at: number): void {
  const words = WORDS_PER_CHAPTER * CHAPTERS_PER_WORK;
  state.published.push({
    id: state.current.projectId,
    title: state.current.title,
    genre: state.current.genre,
    words,
    publishedAt: at,
    spineColor: SPINE_COLORS[state.published.length % SPINE_COLORS.length]!,
  });
  state.coins += 50;
  state.mail.push(makeMail(state.current.title, at));
  // Mail is a flavour feed, not an archive. Left uncapped, a heavy writer
  // accumulates letters forever and every Study load parses all of them.
  if (state.mail.length > MAX_MAIL) state.mail = state.mail.slice(-MAX_MAIL);
  state.current = newProject();
}

function makeMail(title: string, at: number): MailItem {
  const options: Array<Pick<MailItem, 'from' | 'body' | 'kind'>> = [
    {
      from: 'A reader in Lisbon',
      kind: 'fan',
      body: `I finished "${title}" on the tram and missed my stop. Please write faster.`,
    },
    {
      from: 'The Quarterly Shelf',
      kind: 'review',
      body: `"${title}" — three and a half stars. Ambitious, damp in places, oddly moving.`,
    },
    {
      from: 'Halloway & Sons, Publishers',
      kind: 'rejection',
      body: `Thank you for sending "${title}". It is not right for our list at this time.`,
    },
  ];
  const choice = options[Math.floor(Math.random() * options.length)]!;
  return { id: newId('mail'), receivedAt: at, read: false, ...choice };
}

/**
 * Fold a batch of keystrokes into the state.
 *
 * Words are derived from the running keystroke total rather than from each
 * batch, so a batch of 3 keystrokes at 2 keystrokes/word never rounds away the
 * leftover — the remainder is implicitly carried in totalKeystrokes.
 */
function applyKeystrokes(state: MarloweState, count: number, at: number): void {
  if (!Number.isFinite(count) || count <= 0) return;

  rollDay(state, at);

  const before = Math.floor(state.totalKeystrokes / KEYSTROKES_PER_WORD);
  state.totalKeystrokes += Math.floor(count);
  const after = Math.floor(state.totalKeystrokes / KEYSTROKES_PER_WORD);
  const gained = after - before;

  state.lastKeyAt = Math.max(state.lastKeyAt, at);
  if (gained <= 0) return;

  state.totalWords += gained;
  state.today.words += gained;
  state.current.wordsInChapter += gained;
  // The day log has to be appended here, at the moment words are earned. It
  // used to be written by the Study page, so writing for a week without ever
  // opening the Study recorded nothing and reset the streak to one.
  recordDay(state, state.today.date);

  // A single batch can, in theory, span several chapters.
  let guard = 0;
  while (state.current.wordsInChapter >= WORDS_PER_CHAPTER && guard++ < 1000) {
    state.current.wordsInChapter -= WORDS_PER_CHAPTER;
    state.current.chapter += 1;
    if (state.current.chapter > CHAPTERS_PER_WORK) {
      const carry = state.current.wordsInChapter;
      publishCurrentWork(state, at);
      state.current.wordsInChapter = carry;
    }
  }
}

/* ------------------------------------------------------------------ */
/* wiring                                                              */
/* ------------------------------------------------------------------ */

async function openStudy(): Promise<void> {
  const url = chrome.runtime.getURL(STUDY_PAGE);

  // Reuse an already-open Study tab instead of piling up duplicates. The `url`
  // query filter normally wants the "tabs" permission, which we intentionally
  // do not request — if Chrome rejects it we simply open a fresh tab.
  try {
    const existing = await chrome.tabs.query({ url });
    const first = existing[0];
    if (first?.id != null) {
      await chrome.tabs.update(first.id, { active: true });
      if (first.windowId != null) await chrome.windows.update(first.windowId, { focused: true });
      return;
    }
  } catch {
    /* fall through to opening a new tab */
  }

  await chrome.tabs.create({ url });
}

export default defineBackground(() => {
  chrome.runtime.onInstalled.addListener((details) => {
    // Seed storage on first install; a no-op patch normalizes older shapes.
    void patchState(() => {}).then(() => {
      // Without this the whole install is silent: the cat only appears on the
      // next page load, in a corner, with nothing explaining him. Opening the
      // Study once is the entire onboarding.
      if (details.reason === 'install') void openStudy();
    });
  });

  chrome.runtime.onMessage.addListener((message: MarloweMessage, _sender, sendResponse) => {
    switch (message?.type) {
      case 'keys': {
        const at = typeof message.at === 'number' ? message.at : Date.now();
        patchState((draft) => {
          // Checked here rather than only in the content script so that a
          // frame which loaded before the switch was flipped can't keep
          // feeding the worker.
          if (!draft.settings.enabled) return;
          applyKeystrokes(draft, message.count, at);
        })
          .then((next) => sendResponse({ ok: true, state: next }))
          .catch((err) => sendResponse({ ok: false, error: String(err) }));
        return true; // async response
      }

      case 'open-study': {
        openStudy()
          .then(() => sendResponse({ ok: true }))
          .catch((err) => sendResponse({ ok: false, error: String(err) }));
        return true;
      }

      case 'set-settings': {
        patchState((draft) => {
          draft.settings = { ...draft.settings, ...message.patch };
        })
          .then((next) => sendResponse({ ok: true, state: next }))
          .catch((err) => sendResponse({ ok: false, error: String(err) }));
        return true;
      }

      case 'get-state': {
        loadState()
          .then((state) => sendResponse({ ok: true, state }))
          .catch((err) => sendResponse({ ok: false, error: String(err) }));
        return true;
      }

      default:
        return false;
    }
  });
});
