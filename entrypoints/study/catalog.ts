/**
 * Where Marlowe can sit.
 *
 * Shared state stores only ids (`inventory.locations`, `equipped.location`),
 * so the presentation for each id lives here. `swatch` is a two-tone chip
 * drawn in CSS — it stands in until real art exists, and an `image` field
 * can be added per entry without touching the components.
 */
export interface CatalogItem {
  id: string;
  name: string;
  blurb: string;
  /** [base, accent] — drawn as a chip, and for locations tinted into the room. */
  swatch: [string, string];
  price: number;
  /**
   * Location artwork, once it exists. Set this to an imported image URL and the
   * room paints it behind the cat automatically; the drawn placeholder stays
   * underneath for anything still missing art.
   */
  image?: string;
}

/**
 * Ids must match the shared state's vocabulary. `defaultState()` in lib/state
 * starts everyone on `desk`, so that is the free starting location here.
 *
 * All four ship with artwork (see assets/sprites/manifest.json). Outfits used to
 * live alongside these; they were cut because the outfit is drawn into the same
 * sprite as the furniture, so each one multiplies against every location.
 */
export const LOCATIONS: CatalogItem[] = [
  { id: 'desk', name: 'The writing desk', blurb: 'Where it started.', swatch: ['#E3DDCE', '#B8842A'], price: 0 },
  { id: 'armchair', name: 'The reading chair', blurb: 'For revising, mostly.', swatch: ['#8E3B36', '#C9B99A'], price: 150 },
  { id: 'window', name: 'The window seat', blurb: 'Better when it rains.', swatch: ['#C9D3D8', '#6E5B4C'], price: 300 },
  { id: 'hearth', name: 'The fireside', blurb: 'He falls asleep here most.', swatch: ['#8C4A2F', '#E39247'], price: 480 },
];

const byId = new Map<string, CatalogItem>(LOCATIONS.map((i) => [i.id, i]));

export function lookup(id: string): CatalogItem | undefined {
  return byId.get(id);
}

/** Falls back to the id itself so an unknown item still reads as something. */
export function nameOf(id: string): string {
  return byId.get(id)?.name ?? id;
}
