/**
 * Streak, read from shared state.
 *
 * This used to keep its own append-only day log in the Study's `localStorage`,
 * which meant the log only grew on days you happened to open the Study. Write
 * for a week without opening it and the streak read as one. The log now lives
 * in `gw:state.days` and is appended by the background worker at the moment
 * words are earned, so this file is a thin re-export.
 */
export { computeStreak, shiftDay } from '~/lib/state';
