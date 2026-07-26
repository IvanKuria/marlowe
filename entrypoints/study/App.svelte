<script lang="ts">
  import { study } from './store.svelte';
  import Room from './components/Room.svelte';
  import Manuscript from './components/Manuscript.svelte';
  import Ledger from './components/Ledger.svelte';
  import Shelf from './components/Shelf.svelte';
  import Post from './components/Post.svelte';
  import Places from './components/Places.svelte';
  import Keeping from './components/Keeping.svelte';
  import { LOCATIONS } from './catalog';

  // Follow shared state for as long as the tab is open.
  $effect(() => study.start());

  let s = $derived(study.data);

  let unread = $derived(s.mail.filter((m) => !m.read).length);
  let owned = $derived(s.inventory.locations.length);

  function equip(id: string) {
    study.equipLocation(id);
  }
</script>

<!--
  The ink filter every drawn edge on this page runs through. feTurbulence
  displaces the stroke so a rule wobbles and bleeds like the cat's own outline
  instead of sitting there as a 1px CSS border.
-->
<svg class="defs" aria-hidden="true">
  <defs>
    <filter id="soften" x="-8%" y="-40%" width="116%" height="180%">
      <feTurbulence
        type="fractalNoise"
        baseFrequency="0.022 0.05"
        numOctaves="3"
        seed="7"
        result="n"
      />
      <feDisplacementMap
        in="SourceGraphic"
        in2="n"
        scale="3"
        xChannelSelector="R"
        yChannelSelector="G"
      />
    </filter>
  </defs>
</svg>

<div class="room">
  <div class="inner">
    {#if study.source === 'mock'}
      <p class="sample">A sample study. Nothing here has been recorded yet.</p>
    {/if}

    <section class="desk">
      <Room location={s.equipped.location} lastKeyAt={s.lastKeyAt} />
      <Manuscript current={s.current} />
    </section>

    <section class="area">
      <h2>His shelf</h2>
      <p class="sub">
        {#if s.published.length}
          {s.published.length} finished. The next has a space waiting.
        {:else}
          Nothing finished yet. The first space is waiting.
        {/if}
      </p>
      <Shelf published={s.published} />
    </section>

    <section class="area">
      <h2>The post</h2>
      <p class="sub">
        {#if !s.mail.length}
          Nothing has arrived. Finish a book and it will.
        {:else if unread === 1}
          One still sealed.
        {:else if unread}
          {unread} still sealed.
        {:else}
          All opened.
        {/if}
      </p>
      <Post mail={s.mail} onopen={(id) => study.markRead(id)} />
    </section>

    <section class="area">
      <h2>Where he writes</h2>
      <p class="sub">{owned} of {LOCATIONS.length} rooms.</p>
      <Places inventory={s.inventory} equipped={s.equipped} onequip={equip} />
    </section>

    <section class="area">
      <h2>The book of days</h2>
      <p class="sub">Kept nightly.</p>
      <Ledger state={s} streak={study.streak} />
      <p class="whisper">He counts that you typed. He never sees what.</p>
    </section>

    <section class="area">
      <h2>Keeping it</h2>
      <p class="sub">A copy you own.</p>
      <Keeping existing={s} live={study.source === 'live'} />
    </section>
  </div>
</div>

<style>
  .defs {
    position: absolute;
    width: 0;
    height: 0;
  }

  /* One light source, up and to the left, everything falling off from it. */
  .room {
    position: relative;
    min-height: 100vh;
    overflow: hidden;
    padding: 64px 32px 96px;
    background:
      radial-gradient(760px 560px at 26% 16%, rgba(255, 203, 126, 0.2), transparent 62%),
      radial-gradient(1400px 900px at 26% 16%, rgba(227, 146, 71, 0.09), transparent 70%),
      linear-gradient(165deg, var(--warm) 0%, var(--night) 46%, var(--night2) 100%);
  }

  /* Grain, so the dark is a room rather than flat digital black. */
  .room::after {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    opacity: 0.16;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)'/%3E%3C/svg%3E");
  }

  .inner {
    position: relative;
    z-index: 1;
    max-width: 900px;
    margin: 0 auto;
  }

  .sample {
    margin: 0 0 28px;
    font-family: var(--serif);
    font-style: italic;
    font-size: 14px;
    color: var(--text3);
  }

  .desk {
    display: grid;
    grid-template-columns: 250px 1fr;
    gap: 40px;
    align-items: end;
  }

  .area {
    margin-top: 70px;
  }

  .area h2 {
    font-family: var(--serif);
    font-size: 19px;
    font-weight: 400;
    color: var(--text);
    margin: 0 0 4px;
  }

  .sub {
    font-size: 13.5px;
    color: var(--text2);
    margin: 0 0 22px;
  }

  .whisper {
    margin-top: 34px;
    font-family: var(--serif);
    font-style: italic;
    font-size: 14px;
    color: var(--text3);
  }

  @media (max-width: 720px) {
    .room {
      padding: 40px 20px 72px;
    }

    .desk {
      grid-template-columns: 1fr;
      gap: 24px;
    }
  }
</style>
