<script lang="ts">
  import type { MailItem } from '../state';

  interface Props {
    mail: MailItem[];
    onopen: (id: string) => void;
  }

  let { mail, onopen }: Props = $props();

  // Newest first, and only a handful on screen; the rest are just history.
  let shown = $derived([...mail].sort((a, b) => b.receivedAt - a.receivedAt).slice(0, 6));

  const KIND: Record<MailItem['kind'], string> = {
    fan: 'a reader',
    review: 'a review',
    rejection: 'returned',
  };
</script>

<div class="post">
  {#each shown as item (item.id)}
    {#if item.read}
      <article class="note" class:turned={item.kind === 'rejection'}>
        <p class="who">{item.from}, {KIND[item.kind]}</p>
        <p class="body">{item.body}</p>
      </article>
    {:else}
      <!--
        An unread letter is a sealed envelope you open. No unread dot, no badge,
        no legend: the state is the object's shape.
      -->
      <button class="sealed" onclick={() => onopen(item.id)}>
        <svg viewBox="0 0 246 150" aria-hidden="true">
          <path class="flap" d="M0,3 L123,84 L246,3" />
          <circle class="seal" cx="123" cy="84" r="11" />
        </svg>
        <span class="lbl">unopened</span>
        <span class="sr-only">Open the letter from {item.from}</span>
      </button>
    {/if}
  {/each}

  {#if !shown.length}
    <p class="empty">The post has not been yet.</p>
  {/if}
</div>

<style>
  .post {
    display: flex;
    flex-wrap: wrap;
    gap: 18px;
    align-items: flex-start;
  }

  /* Slight, alternating rotations so they read as paper, not as tiles. */
  .note,
  .sealed {
    width: 246px;
    border-radius: 2px;
    box-shadow:
      0 12px 24px rgba(0, 0, 0, 0.4),
      0 1px 0 rgba(255, 255, 255, 0.35) inset;
  }

  .note {
    position: relative;
    padding: 16px 18px 18px;
    background: linear-gradient(180deg, var(--paper) 0%, var(--paper2) 100%);
    color: var(--ink);
  }

  .post > :nth-child(3n + 1) {
    transform: rotate(-1.3deg);
  }

  .post > :nth-child(3n + 2) {
    transform: rotate(0.9deg);
  }

  .post > :nth-child(3n + 3) {
    transform: rotate(-0.4deg);
  }

  .who {
    font-size: 12.5px;
    color: var(--ink2);
    margin: 0 0 6px;
  }

  .body {
    font-family: var(--serif);
    font-size: 14.5px;
    line-height: 1.55;
    margin: 0;
  }

  .note.turned {
    background: linear-gradient(180deg, #ded0b4, #cdbb98);
  }

  .note.turned .body {
    color: #6a5346;
  }

  .note.turned .who {
    color: var(--brick);
  }

  .sealed {
    position: relative;
    height: 150px;
    padding: 0;
    border: none;
    font: inherit;
    cursor: pointer;
    background: linear-gradient(180deg, #e3d2af, #cdb994);
    transition: translate 200ms ease;
  }

  .sealed:hover,
  .sealed:focus-visible {
    translate: 0 -4px;
  }

  .sealed svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }

  .flap {
    fill: rgba(0, 0, 0, 0.07);
    stroke: rgba(59, 46, 38, 0.22);
    stroke-width: 1;
  }

  .seal {
    fill: var(--brick);
  }

  .lbl {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 14px;
    text-align: center;
    font-size: 12.5px;
    color: #6a5346;
  }

  .empty {
    font-family: var(--serif);
    font-style: italic;
    font-size: 14px;
    color: var(--text3);
    margin: 0;
  }

  @media (max-width: 720px) {
    .note,
    .sealed {
      width: 100%;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .sealed {
      transition: none;
    }
  }
</style>
