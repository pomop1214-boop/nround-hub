from PIL import Image, ImageDraw

CORAL = (255, 107, 84, 255)     # #FF6B54 brand coral (background)
DISC_DARK = (23, 18, 15, 255)   # #17120F
DISC_CORAL = (242, 87, 67, 255) # #F25743 (center)
CREAM = (255, 248, 245, 255)    # #FFF8F5 (dot)
RING = (255, 255, 255, 40)      # faint highlight ring


def box_for(cx, cy, radius):
    return [cx - radius, cy - radius, cx + radius, cy + radius]


def draw_minidisc(size, margin_ratio):
    img = Image.new("RGBA", (size, size), CORAL)
    draw = ImageDraw.Draw(img)

    cx = cy = size / 2
    R = size / 2 - size * margin_ratio  # outer radius of the disc itself

    draw.ellipse(box_for(cx, cy, R), fill=DISC_DARK)
    draw.arc(box_for(cx, cy, R * 0.93), start=200, end=340, fill=RING, width=max(1, int(size * 0.01)))
    draw.ellipse(box_for(cx, cy, R * 0.62), outline=(43, 36, 32, 255), width=max(1, int(size * 0.006)))
    draw.ellipse(box_for(cx, cy, R * 0.29), fill=DISC_CORAL)
    draw.ellipse(box_for(cx, cy, R * 0.13), fill=CREAM)

    return img


draw_minidisc(192, 0.08).save("public/icon-192.png")
draw_minidisc(512, 0.08).save("public/icon-512.png")
# maskable icon — keep artwork inside the safe zone since OS may crop to a circle
draw_minidisc(512, 0.20).save("public/icon-maskable-512.png")
draw_minidisc(180, 0.09).convert("RGB").save("public/apple-touch-icon.png")

print("icons written")
