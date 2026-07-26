/**
 * Marlowe shared state.
 *
 * Single source of truth: one JSON blob in `chrome.storage.local` under
 * STORAGE_KEY. Nothing is cached in module scope on purpose — the MV3 service
 * worker is torn down after ~30s idle, so any module-level cache would silently
 * diverge between contexts. Every helper reads and writes storage directly.
 */

export interface PublishedWork {
  id: string;
  title: string;
  genre: string;
  words: number;
  publishedAt: number;
  spineColor: string;
}

export interface MailItem {
  id: string;
  from: string;
  body: string;
  kind: 'fan' | 'review' | 'rejection';
  receivedAt: number;
  read: boolean;
  giftId?: string;
}

export interface MarloweState {
  version: 1;
  totalKeystrokes: number;
  totalWords: number;
  today: { date: string; words: number };
  current: {
    projectId: string;
    genre: string;
    title: string;
    chapter: number;
    wordsInChapter: number;
  };
  published: PublishedWork[];
  coins: number;
  /**
   * Locations only. Outfits were cut before launch: the outfit is drawn into
   * the same sprite as the furniture, so every outfit multiplies against every
   * location (2 x 4 x 3 cycles = 24 clips) for a change nobody can see at 80px.
   */
  inventory: { locations: string[] };
  equipped: { location: string };
  mail: MailItem[];
  settings: {
    peek: { corner: 'tl' | 'tr' | 'bl' | 'br'; dx: number; dy: number; collapsed: boolean };
    mutedHosts: string[];
    /**
     * Animation policy.
     *  auto    — follow the OS `prefers-reduced-motion` hint (default)
     *  full    — always animate at full speed, ignoring the OS
     *  reduced — always slow down, regardless of the OS
     *
     * The override exists because Windows reports reduced-motion when the user
     * merely turns off "animation effects" for performance, which is not the
     * same request as a vestibular accommodation.
     */
    motion: 'auto' | 'full' | 'reduced';
    /** Master switch. When false the sprite never mounts and nothing counts. */
    enabled: boolean;
  };
  /**
   * Sorted YYYY-MM-DD list of days the cat wrote at least one word.
   *
   * This lives in shared state, not in the Study's own storage, because it has
   * to be appended by the background worker at the moment words are earned. An
   * earlier version recorded it from the Study page, which meant a week of
   * writing without ever opening the Study silently broke the streak.
   */
  days: string[];
  lastKeyAt: number;
}

export const STORAGE_KEY = 'gw:state';
export const KEYSTROKES_PER_WORD = 2;
export const WORDS_PER_CHAPTER = 600;
export const CHAPTERS_PER_WORK = 10;

/** Caps on the two arrays that would otherwise grow without bound. */
export const MAX_MAIL = 40;
export const MAX_DAYS = 400;

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

/** Local-timezone YYYY-MM-DD. Used for the daily rollover. */
export function todayKey(at: number = Date.now()): string {
  const d = new Date(at);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function newId(prefix = 'id'): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}_${rand}`;
}

export const GENRES = [
  'Cozy Mystery',
  'Space Opera',
  'Gothic Romance',
  'Hardboiled Noir',
  'Pastoral Fantasy',
  'Absurdist Memoir',
  'Nautical Adventure',
  'Quiet Horror',
] as const;

const TITLE_A = [
  'The Long',
  'A Season of',
  'Nine',
  'The Last',
  'Notes on',
  'The Quiet',
  'Concerning',
  'A Brief History of',
];
const TITLE_B = [
  'Afternoon',
  'Windows',
  'Lighthouses',
  'Small Betrayals',
  'Rain',
  'Cartographers',
  'Sundays',
  'Unfinished Rooms',
];

export const SPINE_COLORS = [
  '#7a4b3a',
  '#3f5e57',
  '#5b4a72',
  '#8a6b2f',
  '#2f4858',
  '#79383f',
  '#4a6741',
  '#6b3f5e',
];

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

export function makeTitle(): string {
  return `${pick(TITLE_A)} ${pick(TITLE_B)}`;
}

export function newProject(): MarloweState['current'] {
  return {
    projectId: newId('proj'),
    genre: pick(GENRES),
    title: makeTitle(),
    chapter: 1,
    wordsInChapter: 0,
  };
}

/* ------------------------------------------------------------------ */
/* defaults + persistence                                              */
/* ------------------------------------------------------------------ */

export function defaultState(): MarloweState {
  return {
    version: 1,
    totalKeystrokes: 0,
    totalWords: 0,
    today: { date: todayKey(), words: 0 },
    current: newProject(),
    published: [],
    coins: 0,
    inventory: { locations: ['desk'] },
    equipped: { location: 'desk' },
    mail: [],
    settings: {
      peek: { corner: 'br', dx: 24, dy: 24, collapsed: false },
      mutedHosts: [],
      motion: 'auto',
      enabled: true,
    },
    days: [],
    lastKeyAt: 0,
  };
}

/**
 * Fill in anything a previous (or partially written) state is missing so
 * consumers can rely on every field being present.
 */
export function normalize(raw: unknown): MarloweState {
  const d = defaultState();
  if (!raw || typeof raw !== 'object') return d;
  const s = raw as Partial<MarloweState>;

  return {
    version: 1,
    totalKeystrokes: num(s.totalKeystrokes, 0),
    totalWords: num(s.totalWords, 0),
    today: {
      date: typeof s.today?.date === 'string' ? s.today.date : d.today.date,
      words: num(s.today?.words, 0),
    },
    current: {
      projectId: s.current?.projectId ?? d.current.projectId,
      genre: s.current?.genre ?? d.current.genre,
      title: s.current?.title ?? d.current.title,
      chapter: num(s.current?.chapter, 1),
      wordsInChapter: num(s.current?.wordsInChapter, 0),
    },
    published: Array.isArray(s.published) ? s.published : [],
    coins: num(s.coins, 0),
    inventory: {
      locations: s.inventory?.locations ?? d.inventory.locations,
    },
    equipped: {
      location: s.equipped?.location ?? d.equipped.location,
    },
    mail: Array.isArray(s.mail) ? s.mail : [],
    settings: {
      peek: {
        corner: s.settings?.peek?.corner ?? d.settings.peek.corner,
        dx: num(s.settings?.peek?.dx, d.settings.peek.dx),
        dy: num(s.settings?.peek?.dy, d.settings.peek.dy),
        collapsed: Boolean(s.settings?.peek?.collapsed),
      },
      mutedHosts: Array.isArray(s.settings?.mutedHosts) ? s.settings.mutedHosts : [],
      motion:
        s.settings?.motion === 'full' || s.settings?.motion === 'reduced'
          ? s.settings.motion
          : 'auto',
      // Absent means "not yet migrated", which should read as on, not off.
      enabled: s.settings?.enabled !== false,
    },
    days: Array.isArray(s.days) ? s.days.filter((d) => typeof d === 'string') : [],
    lastKeyAt: num(s.lastKeyAt, 0),
  };
}

/** Append `date` to the day log if it isn't already there. Keeps it sorted. */
export function recordDay(state: MarloweState, date: string): void {
  if (!date) return;
  const last = state.days[state.days.length - 1];
  if (last === date) return; // the overwhelmingly common case
  if (state.days.includes(date)) return;
  state.days.push(date);
  state.days.sort();
  if (state.days.length > MAX_DAYS) state.days = state.days.slice(-MAX_DAYS);
}

/** Shift a YYYY-MM-DD key by whole days, honouring local DST. */
export function shiftDay(date: string, byDays: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(y ?? 1970, (m || 1) - 1, d || 1);
  dt.setDate(dt.getDate() + byDays);
  return todayKey(dt.getTime());
}

/**
 * Consecutive days ending today.
 *
 * A day that hasn't been written yet doesn't break the streak until it's over,
 * so a run ending yesterday still counts.
 */
export function computeStreak(state: MarloweState, at: number = Date.now()): number {
  const days = new Set(state.days);
  const today = todayKey(at);
  if (state.today.date === today && state.today.words > 0) days.add(today);

  let cursor = days.has(today) ? today : shiftDay(today, -1);
  let streak = 0;
  while (days.has(cursor)) {
    streak++;
    cursor = shiftDay(cursor, -1);
  }
  return streak;
}

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

/** Read the whole state. Always returns a fully-populated object. */
export async function loadState(): Promise<MarloweState> {
  const bag = await chrome.storage.local.get(STORAGE_KEY);
  return normalize(bag[STORAGE_KEY]);
}

/** Overwrite the whole state. */
export async function saveState(state: MarloweState): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: state });
}

/**
 * Serialises `patchState` calls within one worker lifetime.
 *
 * This is the one piece of module-scope state in the extension, and it holds
 * ordering only, never data. Without it, two tabs typing at the same moment
 * both `await loadState()` on the same value, then both write — and the second
 * write silently discards the first tab's keystrokes. If the service worker is
 * torn down mid-chain the variable resets to a resolved promise, which is
 * exactly the right recovery: there is nothing queued to preserve.
 */
let queue: Promise<unknown> = Promise.resolve();

/**
 * Read-modify-write. `fn` may mutate the draft in place or return a new state.
 * Calls are queued, so concurrent patches compose instead of clobbering.
 * Returns whatever was persisted.
 */
export function patchState(
  fn: (draft: MarloweState) => MarloweState | void | Promise<MarloweState | void>,
): Promise<MarloweState> {
  const run = queue.then(async () => {
    const draft = await loadState();
    const result = await fn(draft);
    const next = result ?? draft;
    await saveState(next);
    return next;
  });
  // Swallow rejections on the queue itself so one failed patch doesn't
  // permanently poison every patch that follows it.
  queue = run.catch(() => undefined);
  return run;
}

/**
 * Observe state changes. Fires on any write to STORAGE_KEY in `local`,
 * including writes from other contexts. Returns an unsubscribe function.
 */
export function subscribe(cb: (state: MarloweState) => void): () => void {
  const handler = (
    changes: Record<string, chrome.storage.StorageChange>,
    area: string,
  ): void => {
    if (area !== 'local') return;
    const change = changes[STORAGE_KEY];
    if (!change) return;
    cb(normalize(change.newValue));
  };
  chrome.storage.onChanged.addListener(handler);
  return () => chrome.storage.onChanged.removeListener(handler);
}

/* ------------------------------------------------------------------ */
/* messages (content script <-> background)                            */
/* ------------------------------------------------------------------ */

export interface KeysMessage {
  type: 'keys';
  /** Keystrokes observed since the last batch. */
  count: number;
  /** Timestamp of the most recent keystroke in this batch. */
  at: number;
}

export interface OpenStudyMessage {
  type: 'open-study';
}

export interface GetStateMessage {
  type: 'get-state';
}

/**
 * Shallow settings patch from the popup.
 *
 * Settings are written through the worker rather than straight to storage so
 * that every write goes through the same serialised queue as keystrokes; a
 * popup toggling "hide him here" while you are typing must not clobber the
 * words earned in between.
 */
export interface SetSettingsMessage {
  type: 'set-settings';
  patch: Partial<MarloweState['settings']>;
}

export type MarloweMessage =
  | KeysMessage
  | OpenStudyMessage
  | GetStateMessage
  | SetSettingsMessage;
