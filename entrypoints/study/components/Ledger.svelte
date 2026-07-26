<script lang="ts">
  import type { MarloweState } from '../state';
  import { n } from '../format';

  interface Props {
    state: MarloweState;
    streak: number;
  }

  let { state, streak }: Props = $props();

  // A notebook page with dotted leaders, not a stat grid.
  let rows = $derived([
    ['Words today', n(state.today.words)],
    ['Words all told', n(state.totalWords)],
    ['Nights in a row', n(streak)],
    ['Books finished', n(state.published.length)],
    ['Keystrokes counted', n(state.totalKeystrokes)],
    ['Coins in the tin', n(state.coins)],
  ]);
</script>

<div class="days">
  {#each rows as [label, value] (label)}
    <p class="row">
      <span class="k">{label}</span>
      <span class="dots" aria-hidden="true"></span>
      <span class="v">{value}</span>
    </p>
  {/each}
</div>

<style>
  .days {
    max-width: 420px;
    padding: 20px 22px 18px;
    border-radius: 2px;
    background: linear-gradient(180deg, var(--paper) 0%, var(--paper2) 100%);
    color: var(--ink);
    transform: rotate(-0.4deg);
    box-shadow:
      0 14px 28px rgba(0, 0, 0, 0.42),
      0 1px 0 rgba(255, 255, 255, 0.35) inset;
  }

  .row {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin: 0;
    padding: 6px 0;
  }

  .k {
    font-size: 14.5px;
    color: var(--ink2);
    white-space: nowrap;
  }

  .dots {
    flex: 1;
    border-bottom: 1px dotted rgba(59, 46, 38, 0.3);
    transform: translateY(-4px);
  }

  .v {
    font-family: var(--data);
    font-size: 14px;
    font-variant-numeric: tabular-nums;
    color: var(--ink);
  }
</style>
