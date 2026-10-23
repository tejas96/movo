#!/usr/bin/env python3
"""
Build the "movo" wordmark as SVG path data from Poppins SemiBold.

Why paths and not <Text>: the splash draws the letters with a stroke animation, which needs
real outlines and their lengths. Glyph outlines are taken from the bundled font, kerned with
the font's own GPOS pairs, flipped to SVG coordinates and written to
src/components/generated/wordmark-data.ts.

Usage: python3 scripts/build-wordmark.py   (needs fontTools: pip install fonttools)
"""

from __future__ import annotations

import math
from pathlib import Path

from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.recordingPen import RecordingPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1]
FONT = ROOT / "assets" / "fonts" / "Poppins-SemiBold.ttf"
OUT = ROOT / "src" / "components" / "generated" / "wordmark-data.ts"
WORD = "movo"
# Poppins sets lowercase a little loose at display sizes; tighten like the app's -2px at 64px.
TRACKING_EM = -0.03


def kerning(font: TTFont, left: str, right: str) -> int:
    """GPOS pair adjustment (x advance of the left glyph), 0 when the font has none."""
    if "GPOS" not in font:
        return 0
    gpos = font["GPOS"].table
    kern_lookups = set()
    for feat in gpos.FeatureList.FeatureRecord:
        if feat.FeatureTag == "kern":
            kern_lookups.update(feat.Feature.LookupListIndex)
    for idx in sorted(kern_lookups):
        lookup = gpos.LookupList.Lookup[idx]
        for sub in lookup.SubTable:
            if getattr(sub, "LookupType", lookup.LookupType) == 9:  # extension
                sub = sub.ExtSubTable
            if sub.LookupType != 2:
                continue
            coverage = sub.Coverage.glyphs
            if left not in coverage:
                continue
            if sub.Format == 1:
                pair_set = sub.PairSet[coverage.index(left)]
                for rec in pair_set.PairValueRecord:
                    if rec.SecondGlyph == right:
                        return getattr(rec.Value1, "XAdvance", 0) or 0
            elif sub.Format == 2:
                c1 = sub.ClassDef1.classDefs.get(left, 0)
                c2 = sub.ClassDef2.classDefs.get(right, 0)
                rec = sub.Class1Record[c1].Class2Record[c2]
                v = getattr(rec.Value1, "XAdvance", 0) or 0
                if v:
                    return v
    return 0


def segment_length(points: list[tuple[float, float]], steps: int = 48) -> float:
    """Length of a line / quadratic / cubic given its control points, by sampling."""
    if len(points) == 2:
        (x0, y0), (x1, y1) = points
        return math.hypot(x1 - x0, y1 - y0)

    def at(t: float) -> tuple[float, float]:
        pts = list(points)
        while len(pts) > 1:
            pts = [
                ((1 - t) * a[0] + t * b[0], (1 - t) * a[1] + t * b[1])
                for a, b in zip(pts, pts[1:])
            ]
        return pts[0]

    total = 0.0
    prev = at(0.0)
    for i in range(1, steps + 1):
        cur = at(i / steps)
        total += math.hypot(cur[0] - prev[0], cur[1] - prev[1])
        prev = cur
    return total


def outline_length(recording: RecordingPen) -> float:
    total = 0.0
    start = None
    cur = None
    for op, args in recording.value:
        if op == "moveTo":
            start = cur = args[0]
        elif op == "lineTo":
            total += segment_length([cur, args[0]])
            cur = args[0]
        elif op == "qCurveTo":
            # TrueType: implied on-curve points between consecutive off-curve points.
            pts = list(args)
            if pts[-1] is None:  # closed all-off-curve contour, rare
                pts[-1] = start
            offs = pts[:-1]
            end = pts[-1]
            prev = cur
            for i, off in enumerate(offs):
                nxt = (
                    end
                    if i == len(offs) - 1
                    else ((off[0] + offs[i + 1][0]) / 2, (off[1] + offs[i + 1][1]) / 2)
                )
                total += segment_length([prev, off, nxt])
                prev = nxt
            cur = end
        elif op == "curveTo":
            total += segment_length([cur, *args])
            cur = args[-1]
        elif op in ("closePath", "endPath"):
            if cur is not None and start is not None and cur != start:
                total += segment_length([cur, start])
            cur = start
    return total


def main() -> None:
    font = TTFont(FONT)
    upem = font["head"].unitsPerEm
    glyph_set = font.getGlyphSet()
    cmap = font.getBestCmap()
    names = [cmap[ord(ch)] for ch in WORD]

    # Pen position for each glyph, in font units.
    xs: list[float] = []
    x = 0.0
    for i, name in enumerate(names):
        xs.append(x)
        x += glyph_set[name].width
        if i + 1 < len(names):
            x += kerning(font, name, names[i + 1]) + TRACKING_EM * upem

    # Bounds of the whole word.
    minx = miny = math.inf
    maxx = maxy = -math.inf
    for name, gx in zip(names, xs):
        bp = BoundsPen(glyph_set)
        glyph_set[name].draw(bp)
        if bp.bounds is None:
            continue
        bx0, by0, bx1, by1 = bp.bounds
        minx, miny = min(minx, bx0 + gx), min(miny, by0)
        maxx, maxy = max(maxx, bx1 + gx), max(maxy, by1)

    width = maxx - minx
    height = maxy - miny
    letters = []
    for ch, name, gx in zip(WORD, names, xs):
        # Flip y (font up, SVG down) and move the word's top-left to the origin.
        transform = (1, 0, 0, -1, gx - minx, maxy)
        svg = SVGPathPen(glyph_set, ntos=lambda v: f"{v:.1f}".rstrip("0").rstrip("."))
        glyph_set[name].draw(TransformPen(svg, transform))
        rec = RecordingPen()
        glyph_set[name].draw(rec)
        letters.append(
            {"char": ch, "d": svg.getCommands(), "length": round(outline_length(rec))}
        )

    lines = [
        "// Generated by scripts/build-wordmark.py from Poppins SemiBold. Do not edit.",
        "",
        "export interface WordmarkLetter {",
        "  readonly char: string;",
        "  /** SVG path in the wordmark's own units (see `width` / `height`). */",
        "  readonly d: string;",
        "  /** Outline length in the same units, for stroke-draw animations. */",
        "  readonly length: number;",
        "}",
        "",
        "export const wordmark = {",
        f"  word: '{WORD}',",
        f"  width: {width:.1f},",
        f"  height: {height:.1f},",
        "  letters: [",
    ]
    for l in letters:
        lines.append(f"    {{ char: '{l['char']}', length: {l['length']}, d: '{l['d']}' }},")
    lines += ["  ] as const satisfies readonly WordmarkLetter[],", "} as const;", ""]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text("\n".join(lines))
    print(f"wrote {OUT.relative_to(ROOT)}  ({width:.0f}x{height:.0f} units, {len(letters)} letters)")
    for l in letters:
        print(f"  {l['char']}: length {l['length']}")


if __name__ == "__main__":
    main()
