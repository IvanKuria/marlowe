import deskSheet from '~/assets/sprites/desk.png';
import armchairSheet from '~/assets/sprites/armchair.png';
import windowSheet from '~/assets/sprites/window.png';
import hearthSheet from '~/assets/sprites/hearth.png';

/**
 * Scene sheets for the Study.
 *
 * Each location is a complete scene — cat and furniture drawn together
 * — so there is one sheet per location rather than a character composited over
 * a background. Keys match `equipped.location` in shared state.
 *
 * These mirror `assets/sprites/manifest.json`. Unlike the content overlay,
 * nothing is imported with `?inline`: the Study is an extension page with no
 * third-party CSP to satisfy, so plain asset URLs keep the sheets out of the
 * bundle and let the browser cache them.
 */
export interface Scene {
  /** URL of the horizontal sheet of square frames. */
  sheet: string;
  frames: number;
  /** One forward pass. Playback alternates, so a round trip is twice this. */
  durationMs: number;
}

export const DEFAULT_LOCATION = 'desk';

/**
 * 24 frames, not 8. Eight over 880ms is ~9fps, which reads as a flip-book
 * however you time it. All four locations have artwork; anything added to the
 * catalog without a sheet here shows as an honest empty frame in the Study
 * rather than faking a scene.
 */
export const SCENES: Record<string, Scene> = {
  desk: { sheet: deskSheet, frames: 24, durationMs: 1000 },
  armchair: { sheet: armchairSheet, frames: 24, durationMs: 1000 },
  window: { sheet: windowSheet, frames: 24, durationMs: 1000 },
  hearth: { sheet: hearthSheet, frames: 24, durationMs: 1000 },
};

/** Any location without artwork yet falls back to the desk rather than blank. */
export function sceneFor(location: string): Scene {
  return SCENES[location] ?? SCENES[DEFAULT_LOCATION]!;
}

/** Frames in a horizontal strip of square cells, measured from the image. */
export function frameCount(w: number, h: number, fallback: number): number {
  if (!w || !h) return fallback;
  return Math.max(1, Math.round(w / h));
}
