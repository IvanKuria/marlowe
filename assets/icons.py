"""
Build the extension icon set from an existing sprite frame.

    python icons.py

Writes public/icon/{16,32,48,128}.png plus a 128 store tile.

Why a crop and not the whole scene: the sprite is a full vignette (cat, desk,
manuscript). At 16px that is mush. The recognisable mark is the head — two
notched ears, round glasses, ochre collar — so every size uses the same
head-and-shoulders crop. One mark at all sizes; only the padding changes.

Why a ground at all: the cat is white with a black outline. Dropped
transparent onto Chrome's light toolbar he reads as a few floating black
lines. The warm dark ground is the Study's own night colour, so it also
guarantees contrast on either toolbar theme.
"""
import os
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(HERE, "sprites", "desk-12.png")   # pen down, face forward
OUT = os.path.join(ROOT, "public", "icon")

NIGHT = (26, 20, 24)
LAMP = (255, 196, 112)

# Fraction of the source frame to keep: head and collar, with air above the
# ears. The ears touch y=2 in the source, so the top must be 0.0 or they clip.
CROP = (0.17, 0.00, 0.83, 0.60)

SIZES = [16, 32, 48, 128]


def ground(size):
    """Warm dark rounded square with the lamp glow behind the head."""
    ss = size * 4                      # supersample; rounded corners alias badly
    im = Image.new("RGBA", (ss, ss), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([0, 0, ss - 1, ss - 1], radius=int(ss * 0.22), fill=NIGHT + (255,))

    glow = Image.new("RGBA", (ss, ss), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    r = int(ss * 0.30)
    gd.ellipse([ss // 2 - r, int(ss * 0.62) - r, ss // 2 + r, int(ss * 0.62) + r],
               fill=LAMP + (58,))
    glow = glow.filter(ImageFilter.GaussianBlur(ss * 0.13))
    im.alpha_composite(Image.composite(glow, Image.new("RGBA", (ss, ss)), im.split()[3]))
    return im.resize((size, size), Image.LANCZOS)


def main():
    src = Image.open(SRC).convert("RGBA")
    w, h = src.size
    head = src.crop((int(w * CROP[0]), int(h * CROP[1]), int(w * CROP[2]), int(h * CROP[3])))

    os.makedirs(OUT, exist_ok=True)
    for size in SIZES:
        # Smaller icons need proportionally less padding or the mark disappears.
        pad = 0.10 if size <= 32 else 0.17
        box = int(size * (1 - pad * 2))
        scale = box / max(head.size)
        cat = head.resize((max(1, round(head.width * scale)),
                           max(1, round(head.height * scale))), Image.LANCZOS)

        im = ground(size)
        im.alpha_composite(cat, ((size - cat.width) // 2, (size - cat.height) // 2))
        p = os.path.join(OUT, "%d.png" % size)
        im.save(p, optimize=True)
        print("%-3d %s (%d B)" % (size, p, os.path.getsize(p)))


if __name__ == "__main__":
    main()
