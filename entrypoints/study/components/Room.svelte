<script lang="ts">
  import { sceneFor, frameCount, DEFAULT_LOCATION } from '../sprites';
  import { nameOf } from '../catalog';
  import { ago } from '../format';

  interface Props {
    location: string;
    lastKeyAt: number;
  }

  let { location, lastKeyAt }: Props = $props();

  let scene = $derived(sceneFor(location));
  let alt = $derived(`Marlowe writing at ${nameOf(location).toLowerCase()}.`);

  // The manifest count is used immediately; the sheet is then measured, so a
  // re-cut sheet can never desync the animation from the artwork.
  let frames = $state(sceneFor(DEFAULT_LOCATION).frames);
  $effect(() => {
    const { sheet, frames: declared } = scene;
    frames = declared;
    const img = new Image();
    img.onload = () => {
      frames = frameCount(img.naturalWidth, img.naturalHeight, declared);
    };
    img.src = sheet;
  });
</script>

<figure class="pool">
  <div
    class="cat"
    role="img"
    aria-label={alt}
    style="--frames:{frames}; --dur:{scene.durationMs}ms; background-image:url({scene.sheet});"
  ></div>

  <!-- The surface he sits on, drawn through the ink filter rather than ruled. -->
  <svg class="surface" viewBox="0 0 250 16" preserveAspectRatio="none" aria-hidden="true">
    <path d="M6,8 C70,5 150,12 244,7" filter="url(#soften)" />
  </svg>

  <figcaption>Last wrote {ago(lastKeyAt)}.</figcaption>
</figure>

<style>
  .pool {
    position: relative;
    margin: 0;
    padding-bottom: 6px;
  }

  /* The lamplight actually pooling on him. This is the page's one idea. */
  .pool::before {
    content: '';
    position: absolute;
    left: 50%;
    top: 42%;
    width: 340px;
    height: 300px;
    transform: translate(-50%, -50%);
    border-radius: 50%;
    pointer-events: none;
    background: radial-gradient(closest-side, rgba(255, 203, 126, 0.26), transparent 72%);
    animation: breathe 7s ease-in-out infinite;
  }

  @keyframes breathe {
    0%,
    100% {
      opacity: 0.86;
    }
    50% {
      opacity: 1;
    }
  }

  .cat {
    position: relative;
    width: 238px;
    height: 238px;
    margin: 0 auto -10px;
    background-repeat: no-repeat;
    background-size: calc(238px * var(--frames)) 238px;
    animation: walk var(--dur) steps(var(--frames)) infinite alternate;
  }

  /* Forward then backward, so the source clip never needs a natural loop. */
  @keyframes walk {
    from {
      background-position: 0 0;
    }
    to {
      background-position: calc(-238px * var(--frames)) 0;
    }
  }

  .surface {
    display: block;
    width: 250px;
    height: 16px;
    margin: 0 auto;
  }

  .surface path {
    stroke: var(--wood);
    stroke-width: 5;
    fill: none;
    stroke-linecap: round;
  }

  figcaption {
    margin-top: 12px;
    text-align: center;
    font-size: 12.5px;
    color: var(--text3);
  }

  @media (max-width: 720px) {
    .cat {
      width: 200px;
      height: 200px;
      background-size: calc(200px * var(--frames)) 200px;
    }

    @keyframes walk {
      from {
        background-position: 0 0;
      }
      to {
        background-position: calc(-200px * var(--frames)) 0;
      }
    }

    .surface {
      width: 210px;
    }
  }

  /*
   * Slowed, never stopped. Windows reports reduced-motion when someone merely
   * turns off animation effects for performance, and freezing the companion
   * turns the whole product into a sticker for those users.
   */
  @media (prefers-reduced-motion: reduce) {
    .cat {
      animation-duration: calc(var(--dur) * 1.3);
    }

    .pool::before {
      animation: none;
    }
  }
</style>
