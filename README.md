# Marlowe

A browser companion who writes a novel while you work. A small cat sprite floats
on every page; every keystroke you make anywhere in the browser advances his
manuscript. Clicking him opens the Study.

He counts **that** you typed. He never records, stores, or transmits **what**
you type — that is a property of the code, not a promise in a listing.

## Stack

| Layer | Choice |
|---|---|
| Extension framework | [WXT](https://wxt.dev) (Manifest V3) |
| UI | Svelte 5 + TypeScript |
| Storage | `chrome.storage.local`, single key `gw:state` |
| Sprite pipeline | Python + Pillow + ffmpeg (`assets/pipeline.py`) |

## Build

```sh
npm install
npm run build      # → .output/chrome-mv3
npm run dev        # throwaway Chrome profile with hot reload
```

Load unpacked: `chrome://extensions` → Developer mode → **Load unpacked** →
select `.output/chrome-mv3`.

## Layout

```
entrypoints/
  content/       overlay + keystroke counting (plain TS, see note below)
  background.ts  service worker: aggregates keystrokes, advances the manuscript
  popup/         toolbar popup: open the Study, hide him here, movement, off
  study/         the Study (Svelte)
lib/state.ts     shared state schema + storage helpers
assets/
  scene.py       the locked prompt + master references for new artwork
  pipeline.py    video → sprite sheet
  icons.py       extension icon set, cut from a sprite frame
  sprites/       generated sheets + manifest.json
test/
  study-shot.mjs screenshot the built Study over a throwaway HTTP server
```

## The sprite pipeline

Art is produced by **image-to-video over a single approved drawing**, not by
re-generating the character per frame. Text-to-image regresses to its training
mean and sands off the wet-ink texture that is the entire aesthetic; animating
the actual artwork preserves it.

```sh
python assets/scene.py hearth              # the exact prompt + master refs
python assets/pipeline.py hearth <mp4>     # video → sprite sheet
```

**Always generate a batch of four and select; never iterate on wording.** The
approved desk still took 9 attempts and the armchair 3 from an identical prompt.
The variance is in the sampler, not the prompt. `assets/scene.py` hard-codes the
two master reference ids precisely so a generated scene can never be passed back
in as a reference — doing that twice on this project thinned the ink outline and
lost the character's mustache and whiskers. Judge candidates on the face at full
size against `assets/sprites/desk-12.png`, never on a thumbnail.

It extracts every frame, picks the liveliest window, keys the flat background to
transparency, crops all frames to one shared box, quantises to 48 colours, and
writes `assets/sprites/<name>.png` plus a manifest entry.

### Three things it does deliberately

**Ping-pong, not looping.** Frames play forward then backward via
`animation-direction: alternate`. This is seamless *by construction*, so the
source clip never needs a naturally cyclic motion — and measurement says they
usually don't have one. The desk clip happened to loop at RMS 1.62; the armchair
clip's best was 20.6, which reads as a visible jump.

**One shared crop box per cycle.** Cropping each frame to its own content would
recentre every drawing slightly and the loop would jitter.

**Quantise the sheet, not just the frames.** Sheets are inlined into the content
script and therefore parsed on every page load. Unquantised they are ~1.2MB
each; at 48 colours they are 32–40KB. This is not an optimisation, it is a
requirement.

## Non-obvious decisions

**Locations are baked into the sprite.** Each location is a complete scene —
cat and furniture drawn together — not a character composited over a background.
That is why the location is visible constantly at 80px rather than only inside
the Study, which is what makes locations worth buying.

**Outfits were cut.** Because the outfit is drawn into the same sprite as the
furniture, every outfit multiplies against every location: 2 outfits × 4
locations × 3 cycles is 24 clips, for a change nobody can see at 80px.
Locations are the only cosmetic.

**The peek is 80px, not 64.** The desk scene reads at 64 because the cat
dominates and the prop is one horizontal bar. Prop-heavy scenes turn to mush.
80 is still tiny and is what makes those locations viable.

**The overlay is plain TypeScript, not Svelte.** `attachShadow({mode:'closed'})`
is not reachable from Svelte's mount target in a way that keeps styles inside
the root, and the animation must cost zero JS per frame. The overlay is one
`<div>` plus a stylesheet; Svelte would add a runtime for no benefit. The Study
is Svelte.

**Sheets are inlined as `data:` URIs.** Sites with a strict `img-src` CSP block
`chrome-extension://` URLs, which would leave an invisible sprite on exactly the
pages people use most. Every registered sheet is inlined whether equipped or
not — fine for a handful, but past roughly a dozen locations, switch to fetching
the equipped sheet from the background worker on demand.

**No timers or module state in the service worker.** MV3 kills it after ~30s
idle. Every message is a storage read-modify-write and all elapsed time is
derived from stored timestamps.

**`all_frames: true`, but only the top frame renders.** Google Docs routes every
keystroke through an invisible iframe (`iframe.docs-texteventtarget-iframe`), so
a top-frame-only listener counts exactly nothing there. Counting therefore runs
in every frame while `window.top === window.self` gates the overlay, which is
what stops an ad-heavy page summoning a dozen cats. Sub-frames signal the top
frame by advancing the persisted `lastKeyAt`.

**`patchState` is serialised.** Two tabs typing at once both read the same state
and the second write discards the first tab's keystrokes. The queue is the one
piece of module scope in the extension and it holds ordering, never data.

**The day log lives in shared state.** It used to be written by the Study page,
which meant writing for a week without opening the Study recorded nothing and
reset the streak to one. The background worker appends it when words are earned.

**Modifier keys and key-repeat don't count.** `event.repeat` is discarded so
holding a key earns nothing, bare modifiers are skipped so holding Shift doesn't
pay double, and there is a 12 keys/sec token bucket. An uncapped counter makes
the progress bar meaningless.

**Password fields are excluded** via `composedPath()`, which catches inputs
inside a page's own shadow DOM that `event.target` alone would miss.

## Economy (proposals, tune against real usage)

| Quantity | Value |
|---|---|
| Keystrokes per word | 2 |
| Words per chapter | 600 |
| Chapters per work | 10 |
| Royalties per work | 50 |

A finished work should land every 1–2 weeks of ordinary use.
