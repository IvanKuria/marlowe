/**
 * Adapter over the shared state module.
 *
 * The Study imports everything through this one file so there is a single
 * place to repoint if `lib/state.ts` moves, and so it's obvious at a glance
 * which parts of the shared contract this page depends on.
 */
export type {
  MarloweState,
  PublishedWork,
  MailItem,
} from '~/lib/state';

export {
  WORDS_PER_CHAPTER,
  CHAPTERS_PER_WORK,
  todayKey,
  normalize,
  loadState,
  patchState,
  subscribe,
} from '~/lib/state';
