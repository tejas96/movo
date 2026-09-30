from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = "/Volumes/works-space/movo"
FONTS = f"{ROOT}/packages/design-system/assets/fonts"
W, H = 1024, 500
INK = (21, 21, 21)
GRAY = (118, 118, 118)

canvas = Image.new("RGB", (W, H), (255, 255, 255))
sh = Image.new('L', (W, H), 0)
ImageDraw.Draw(sh).rounded_rectangle((500, 56, W - 44, H - 36), radius=36, fill=70)
sh = sh.filter(ImageFilter.GaussianBlur(18))
canvas.paste((0, 0, 0), (0, 0), sh)

# Photo on the right, cover-fit into a rounded card
photo = Image.open(f"{ROOT}/packages/design-system/assets/photos/society.jpg").convert("RGB")
cx0, cy0, cx1, cy1 = 500, 44, W - 44, H - 44
cw, ch = cx1 - cx0, cy1 - cy0
scale = max(cw / photo.width, ch / photo.height) * 1.3
p = photo.resize((round(photo.width * scale), round(photo.height * scale)), Image.LANCZOS)
left = (p.width - cw) // 2
top = int((p.height - ch) * 0.85)
p = p.crop((left, top, left + cw, top + ch))
mask = Image.new("L", (cw, ch), 0)
ImageDraw.Draw(mask).rounded_rectangle((0, 0, cw - 1, ch - 1), radius=36, fill=255)
canvas.paste(p, (cx0, cy0), mask)

# Retouch the builder's name sign on the roof (keep the photo brand-free)
px = canvas.load()
x0, x1 = 797, 845
for y in range(94, 121):
    a, b = px[x0, y], px[x1, y]
    for x in range(x0 + 1, x1):
        t = (x - x0) / (x1 - x0)
        px[x, y] = tuple(round(a[i] * (1 - t) + b[i] * t) for i in range(3))

d = ImageDraw.Draw(canvas)
word = ImageFont.truetype(f"{FONTS}/Poppins-SemiBold.ttf", 118)
tag = ImageFont.truetype(f"{FONTS}/Poppins-Medium.ttf", 30)
sub = ImageFont.truetype(f"{FONTS}/Poppins-Regular.ttf", 21)

x = 72
d.text((x - 6, 118), "MOVO", font=word, fill=INK)
d.text((x, 272), "Everything your society", font=tag, fill=INK)
d.text((x, 312), "needs, in one app.", font=tag, fill=INK)
d.text((x, 376), "Notices · Dues · Duties · Market", font=sub, fill=GRAY)

canvas.save(f"{ROOT}/apps/mobile/store/feature-graphic.png", optimize=True)
print(canvas.size, canvas.mode)
