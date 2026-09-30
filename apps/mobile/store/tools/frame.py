"""Framed Play Store phone screenshots, 1080x1920 (9:16), RGB, no alpha."""
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = "/Volumes/works-space/movo"
FONTS = f"{ROOT}/packages/design-system/assets/fonts"
RAW = "/private/tmp/claude-501/-Volumes-works-space-movo/7cad7dc7-d8c9-43bc-a4bb-9bda7f0e046a/scratchpad/raw"
OUT = f"{ROOT}/apps/mobile/store/screenshots"

W, H = 1080, 1920
BG = (245, 245, 245)
INK = (21, 21, 21)
GRAY = (118, 118, 118)
SHOT_H = 1480
RADIUS = 48
TOP = 372

SETS = {
    "en": [
        ("01-home", "home", "What is coming up\nin your society"),
        ("02-society", "society", "Every society service,\none tap away"),
        ("03-events", "event_detail", "Events and meetings,\nreply in one tap"),
        ("04-money", "money", "Dues and receipts,\nalways clear"),
        ("05-market", "market", "Fresh homemade food\nfrom your neighbours"),
        ("06-listing", "listing", "Order from next door,\npay them directly"),
        ("07-duties", "duty_detail", "Duties that rotate\nfairly, flat by flat"),
        ("08-emergency", "emergency", "Need help? Hold\nto alert the society"),
    ],
    "hi": [
        ("01-home", "hi_home", "आपकी सोसायटी में\nआगे क्या है"),
        ("02-society", "hi_society", "सोसायटी की हर सेवा,\nबस एक टैप दूर"),
        ("03-events", "hi_event", "कार्यक्रम और बैठकें,\nएक टैप में जवाब"),
        ("04-money", "hi_money", "बकाया और रसीदें,\nहमेशा साफ़"),
        ("05-market", "hi_market", "पड़ोसियों का ताज़ा\nघर का खाना"),
        ("06-listing", "hi_listing", "पड़ोस से ऑर्डर करें,\nसीधे उन्हें भुगतान करें"),
        ("07-duties", "hi_duty", "ज़िम्मेदारियाँ बारी-बारी से,\nहर फ़्लैट की"),
        ("08-emergency", "hi_emergency", "मदद चाहिए? दबाकर रखें,\nसोसायटी को अलर्ट जाएगा"),
    ],
}


def load_shot(name):
    im = Image.open(f"{RAW}/{name}.png").convert("RGB")
    if name in ("home", "hi_home"):
        # Blank the partly scrolled "Add your email" card left under the status bar.
        ImageDraw.Draw(im).rectangle((0, 132, im.width, 246), fill=(255, 255, 255))
    return im


def frame(raw_name, caption, out_path):
    canvas = Image.new("RGB", (W, H), BG)
    shot = load_shot(raw_name)
    sw = round(shot.width * SHOT_H / shot.height)
    shot = shot.resize((sw, SHOT_H), Image.LANCZOS)
    x = (W - sw) // 2
    y = TOP

    # soft shadow
    sh = Image.new("L", (W, H), 0)
    ImageDraw.Draw(sh).rounded_rectangle((x, y + 18, x + sw, y + SHOT_H + 18), radius=RADIUS, fill=60)
    sh = sh.filter(ImageFilter.GaussianBlur(28))
    canvas.paste((0, 0, 0), (0, 0), sh)

    mask = Image.new("L", (sw, SHOT_H), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, sw - 1, SHOT_H - 1), radius=RADIUS, fill=255)
    canvas.paste(shot, (x, y), mask)

    d = ImageDraw.Draw(canvas)
    size = 64
    font = ImageFont.truetype(f"{FONTS}/Poppins-SemiBold.ttf", size)
    lines = caption.split("\n")
    while max(d.textlength(l, font=font) for l in lines) > W - 160:
        size -= 2
        font = ImageFont.truetype(f"{FONTS}/Poppins-SemiBold.ttf", size)
    line_h = round(size * 1.38)
    block_h = line_h * len(lines)
    ty = (TOP - block_h) // 2 + 6
    for i, l in enumerate(lines):
        d.text((W / 2, ty + i * line_h + line_h / 2), l, font=font, fill=INK, anchor="mm")

    canvas.save(out_path, optimize=True)


for lang, items in SETS.items():
    os.makedirs(f"{OUT}/{lang}", exist_ok=True)
    for fname, raw, cap in items:
        frame(raw, cap, f"{OUT}/{lang}/{fname}.png")
        print(lang, fname)
