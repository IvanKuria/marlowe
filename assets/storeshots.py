"""
Turn real screenshots into Chrome Web Store assets.

    python storeshots.py

Reads hand-captured screenshots from `assets/raw/`, crops each to the store's
16:10, scales to 1280x800, and adds a caption band in the Study's own palette.
Writes `store/`.

Automating the capture was the wrong call: driving a persistent Chrome context
to photograph an MV3 extension fought the lazy service worker and the profile
sandbox for longer than taking the shots by hand would have. Real screenshots
in, deterministic crops out — the crop numbers are the only thing that needs to
be reproducible, and they live here.
"""
import os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
RAW = os.path.join(HERE, "raw")
OUT = os.path.join(ROOT, "store")

W, H = 1280, 800          # the store's required size
BAND = 96                 # caption band height, inside the 800

NIGHT = (20, 15, 19)
LAMP = (255, 203, 126)
TEXT = (224, 205, 182)

# Each entry: output name, source file, focus box (left, top, right, bottom) in
# source pixels, caption. The focus box is cropped to 16:10 around its centre,
# so it only has to bracket the content rather than be exact.
SHOTS = [
    (
        # Tight on the cat rather than the whole window. This is the only
        # screenshot most people ever look at, and at full-window width he is a
        # 30px smudge in the margin.
        "1-on-any-page.png",
        "docs.png",
        (400, 100, 1250, 560),
        "He writes while you write. On every page, in every editor.",
    ),
    (
        "2-the-study.png",
        "study-top.png",
        (430, 20, 1500, 700),
        "His study: what you have written, becoming a book.",
    ),
    (
        "3-the-rooms.png",
        "study-bottom.png",
        (470, 30, 1440, 400),
        "Rooms to move him to, earned by writing. Never by paying to write.",
    ),
    (
        # Narrow, so the crop is short enough to clear the room cards above it.
        "4-the-ledger.png",
        "study-bottom.png",
        (470, 400, 1010, 780),
        "He counts that you typed. He never sees what.",
    ),
]


def font(size):
    for name in ("georgia.ttf", "Georgia.ttf", "constan.ttf", "arial.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def crop_to_ratio(im, box, ratio):
    """Widen or heighten `box` to `ratio`, clamped inside the image."""
    l, t, r, b = box
    cx, cy = (l + r) / 2, (t + b) / 2
    w, h = r - l, b - t
    if w / h < ratio:
        w = h * ratio
    else:
        h = w / ratio

    # Clamp: shift the window back inside the image rather than shrinking it,
    # so the requested content stays framed.
    w, h = min(w, im.width), min(h, im.height)
    l = min(max(cx - w / 2, 0), im.width - w)
    t = min(max(cy - h / 2, 0), im.height - h)
    return im.crop((round(l), round(t), round(l + w), round(t + h)))


def build(name, src, box, caption):
    im = Image.open(os.path.join(RAW, src)).convert("RGB")
    picture_h = H - BAND
    shot = crop_to_ratio(im, box, W / picture_h).resize((W, picture_h), Image.LANCZOS)

    out = Image.new("RGB", (W, H), NIGHT)
    out.paste(shot, (0, 0))

    d = ImageDraw.Draw(out)
    # A hairline of lamplight between picture and caption, so the band reads as
    # part of the room rather than a sticker on top of it.
    d.line([(0, picture_h), (W, picture_h)], fill=(60, 45, 38), width=2)

    f = font(30)
    tw = d.textbbox((0, 0), caption, font=f)[2]
    d.text(((W - tw) / 2, picture_h + (BAND - 38) / 2), caption, font=f, fill=TEXT)

    os.makedirs(OUT, exist_ok=True)
    p = os.path.join(OUT, name)
    out.save(p, optimize=True)
    return p


def tile():
    """440x280 small promo tile: the icon mark plus the wordmark."""
    im = Image.new("RGB", (440, 280), NIGHT)
    d = ImageDraw.Draw(im)
    for i in range(150, 0, -3):
        a = int(26 * (1 - i / 150))
        d.ellipse([150 - i, 120 - i, 150 + i, 120 + i], fill=(NIGHT[0] + a, NIGHT[1] + a // 2, NIGHT[2] + a // 3))

    cat = Image.open(os.path.join(ROOT, "assets", "sprites", "desk-12.png")).convert("RGBA")
    cat = cat.resize((190, 190), Image.LANCZOS)
    im.paste(cat, (30, 45), cat)

    # Fit the wordmark and tagline inside 440px rather than trusting a guess:
    # the first version ran off the tile and read "a cat writes your nov".
    x = 232
    room = 440 - x - 16
    mark, tag = "Marlowe", "he writes when you do"
    fm = next(f for f in (font(s) for s in (44, 40, 36, 32))
              if d.textbbox((0, 0), mark, font=f)[2] <= room)
    ft = next(f for f in (font(s) for s in (21, 19, 17, 15))
              if d.textbbox((0, 0), tag, font=f)[2] <= room)
    d.text((x, 106), mark, font=fm, fill=(246, 233, 210))
    d.text((x + 2, 158), tag, font=ft, fill=(155, 133, 116))

    p = os.path.join(OUT, "promo-440x280.png")
    im.save(p, optimize=True)
    return p


def main():
    if not os.path.isdir(RAW):
        print("put the source screenshots in", RAW)
        return
    for name, src, box, caption in SHOTS:
        print("wrote", build(name, src, box, caption))
    print("wrote", tile())


if __name__ == "__main__":
    main()
