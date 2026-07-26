"""
Marlowe sprite pipeline.

Turns a Higgsfield image-to-video clip into a registered, background-keyed
sprite sheet plus a JSON manifest.

    python pipeline.py <name> <mp4-url-or-path>

Steps:
  1. extract every frame with ffmpeg
  2. score frame pairs to find the most seamless loop
  3. key the flat background to transparency
  4. crop every frame to ONE shared box so the loop never jitters
  5. quantise to 48 colours and emit sheet + frames + manifest
"""
import base64, glob, json, math, os, subprocess, sys, tempfile, urllib.request
from PIL import Image, ImageChops

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(HERE, "sprites")
FRAME = 176         # output frame size, px
STEP = 1            # keep every frame of the chosen window
LO, HI = 30, 70      # background-key soft threshold (colour distance)
MIN_LOOP, MAX_LOOP = 24, 60   # 24 frames @ ~42ms = ~24fps once played back


def extract(mp4, workdir):
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", mp4,
         os.path.join(workdir, "f%03d.png")],
        check=True,
    )
    return sorted(glob.glob(os.path.join(workdir, "*.png")))


def rms(a, b):
    d = ImageChops.difference(a, b).convert("L").histogram()
    return math.sqrt(sum(i * i * c for i, c in enumerate(d)) / (180 * 180))


def find_window(paths):
    """Pick the most animated stretch of the clip.

    We deliberately do NOT hunt for a naturally seamless loop. Image-to-video
    output rarely contains one, and forcing it either yields a twitchy 5-frame
    cycle or a visible jump. Instead we take the liveliest window and play it
    back with `animation-direction: alternate` — ping-pong is seamless by
    construction, because the last frame IS the first frame.
    """
    thumbs = [Image.open(p).convert("RGB").resize((180, 180), Image.LANCZOS) for p in paths]

    # Skip the opening settle: image-to-video models re-stage the shot in the
    # first ~0.5s, then hold. Measured on the desk clip: rms 0 -> 37 by frame
    # 12, then flat. Anything before that is a different composition.
    settle = min(14, len(thumbs) // 4)

    # motion[i] = how much frame i differs from its predecessor
    motion = [0.0] * len(thumbs)
    for i in range(settle + 1, len(thumbs)):
        motion[i] = rms(thumbs[i - 1], thumbs[i])

    best, span = None, MIN_LOOP
    for s in range(settle, len(thumbs) - span):
        score = sum(motion[s:s + span])
        if best is None or score > best[0]:
            best = (score, s, s + span)
    return best  # (motion score, start, end)


def key_bg(im, bg):
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size
    br, bgc, bb = bg[:3]
    for y in range(h):
        for x in range(w):
            r, g, b, _ = px[x, y]
            d = ((r - br) ** 2 + (g - bgc) ** 2 + (b - bb) ** 2) ** 0.5
            a = 0 if d <= LO else (255 if d >= HI else int(255 * (d - LO) / (HI - LO)))
            px[x, y] = (r, g, b, a)
    return im


def build(name, paths, start, end):
    picks = list(range(start, end, STEP))
    frames = []
    for i in picks:
        im = Image.open(paths[i]).convert("RGB")
        frames.append(key_bg(im, im.getpixel((4, 4))))

    # ONE crop box for the whole cycle — per-frame cropping would recentre
    # each drawing slightly and the loop would visibly jitter.
    boxes = [f.getbbox() for f in frames if f.getbbox()]
    x0 = min(b[0] for b in boxes); y0 = min(b[1] for b in boxes)
    x1 = max(b[2] for b in boxes); y1 = max(b[3] for b in boxes)
    side = int(max(x1 - x0, y1 - y0) * 1.05)
    cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
    sx, sy = cx - side // 2, cy - side // 2

    os.makedirs(OUT_DIR, exist_ok=True)
    sheet = Image.new("RGBA", (FRAME * len(frames), FRAME), (0, 0, 0, 0))
    b64 = {}
    total = 0
    for n, f in enumerate(frames):
        cell = f.crop((sx, sy, sx + side, sy + side)).resize((FRAME, FRAME), Image.LANCZOS)
        sheet.paste(cell, (n * FRAME, 0))
        q = cell.quantize(colors=48, method=Image.FASTOCTREE)
        p = os.path.join(OUT_DIR, "%s-%02d.png" % (name, n))
        q.save(p, optimize=True)
        total += os.path.getsize(p)
        with open(p, "rb") as fh:
            b64["%s%02d" % (name, n)] = base64.b64encode(fh.read()).decode()

    # Quantise the SHEET too, not just the individual frames. The content
    # script inlines this as a data URI on every page load, so an unquantised
    # sheet costs ~1.2MB of parse per page. 48 colours takes it under 100KB.
    sheet_path = os.path.join(OUT_DIR, "%s.png" % name)
    sheet.quantize(colors=48, method=Image.FASTOCTREE).save(sheet_path, optimize=True)
    with open(os.path.join(OUT_DIR, "%s.frames.json" % name), "w") as fh:
        json.dump(b64, fh)

    manifest_path = os.path.join(OUT_DIR, "manifest.json")
    manifest = {}
    if os.path.exists(manifest_path):
        manifest = json.load(open(manifest_path))
    manifest[name] = {
        "sheet": "sprites/%s.png" % name,
        "frames": len(frames),
        "frameSize": FRAME,
        "durationMs": len(frames) * 42,
        # Play forward-then-backward. Seamless by construction, so the source
        # clip never has to contain a naturally looping cycle.
        # CSS: animation-direction: alternate
        "playback": "alternate",
    }
    json.dump(manifest, open(manifest_path, "w"), indent=2)

    return len(frames), total, sheet_path


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    name, src = sys.argv[1], sys.argv[2]

    with tempfile.TemporaryDirectory() as wd:
        mp4 = src
        if src.startswith("http"):
            mp4 = os.path.join(wd, "in.mp4")
            urllib.request.urlretrieve(src, mp4)
        paths = extract(mp4, wd)
        print("extracted %d frames" % len(paths))

        score, s, e = find_window(paths)
        print("window: %d -> %d  (%d frames, motion %.0f)" % (s, e, e - s, score))

        n, total, sheet = build(name, paths, s, e)
        print("built %d sprites (ping-pong), %d KB frames" % (n, total // 1024))
        print("sheet: %s  (%d KB)" % (sheet, os.path.getsize(sheet) // 1024))


if __name__ == "__main__":
    main()
