/**
 * Backup and restore.
 *
 * WHY THIS EXISTS
 * ---------------
 * All of Marlowe's state is one key in `chrome.storage.local`. That survives
 * extension updates, disable/re-enable, and clearing browsing data — but NOT
 * uninstalling, deleting the Chrome profile, or moving to another machine. The
 * whole point of the product is an accumulating record, so "your 60,000 words
 * are gone and there is no copy" is not an acceptable failure mode.
 *
 * WHY NOT chrome.storage.sync
 * ---------------------------
 * It looks like the obvious fix and it is the wrong tool for the hot path.
 * `sync` allows ~1800 writes/hour and ~120/minute; keystrokes land in batches
 * up to four times a second, which is two orders of magnitude over budget. It
 * also caps a single item at 8KB, which a long shelf plus the mail feed will
 * exceed. A correct sync design mirrors a compact summary on a long debounce
 * AND merges by taking the max of each counter, because two devices writing
 * last-write-wins would silently delete words. That is worth building, but it
 * is a bigger change than a file the user owns, and it is not a prerequisite
 * for shipping. This is.
 */
import { STORAGE_KEY, loadState, normalize, saveState, type MarloweState } from './state';

/** Bumped only if the envelope shape changes, never for state schema changes. */
const BACKUP_VERSION = 1;

export interface Backup {
  format: 'marlowe-backup';
  backupVersion: number;
  exportedAt: number;
  state: MarloweState;
}

export async function exportBackup(): Promise<Backup> {
  return {
    format: 'marlowe-backup',
    backupVersion: BACKUP_VERSION,
    exportedAt: Date.now(),
    state: await loadState(),
  };
}

/** `marlowe-2026-07-26.json` — sorts chronologically in a downloads folder. */
export function backupFilename(at: number = Date.now()): string {
  const d = new Date(at);
  const p = (n: number) => String(n).padStart(2, '0');
  return `marlowe-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.json`;
}

export class BackupError extends Error {}

/**
 * Parse a backup file without touching storage.
 *
 * Separate from `restore` on purpose: the caller can show the user what they
 * are about to overwrite before anything is destroyed.
 */
export function parseBackup(text: string): MarloweState {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupError('That file is not readable JSON.');
  }

  if (!raw || typeof raw !== 'object') {
    throw new BackupError('That file does not contain a backup.');
  }

  const bag = raw as Partial<Backup>;
  if (bag.format !== 'marlowe-backup') {
    throw new BackupError('That file was not written by Marlowe.');
  }
  if (typeof bag.backupVersion !== 'number' || bag.backupVersion > BACKUP_VERSION) {
    throw new BackupError('That backup was written by a newer version. Update Marlowe first.');
  }

  // `normalize` fills in anything an older backup is missing, so a file from
  // any past version restores rather than being rejected for a missing field.
  return normalize(bag.state);
}

/**
 * Overwrite everything with the backup's contents.
 *
 * Deliberately a replace and not a merge. Merging two histories means deciding
 * which shelf is real, and getting that wrong quietly corrupts the record;
 * replacing is destructive but always comprehensible. The caller is expected to
 * confirm first.
 */
export async function restoreBackup(state: MarloweState): Promise<void> {
  await saveState(state);
}

/** What restoring would replace, so the confirmation can be specific. */
export function describe(state: MarloweState): string {
  const books = state.published.length;
  return [
    `${state.totalWords.toLocaleString()} words`,
    `${books} ${books === 1 ? 'book' : 'books'}`,
    `${state.days.length} ${state.days.length === 1 ? 'day' : 'days'} of writing`,
  ].join(', ');
}

export { STORAGE_KEY };
