<script lang="ts">
  import type { MarloweState } from '../state';
  import { LOCATIONS } from '../catalog';
  import { SCENES } from '../sprites';
  import { n } from '../format';

  interface Props {
    inventory: MarloweState['inventory'];
    equipped: MarloweState['equipped'];
    onequip: (id: string) => void;
  }

  let { inventory, equipped, onequip }: Props = $props();

  /**
   * Rooms hang on the wall as small framed pictures, lit ones and dark ones.
   * A location without artwork yet shows an honest empty frame rather than a
   * placeholder swatch pretending to be a scene.
   */
  let items = $derived(
    LOCATIONS.map((item) => ({
      ...item,
      owned: inventory.locations.includes(item.id),
      here: equipped.location === item.id,
      scene: SCENES[item.id],
    })),
  );
</script>

<div class="frames">
  {#each items as item (item.id)}
    <button
      class="frame"
      class:here={item.here}
      class:empty={!item.scene}
      disabled={!item.owned || item.here || !item.scene}
      onclick={() => onequip(item.id)}
    >
      <span class="glass">
        {#if item.scene}
          <!--
            Locked rooms still show their artwork, dimmed. A black rectangle
            sells nothing: the picture IS the product, so hiding it until you
            have paid removes the only reason to want it.
          -->
          <span
            class="thumb"
            class:dim={!item.owned}
            style="--frames:{item.scene.frames}; --dur:{item.scene.durationMs}ms;
                   background-image:url({item.scene.sheet});"
          ></span>
        {:else}
          <span class="soon">not built yet</span>
        {/if}
      </span>
      <span class="name">{item.name}</span>
      <span class="state">
        {#if !item.scene}
          coming
        {:else if item.here}
          writing here
        {:else if item.owned}
          his
        {:else}
          {n(item.price)} coins
        {/if}
      </span>
    </button>
  {/each}
</div>

<style>
  .frames {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(158px, 1fr));
    gap: 20px;
  }

  .frame {
    display: block;
    width: 100%;
    padding: 9px;
    border: none;
    border-radius: 3px;
    text-align: center;
    font: inherit;
    color: inherit;
    cursor: pointer;
    background: linear-gradient(150deg, #5a4436, #38271f);
    box-shadow:
      0 8px 20px rgba(0, 0, 0, 0.42),
      0 0 0 1px rgba(255, 203, 126, 0.1) inset;
  }

  .frame:disabled {
    cursor: default;
  }

  .frame.empty {
    opacity: 0.62;
  }

  .glass {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 138px;
    border-radius: 2px;
    padding: 8px 0 4px;
    background: radial-gradient(
      120px 90px at 50% 42%,
      rgba(255, 203, 126, 0.16),
      rgba(20, 15, 19, 0.9) 78%
    );
  }

  .thumb {
    display: block;
    width: 126px;
    height: 126px;
    background-repeat: no-repeat;
    background-size: calc(126px * var(--frames)) 126px;
    animation: pane var(--dur) steps(var(--frames)) infinite alternate;
  }

  @keyframes pane {
    from {
      background-position: 0 0;
    }
    to {
      background-position: calc(-126px * var(--frames)) 0;
    }
  }

  .thumb.dim {
    filter: grayscale(0.85) brightness(0.62);
  }

  .soon {
    font-size: 12.5px;
    color: var(--text3);
  }

  .name {
    display: block;
    font-family: var(--serif);
    font-weight: 400;
    font-size: 14.5px;
    margin: 9px 0 2px;
    color: #efe0c8;
  }

  .state {
    display: block;
    font-size: 12px;
    color: var(--text3);
  }

  .frame.here .state {
    color: var(--lampdeep);
  }

  @media (prefers-reduced-motion: reduce) {
    .thumb {
      animation-duration: calc(var(--dur) * 1.3);
    }
  }
</style>
