<script lang="ts">
  import type { MarloweState } from '../state';
  import { WORDS_PER_CHAPTER, CHAPTERS_PER_WORK } from '../state';
  import { n } from '../format';

  interface Props {
    current: MarloweState['current'];
  }

  let { current }: Props = $props();

  const LINES = 4;

  /**
   * The chapter drawn as handwriting filling a page.
   *
   * This replaced a progress bar. Same number, but it is the thing the product
   * is actually about: a page with words on it. Each stroke is a wobbling pen
   * line pushed through the ink filter, and the last written line stops
   * partway, exactly where he is.
   */
  let written = $derived((current.wordsInChapter / WORDS_PER_CHAPTER) * LINES);

  let lines = $derived(
    Array.from({ length: LINES }, (_, i) => {
      const y = 12 + i * 18;
      if (i >= written) return { y, d: '' };
      const frac = Math.min(1, written - i);
      // Completed lines stop a little short, the way handwriting does.
      const end = 6 + 382 * (i === Math.floor(written) ? frac : 0.9 - (i % 3) * 0.04);
      let d = `M6,${y}`;
      for (let x = 20; x < end; x += 15) d += ` Q${x - 7},${y - 3} ${x},${y}`;
      return { y, d };
    }),
  );

  let chapters = $derived(
    Array.from({ length: CHAPTERS_PER_WORK }, (_, i) => {
      const c = i + 1;
      return c < current.chapter ? 'done' : c === current.chapter ? 'here' : '';
    }),
  );
</script>

<div class="now">
  <p class="lede">Still at it.</p>
  <h1>{current.title}</h1>
  <p class="genre">{current.genre.toLowerCase()}</p>

  <div class="sheet">
    <svg viewBox="0 0 400 76" preserveAspectRatio="none" aria-hidden="true">
      {#each lines as line (line.y)}
        <line class="rule" x1="6" x2="394" y1={line.y} y2={line.y} />
        {#if line.d}
          <path class="hand" d={line.d} filter="url(#soften)" />
        {/if}
      {/each}
    </svg>
    <p class="count">
      <span>this chapter</span>
      <span><b>{n(current.wordsInChapter)}</b>/{n(WORDS_PER_CHAPTER)} words</span>
    </p>
  </div>

  <div class="chapters">
    {#each chapters as state, i (i)}
      <i class={state}></i>
    {/each}
    <span>chapter {current.chapter} of {CHAPTERS_PER_WORK}</span>
  </div>
</div>

<style>
  .now {
    padding-bottom: 6px;
  }

  .lede {
    font-family: var(--serif);
    font-style: italic;
    font-size: 15px;
    color: var(--text2);
    margin: 0 0 14px;
  }

  h1 {
    font-family: var(--serif);
    font-size: clamp(30px, 4.6vw, 42px);
    font-weight: 400;
    line-height: 1.15;
    margin: 0 0 6px;
    color: #f6e9d2;
    text-wrap: balance;
  }

  .genre {
    font-size: 13.5px;
    color: var(--lampdeep);
    margin: 0 0 20px;
  }

  .sheet {
    background: linear-gradient(180deg, var(--paper) 0%, var(--paper2) 100%);
    padding: 13px 15px 11px;
    border-radius: 2px;
    max-width: 400px;
    box-shadow:
      0 14px 26px rgba(0, 0, 0, 0.42),
      0 1px 0 rgba(255, 255, 255, 0.4) inset;
    transform: rotate(-0.5deg);
  }

  .sheet svg {
    display: block;
    width: 100%;
    height: 76px;
  }

  .rule {
    stroke: var(--ink);
    stroke-width: 1;
    opacity: 0.1;
  }

  .hand {
    stroke: var(--ink);
    stroke-width: 2.3;
    fill: none;
    stroke-linecap: round;
    opacity: 0.8;
  }

  .count {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    font-family: var(--data);
    font-size: 12.5px;
    font-variant-numeric: tabular-nums;
    color: var(--ink2);
    margin: 8px 0 0;
  }

  .count b {
    color: var(--ink);
    font-weight: 600;
  }

  /* Ten chapters as ten pages, not a segmented bar. */
  .chapters {
    display: flex;
    gap: 5px;
    margin-top: 16px;
    align-items: flex-end;
  }

  .chapters i {
    display: block;
    width: 13px;
    height: 17px;
    border-radius: 1px;
    background: rgba(233, 218, 187, 0.13);
    box-shadow: 0 0 0 1px rgba(233, 218, 187, 0.12) inset;
  }

  .chapters i.done {
    background: var(--paper2);
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.35);
  }

  .chapters i.here {
    background: var(--lamp);
    height: 21px;
  }

  .chapters span {
    font-size: 12.5px;
    color: var(--text3);
    margin-left: 10px;
  }
</style>
