<script lang="ts">
  import type { PublishedWork } from '../state';
  import { n, hash01 } from '../format';

  interface Props {
    published: PublishedWork[];
  }

  let { published }: Props = $props();

  let active = $state<string | null>(null);
  let shown = $derived(published.find((w) => w.id === active) ?? null);

  /**
   * Spine width follows word count and height varies a little per title, so the
   * shelf doubles as a chart of his output without ever looking like one.
   * Height uses a stable hash of the id, never Math.random, so a book does not
   * change shape between renders.
   */
  function width(words: number): number {
    return Math.round(15 + Math.min(words, 12_000) / 560);
  }

  function height(work: PublishedWork): number {
    return Math.round(84 + hash01(work.id) * 34);
  }
</script>

<div class="books">
  {#each published as work (work.id)}
    <button
      class="book"
      style="background: linear-gradient(90deg, {work.spineColor}, rgba(0,0,0,.25)), {work.spineColor};
             height: {height(work)}px; width: {width(work.words)}px;"
      onmouseenter={() => (active = work.id)}
      onfocus={() => (active = work.id)}
    >
      <span>{work.title}</span>
    </button>
  {/each}

  <!-- The gap is the one he is writing now. -->
  <div class="gap" aria-hidden="true"><div class="slot"></div></div>
</div>

<svg class="plank" viewBox="0 0 900 20" preserveAspectRatio="none" aria-hidden="true">
  <path d="M6,10 C240,6 520,15 894,9" filter="url(#soften)" />
</svg>

<p class="caption" aria-live="polite">
  {#if shown}
    <b>{shown.title}</b> &nbsp;<em>{shown.genre.toLowerCase()}, {n(shown.words)} words</em>
  {:else if published.length}
    Thicker spines took longer.
  {:else}
    The first one goes here.
  {/if}
</p>

<style>
  .books {
    display: flex;
    align-items: flex-end;
    gap: 3px;
    min-height: 132px;
    padding-left: 14px;
  }

  .book {
    position: relative;
    border: none;
    padding: 0;
    border-radius: 3px 3px 1px 1px;
    cursor: default;
    transform-origin: bottom center;
    transition: transform 220ms cubic-bezier(0.2, 0.9, 0.3, 1.2);
    box-shadow:
      inset -3px 0 6px rgba(0, 0, 0, 0.34),
      inset 3px 0 4px rgba(255, 255, 255, 0.09),
      0 3px 8px rgba(0, 0, 0, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }

  /* The gilt bands every worn hardback has. */
  .book::before,
  .book::after {
    content: '';
    position: absolute;
    left: 14%;
    right: 14%;
    height: 1.5px;
    background: rgba(255, 203, 126, 0.42);
  }

  .book::before {
    top: 11px;
  }

  .book::after {
    bottom: 13px;
  }

  .book span {
    writing-mode: vertical-rl;
    font-family: var(--serif);
    font-size: 9.5px;
    letter-spacing: 0.02em;
    color: rgba(255, 236, 207, 0.62);
    white-space: nowrap;
    max-height: 74px;
    overflow: hidden;
    padding-top: 4px;
  }

  .book:hover,
  .book:focus-visible {
    transform: translateY(-12px) rotate(-1.5deg);
  }

  .gap {
    width: 20px;
  }

  .slot {
    width: 20px;
    height: 96px;
    border-radius: 3px;
    background: repeating-linear-gradient(
      -45deg,
      rgba(255, 203, 126, 0.07) 0 4px,
      transparent 4px 8px
    );
    box-shadow: 0 0 0 1px rgba(255, 203, 126, 0.1) inset;
  }

  .plank {
    display: block;
    width: 100%;
    height: 20px;
    margin-top: -2px;
  }

  .plank path {
    stroke: var(--wood);
    stroke-width: 7;
    fill: none;
    stroke-linecap: round;
  }

  .caption {
    margin-top: 14px;
    min-height: 44px;
    font-family: var(--serif);
    font-size: 15px;
    color: var(--text2);
  }

  .caption b {
    color: #f0e1c9;
    font-weight: 400;
  }

  .caption em {
    font-style: normal;
    color: var(--text3);
    font-family: var(--sans);
    font-size: 13px;
  }

  @media (prefers-reduced-motion: reduce) {
    .book {
      transition: none;
    }
  }
</style>
