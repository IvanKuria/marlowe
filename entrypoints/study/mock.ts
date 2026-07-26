import type { MarloweState } from './state';
import { todayKey } from './state';

const MIN = 60_000;
const DAY = 86_400_000;
const now = Date.now();

/**
 * Stand-in state so The Study renders on its own — in a plain browser tab,
 * in review, or on a fresh profile before the cat has typed anything.
 * Never written back to storage.
 */
export const MOCK_STATE: MarloweState = {
  version: 1,
  totalKeystrokes: 412_889,
  totalWords: 68_412,
  today: { date: todayKey(), words: 1_247 },
  current: {
    projectId: 'p-11',
    genre: 'Nautical gothic',
    title: 'The Lighthouse Keeper Declines',
    chapter: 4,
    wordsInChapter: 388,
  },
  published: [
    { id: 'w-1', title: 'Salt and Other Weathers', genre: 'Nautical gothic', words: 6_020, publishedAt: now - 96 * DAY, spineColor: '#5A61C2' },
    { id: 'w-2', title: 'A Brief History of Naps', genre: 'Memoir', words: 5_140, publishedAt: now - 71 * DAY, spineColor: '#B25B45' },
    { id: 'w-3', title: 'The Wednesday Conspiracy', genre: 'Cosy mystery', words: 6_890, publishedAt: now - 52 * DAY, spineColor: '#5C7A54' },
    { id: 'w-4', title: 'Nine Lives, Poorly Spent', genre: 'Picaresque', words: 6_310, publishedAt: now - 33 * DAY, spineColor: '#B8842A' },
    { id: 'w-5', title: 'Mice of the Northern Provinces', genre: 'Epic', words: 7_450, publishedAt: now - 19 * DAY, spineColor: '#2F3B4C' },
    { id: 'w-6', title: 'Yarn', genre: 'Experimental', words: 4_880, publishedAt: now - 6 * DAY, spineColor: '#8A4A6B' },
  ],
  coins: 1_240,
  inventory: {
    locations: ['desk', 'armchair'],
  },
  equipped: { location: 'desk' },
  mail: [
    {
      id: 'm-1',
      from: 'Bramble, aged 9',
      kind: 'fan',
      read: false,
      receivedAt: now - 22 * MIN,
      body: 'I read Yarn twice. The part where the ball rolls under the sofa and nobody talks about it for three chapters made my mum cry. Please write a longer one next time. I have saved you a ribbon.',
      giftId: 'g-ribbon',
    },
    {
      id: 'm-2',
      from: 'The Quarterly Whisker',
      kind: 'review',
      read: false,
      receivedAt: now - 5 * 3600_000,
      body: 'Mice of the Northern Provinces is ambitious to the point of rudeness. Seven hundred pages and not one of them apologises. We are, reluctantly, admirers.',
    },
    {
      id: 'm-3',
      from: 'Pemberton & Hare, Publishers',
      kind: 'rejection',
      read: true,
      receivedAt: now - 2 * DAY,
      body: 'Thank you for sending A Brief History of Naps. While the prose is unusually warm, our list is full through spring and we do not currently publish memoir by cats.',
    },
    {
      id: 'm-4',
      from: 'Odile V.',
      kind: 'fan',
      read: true,
      receivedAt: now - 4 * DAY,
      body: 'I keep The Wednesday Conspiracy by the kettle and read a page while the water goes. It has lasted me four months. That is the highest praise I know how to give.',
    },
    {
      id: 'm-5',
      from: 'Shelf & Candle Review',
      kind: 'review',
      read: true,
      receivedAt: now - 9 * DAY,
      body: 'Salt and Other Weathers is a small book that behaves like a large one. Recommended for anyone who has ever stood at a window during a storm and felt personally addressed.',
    },
  ],
  settings: {
    peek: { corner: 'br', dx: 24, dy: 24, collapsed: false },
    mutedHosts: [],
    motion: 'auto',
    enabled: true,
  },
  // A fortnight of writing, so the sample study shows a streak rather than a
  // lonely 1. Dates are generated rather than literal so the mock never rots.
  days: Array.from({ length: 14 }, (_, i) => todayKey(now - (13 - i) * DAY)),
  lastKeyAt: now - 4 * MIN,
};
