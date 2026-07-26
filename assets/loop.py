import glob, os
from PIL import Image, ImageChops
import math

SP = os.path.dirname(os.path.abspath(__file__))
fs = sorted(glob.glob(os.path.join(SP, "vf", "*.png")))
ims = [Image.open(f).convert("RGB").resize((180, 180), Image.LANCZOS) for f in fs]


def diff(a, b):
    d = ImageChops.difference(a, b)
    h = d.convert("L").histogram()
    total = sum(i * i * c for i, c in enumerate(h))
    return math.sqrt(total / (180 * 180))


# For each candidate start, find the best matching later frame (loop end).
best = None
for start in range(0, 40):
    for end in range(start + 10, min(start + 60, len(ims))):
        d = diff(ims[start], ims[end])
        if best is None or d < best[0]:
            best = (d, start, end)

print("best loop: start=%d end=%d rms=%.2f (len %d frames)" % (best[1], best[2], best[0], best[2] - best[1]))

# Also report drift: first frame vs each sampled frame, to quantify camera settle
print("\ndrift vs frame 0:")
for i in range(0, len(ims), 12):
    print("  f%03d  rms=%.2f" % (i, diff(ims[0], ims[i])))
