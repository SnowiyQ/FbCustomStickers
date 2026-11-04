"""Draw the extension icons and a README-sized master icon. Run: python tools/make_icons.py"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

S = 512
OUT = Path(__file__).resolve().parent.parent / "icons"


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def gradient():
    stops = [(0.0, (0, 170, 255)), (0.5, (160, 51, 255)), (1.0, (255, 82, 128))]
    img = Image.new("RGB", (S, S))
    px = img.load()
    for y in range(S):
        for x in range(S):
            t = (x + y) / (2 * (S - 1))
            for (t0, c0), (t1, c1) in zip(stops, stops[1:]):
                if t <= t1:
                    px[x, y] = lerp(c0, c1, (t - t0) / (t1 - t0))
                    break
    return img


def main():
    OUT.mkdir(exist_ok=True)
    bg_mask = Image.new("L", (S, S), 0)
    ImageDraw.Draw(bg_mask).rounded_rectangle((0, 0, S - 1, S - 1), radius=118, fill=255)
    icon = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    icon.paste(gradient(), (0, 0), bg_mask)

    # White sticker with the bottom-right corner peeled up.
    x0, y0, x1, y1, r, cut = 112, 112, 400, 400, 54, 120
    body = Image.new("L", (S, S), 0)
    d = ImageDraw.Draw(body)
    d.rounded_rectangle((x0, y0, x1, y1), radius=r, fill=255)
    d.polygon([(x1 - cut, y1 + 2), (x1 + 2, y1 + 2), (x1 + 2, y1 - cut)], fill=0)

    shadow = body.filter(ImageFilter.GaussianBlur(14))
    icon.paste((40, 0, 90, 90), (0, 10), shadow)
    icon.paste((255, 255, 255, 255), (0, 0), body)

    flap = Image.new("L", (S, S), 0)
    ImageDraw.Draw(flap).polygon([(x1 - cut, y1), (x1, y1 - cut), (x1 - cut + 18, y1 - cut + 18)], fill=255)
    icon.paste((214, 214, 236, 255), (0, 0), flap)

    # Sparkle in the middle of the sticker.
    cx, cy, R, rr = 238, 236, 74, 20
    star = [(cx, cy - R), (cx + rr, cy - rr), (cx + R, cy), (cx + rr, cy + rr), (cx, cy + R), (cx - rr, cy + rr), (cx - R, cy), (cx - rr, cy - rr)]
    ImageDraw.Draw(icon).polygon(star, fill=(140, 70, 255, 255))

    for size in (512, 128, 48, 16):
        icon.resize((size, size), Image.LANCZOS).save(OUT / f"icon{size}.png")


if __name__ == "__main__":
    main()
