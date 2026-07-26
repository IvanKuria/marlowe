/**
 * Sprite registry for the overlay.
 *
 * Each location is a COMPLETE scene — cat, outfit and furniture drawn together
 * — rather than a character composited over a background. That is why the
 * location is visible at 80px on every page instead of only inside the Study,
 * which is what makes locations worth owning.
 *
 * Every location provides three cycles:
 *   write  — pen in paw, working
 *   idle   — pen down, breathing, occasional blink
 *   sleep  — eyes closed, head lowered, slow breathing
 *
 * All three animate. Idle and sleep are not paused frames: a companion that
 * freezes solid the moment you stop typing reads as broken, not resting.
 *
 * Sheets are imported with `?inline` so they become base64 data URIs at build
 * time. Sites with a strict `img-src` CSP block `chrome-extension://` URLs,
 * which would leave an invisible sprite on exactly the pages people use most.
 *
 * Sheets come from `assets/pipeline.py` and are quantised to 48 colours
 * (~40KB each). Never ship an unquantised sheet: these are inlined into every
 * page load, and the raw versions are ~1.2MB apiece.
 *
 * SCALING NOTE: every registered sheet is inlined whether equipped or not, at
 * ~120KB per location. Four locations is the ceiling this approach supports;
 * we are at it. Adding a fifth means switching to fetching the equipped
 * location's sheets from the background worker on demand, rather than adding
 * another import here.
 */
import armchairIdle from '~/assets/sprites/armchair-idle.png?inline';
import armchairSleep from '~/assets/sprites/armchair-sleep.png?inline';
import armchairWrite from '~/assets/sprites/armchair.png?inline';
import deskIdle from '~/assets/sprites/desk-idle.png?inline';
import deskSleep from '~/assets/sprites/desk-sleep.png?inline';
import deskWrite from '~/assets/sprites/desk.png?inline';
import hearthIdle from '~/assets/sprites/hearth-idle.png?inline';
import hearthSleep from '~/assets/sprites/hearth-sleep.png?inline';
import hearthWrite from '~/assets/sprites/hearth.png?inline';
import windowIdle from '~/assets/sprites/window-idle.png?inline';
import windowSleep from '~/assets/sprites/window-sleep.png?inline';
import windowWrite from '~/assets/sprites/window.png?inline';

export type Cycle = 'write' | 'idle' | 'sleep';
export const CYCLES: readonly Cycle[] = ['write', 'idle', 'sleep'];

export interface SheetDef {
  /** base64 data: URI of the horizontal sheet */
  sheet: string;
  /** frames in the sheet */
  frames: number;
  /** one forward pass in ms; ping-pong makes the round trip twice this */
  durationMs: number;
}

/**
 * Location keys must match `equipped.location` in lib/state.ts.
 *
 * 24 frames, not 8. Eight frames over 880ms is ~9fps, which reads as a
 * flip-book however you time it — crispness is a frame-count problem, not a
 * speed problem. The frames are 176px against an 80px display (2.2x for
 * retina); the previous 300px was ~4x oversampled, and spending those bytes on
 * frames instead made every sheet both smoother AND smaller.
 *
 * Writing runs at ~24fps. Idle and sleep are deliberately slower — they are
 * breathing, not working — but over 24 frames they stay smooth rather than
 * stepping.
 */
export const SPRITES: Record<string, Record<Cycle, SheetDef>> = {
  desk: {
    write: { sheet: deskWrite, frames: 24, durationMs: 1000 },
    idle: { sheet: deskIdle, frames: 24, durationMs: 2600 },
    sleep: { sheet: deskSleep, frames: 24, durationMs: 4200 },
  },
  armchair: {
    write: { sheet: armchairWrite, frames: 24, durationMs: 1000 },
    idle: { sheet: armchairIdle, frames: 24, durationMs: 2600 },
    sleep: { sheet: armchairSleep, frames: 24, durationMs: 4200 },
  },
  window: {
    write: { sheet: windowWrite, frames: 24, durationMs: 1000 },
    idle: { sheet: windowIdle, frames: 24, durationMs: 2600 },
    sleep: { sheet: windowSleep, frames: 24, durationMs: 4200 },
  },
  hearth: {
    write: { sheet: hearthWrite, frames: 24, durationMs: 1000 },
    idle: { sheet: hearthIdle, frames: 24, durationMs: 2600 },
    sleep: { sheet: hearthSleep, frames: 24, durationMs: 4200 },
  },
};

export const DEFAULT_LOCATION = 'desk';

/**
 * How much to slow every cycle when motion is being reduced.
 *
 * Was 2.5, which was a disaster: on top of an already-choppy 8-frame cycle it
 * produced ~3.6fps. At 24 frames a mild 1.3 stays visibly smooth while still
 * taking the edge off, which is what the setting is actually asking for.
 */
export const REDUCED_MOTION_FACTOR = 1.3;

export function hasLocation(id: string | undefined): boolean {
  return Boolean(id && id in SPRITES);
}

/**
 * Build the stylesheet for every location × cycle combination.
 *
 * One @keyframes and one rule per pair, generated up front. `steps()` takes an
 * <integer>; feeding it a `var()` is not something to rely on, so we emit
 * concrete rules rather than parameterising at runtime.
 *
 * Playback is `alternate` — forward then backward. Seamless by construction,
 * so a source clip never needs a naturally cyclic motion. Measured: the desk
 * write clip's best natural loop scored RMS 1.62, the armchair's 20.6. Relying
 * on a clean loop would have worked for one of them and visibly jumped on the
 * other.
 */
export function spriteCss(size: number): string {
  const rules: string[] = [];
  const slow: string[] = [];

  for (const [loc, cycles] of Object.entries(SPRITES)) {
    for (const cycle of CYCLES) {
      const def = cycles[cycle];
      const width = size * def.frames;
      const key = `gw-${loc}-${cycle}`;
      rules.push(`
.sprite.loc-${loc}.cy-${cycle} {
  background-image: url("${def.sheet}");
  background-size: ${width}px ${size}px;
  animation-name: ${key};
  animation-duration: ${def.durationMs}ms;
  animation-timing-function: steps(${def.frames});
}
@keyframes ${key} {
  from { background-position: 0 0; }
  to   { background-position: -${width}px 0; }
}`);

      const slowMs = Math.round(def.durationMs * REDUCED_MOTION_FACTOR);
      // `:not(.motion-full)` lets an explicit in-app choice beat the OS hint.
      slow.push(
        `  .sprite.loc-${loc}.cy-${cycle}:not(.motion-full) { animation-duration: ${slowMs}ms; }`,
      );
      // And an explicit "reduce" choice applies regardless of the OS.
      rules.push(
        `.sprite.loc-${loc}.cy-${cycle}.motion-reduced { animation-duration: ${slowMs}ms; }`,
      );
    }
  }

  // `prefers-reduced-motion` must NOT freeze him.
  //
  // Windows reports reduced-motion whenever the user turns off "animation
  // effects" — a common performance tweak, not necessarily a vestibular need —
  // and Chrome passes that straight through. Freezing the animation turns the
  // whole product into a sticker for those users, so we slow it slightly
  // instead, and let an explicit in-app setting override either way.
  rules.push(`
@media (prefers-reduced-motion: reduce) {
${slow.join('\n')}
}`);

  return rules.join('\n');
}
