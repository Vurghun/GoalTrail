#!/usr/bin/env python3
"""Rasterize the GoalTrail mark into installer and tray icons.

The geometry lives in this file. BrandMark.tsx and the SVG files repeat it.
Requires Pillow, CairoSVG, and icnsutil (not app dependencies):

    pip install pillow cairosvg icnsutil
    python3 scripts/render-icons.py
"""

from __future__ import annotations

import io
import struct
from pathlib import Path

import cairosvg
from icnsutil import IcnsFile
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
INK = "#111111"
PAPER = "#f4f4f4"
WHITE = (255, 255, 255, 255)

# Ring center is the origin. Y grows downward, matching the source mockup.
# Stroke width 40 on a centerline radius of 100 (outer 120, inner 80).
STROKE = 40
DOT = (26.11, 0.0, 28.87)
PATH = (
    "M 60.41 -100.00 "
    "L 0.00 -100.00 "
    "A 100.00 100.00 0 1 0 57.36 81.92 "
    "C 72.85 71.07 84.14 59.57 84.14 12.29"
)
# Square frame around the stroked mark, with a hair of room for antialiasing.
VIEWBOX = "-130 -122 244 244"


def mark_svg(color: str, *, dot: bool) -> str:
    dot_el = (
        f'<circle cx="{DOT[0]}" cy="{DOT[1]}" r="{DOT[2]}" fill="{color}"/>' if dot else ""
    )
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{VIEWBOX}">'
        f'<path d="{PATH}" fill="none" stroke="{color}" stroke-width="{STROKE}" '
        f'stroke-linecap="round" stroke-linejoin="round"/>'
        f"{dot_el}</svg>"
    )


def standalone_svg(color: str) -> str:
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="244" height="244" viewBox="{VIEWBOX}">'
        f'<path d="{PATH}" fill="none" stroke="{color}" stroke-width="{STROKE}" '
        f'stroke-linecap="round" stroke-linejoin="round"/>'
        f'<circle cx="{DOT[0]}" cy="{DOT[1]}" r="{DOT[2]}" fill="{color}"/>'
        f"</svg>\n"
    )


def favicon_svg() -> str:
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="{VIEWBOX}">
  <style>
    path, circle {{ color: {INK}; }}
    @media (prefers-color-scheme: dark) {{
      path, circle {{ color: {PAPER}; }}
    }}
  </style>
  <path d="{PATH}" fill="none" stroke="currentColor" stroke-width="{STROKE}" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="{DOT[0]}" cy="{DOT[1]}" r="{DOT[2]}" fill="currentColor"/>
</svg>
"""


def render_svg(svg: str, size: int) -> Image.Image:
    png = cairosvg.svg2png(bytestring=svg.encode(), output_width=size, output_height=size)
    return Image.open(io.BytesIO(png)).convert("RGBA")


def margin_for(size: int) -> float:
    # Small sizes need the mark larger or the stroke falls apart.
    if size <= 24:
        return 0.06
    if size <= 48:
        return 0.10
    return 0.15


def app_icon(size: int) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), WHITE)
    inset = int(round(size * margin_for(size)))
    inner = max(1, size - inset * 2)
    glyph = render_svg(mark_svg(INK, dot=True), inner)
    canvas.alpha_composite(glyph, (inset, inset))
    return canvas


def tray_glyph(size: int, color: str, dot: bool) -> Image.Image:
    return render_svg(mark_svg(color, dot=dot), size)


def tray_halo(size: int, dot: bool) -> Image.Image:
    """Dark mark with a white rim so a Windows tray stays visible on either taskbar."""
    glyph = tray_glyph(size, INK, dot)
    dilated = glyph.split()[-1].filter(ImageFilter.MaxFilter(3))
    rim = Image.new("RGBA", (size, size), (255, 255, 255, 255))
    rim.putalpha(dilated)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.alpha_composite(rim)
    out.alpha_composite(glyph)
    return out


def save_png(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, "PNG")


def write_ico(images: dict[int, Image.Image], path: Path) -> None:
    sizes = sorted(images)
    header = struct.pack("<HHH", 0, 1, len(sizes))
    entries = bytearray()
    blobs: list[bytes] = []
    offset = 6 + 16 * len(sizes)
    for size in sizes:
        buffer = io.BytesIO()
        images[size].save(buffer, format="PNG")
        blob = buffer.getvalue()
        blobs.append(blob)
        entries += struct.pack(
            "<BBBBHHII",
            size if size < 256 else 0,
            size if size < 256 else 0,
            0,
            0,
            1,
            32,
            len(blob),
            offset,
        )
        offset += len(blob)
    path.write_bytes(header + bytes(entries) + b"".join(blobs))


def write_icns(pngs: list[tuple[str, bytes]], path: Path) -> None:
    icns = IcnsFile()
    for name, data in pngs:
        icns.add_media(file=name, data=data)
    icns.write(str(path))


def main() -> None:
    (ROOT / "build").mkdir(exist_ok=True)
    (ROOT / "build" / "icon.svg").write_text(standalone_svg(INK))
    (ROOT / "docs").mkdir(exist_ok=True)
    (ROOT / "docs" / "brand-light.svg").write_text(standalone_svg(PAPER))
    public = ROOT / "src" / "renderer" / "public"
    public.mkdir(parents=True, exist_ok=True)
    (public / "favicon.svg").write_text(favicon_svg())

    linux_sizes = [16, 24, 32, 48, 64, 96, 128, 256, 512, 1024]
    icons = {size: app_icon(size) for size in sorted(set(linux_sizes + [20, 40, 64]))}
    for size, image in icons.items():
        if size in linux_sizes:
            save_png(image, ROOT / "build" / "icons" / f"{size}x{size}.png")
    save_png(icons[1024], ROOT / "build" / "icon.png")
    write_ico(
        {size: icons[size] for size in (16, 24, 32, 48, 64, 128, 256)},
        ROOT / "build" / "icon.ico",
    )

    icns_specs = [
        ("icon_16x16.png", 16),
        ("icon_16x16@2x.png", 32),
        ("icon_32x32.png", 32),
        ("icon_32x32@2x.png", 64),
        ("icon_128x128.png", 128),
        ("icon_128x128@2x.png", 256),
        ("icon_256x256.png", 256),
        ("icon_256x256@2x.png", 512),
        ("icon_512x512.png", 512),
        ("icon_512x512@2x.png", 1024),
    ]
    icns_pngs: list[tuple[str, bytes]] = []
    for name, size in icns_specs:
        image = icons.get(size) or app_icon(size)
        buffer = io.BytesIO()
        image.save(buffer, format="PNG")
        icns_pngs.append((name, buffer.getvalue()))
    write_icns(icns_pngs, ROOT / "build" / "icon.icns")

    tray = ROOT / "resources" / "tray"
    for dot, state in ((False, "idle"), (True, "run")):
        for size, suffix in ((16, "16"), (32, "32")):
            save_png(tray_glyph(size, INK, dot), tray / f"{state}-dark-{suffix}.png")
            save_png(tray_glyph(size, PAPER, dot), tray / f"{state}-light-{suffix}.png")
            save_png(tray_halo(size, dot), tray / f"{state}-halo-{suffix}.png")
    save_png(icons[512] if 512 in icons else app_icon(512), ROOT / "resources" / "icon.png")
    print("wrote icons under build/ and resources/")


if __name__ == "__main__":
    main()
