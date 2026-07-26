import base64, json, os
from PIL import Image

SP = os.path.dirname(os.path.abspath(__file__))
OUT = 300          # final frame size in px
LO, HI = 26, 60    # background-key soft threshold (colour distance)

def key_bg(im, bg):
    """Make pixels near the background colour transparent, with a soft edge."""
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size
    br, bg_, bb = bg[:3]
    for y in range(h):
        for x in range(w):
            r, g, b, _ = px[x, y]
            d = ((r - br) ** 2 + (g - bg_) ** 2 + (b - bb) ** 2) ** 0.5
            if d <= LO:
                a = 0
            elif d >= HI:
                a = 255
            else:
                a = int(255 * (d - LO) / (HI - LO))
            px[x, y] = (r, g, b, a)
    return im

def process(name):
    grid = Image.open(os.path.join(SP, "full-%s.png" % name)).convert("RGB")
    bg = grid.getpixel((3, 3))
    half = grid.width // 2
    cells = []
    for q in range(4):
        ox, oy = (q % 2) * half, (q // 2) * half
        cell = grid.crop((ox, oy, ox + half, oy + half))
        cells.append(key_bg(cell, bg))

    # Union bounding box across the whole cycle, so every frame stays
    # registered to the same origin — per-frame cropping would cause jitter.
    boxes = [c.getbbox() for c in cells]
    boxes = [b for b in boxes if b]
    x0 = min(b[0] for b in boxes); y0 = min(b[1] for b in boxes)
    x1 = max(b[2] for b in boxes); y1 = max(b[3] for b in boxes)

    # pad the union box out to a square so aspect is preserved
    w, h = x1 - x0, y1 - y0
    side = max(w, h)
    cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
    pad = int(side * 0.06)
    side += pad * 2
    sx0, sy0 = cx - side // 2, cy - side // 2

    out = {}
    for i, c in enumerate(cells):
        frame = c.crop((sx0, sy0, sx0 + side, sy0 + side))
        frame = frame.resize((OUT, OUT), Image.LANCZOS)
        # Flat ink art uses very few colours — palette-quantising with alpha
        # cuts file size ~5x with no visible loss.
        frame = frame.quantize(colors=48, method=Image.FASTOCTREE)
        path = os.path.join(SP, "frame-%s-%d.png" % (name, i))
        frame.save(path, optimize=True)
        with open(path, "rb") as f:
            out["%s%d" % (name, i)] = base64.b64encode(f.read()).decode()
        print("%s frame %d -> %d bytes" % (name, i, os.path.getsize(path)))
    return out

data = {}
for n in ("type", "idle", "sleep"):
    data.update(process(n))

with open(os.path.join(SP, "frames.json"), "w") as f:
    json.dump(data, f)
print("total base64 KB:", sum(len(v) for v in data.values()) // 1024)
