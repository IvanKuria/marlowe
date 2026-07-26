import base64, glob, json, os
from PIL import Image

SP = os.path.dirname(os.path.abspath(__file__))
START, END, STEP = 33, 81, 3
OUT = 300
LO, HI = 30, 70   # background-key soft threshold

fs = sorted(glob.glob(os.path.join(SP, "vf", "*.png")))
picks = list(range(START, END, STEP))


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


frames = []
for i in picks:
    im = Image.open(fs[i]).convert("RGB")
    bg = im.getpixel((4, 4))
    frames.append(key_bg(im, bg))

# One shared crop box across the whole loop keeps every frame registered.
boxes = [f.getbbox() for f in frames if f.getbbox()]
x0 = min(b[0] for b in boxes); y0 = min(b[1] for b in boxes)
x1 = max(b[2] for b in boxes); y1 = max(b[3] for b in boxes)
w, h = x1 - x0, y1 - y0
side = max(w, h)
cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
side += int(side * 0.05)
sx0, sy0 = cx - side // 2, cy - side // 2

data, sizes = {}, []
sheet = Image.new("RGBA", (OUT * len(frames), OUT), (0, 0, 0, 0))
for n, f in enumerate(frames):
    cell = f.crop((sx0, sy0, sx0 + side, sy0 + side)).resize((OUT, OUT), Image.LANCZOS)
    sheet.paste(cell, (n * OUT, 0))
    q = cell.quantize(colors=48, method=Image.FASTOCTREE)
    p = os.path.join(SP, "sp-write-%02d.png" % n)
    q.save(p, optimize=True)
    sizes.append(os.path.getsize(p))
    with open(p, "rb") as fh:
        data["w%02d" % n] = base64.b64encode(fh.read()).decode()

sheet.save(os.path.join(SP, "spritesheet-write.png"), optimize=True)

# animated GIF preview
gif = [Image.open(os.path.join(SP, "sp-write-%02d.png" % n)).convert("RGBA") for n in range(len(frames))]
flat = []
for g in gif:
    bgi = Image.new("RGB", g.size, (247, 247, 243))
    bgi.paste(g, mask=g.split()[3])
    flat.append(bgi)
flat[0].save(os.path.join(SP, "preview.gif"), save_all=True, append_images=flat[1:],
             duration=90, loop=0, optimize=True)

with open(os.path.join(SP, "writeframes.json"), "w") as fh:
    json.dump(data, fh)

print("frames:", len(frames), "| avg PNG bytes:", sum(sizes) // len(sizes))
print("total base64 KB:", sum(len(v) for v in data.values()) // 1024)
print("sheet:", os.path.getsize(os.path.join(SP, "spritesheet-write.png")) // 1024, "KB")
