"""구도픽 브랜드 아이콘 생성 스크립트.

자체 제작한 '뷰파인더 브래킷 + 라임 스파클' 모티프를 PNG로 그린다.
외부 이미지/폰트를 사용하지 않는다.

실행: python scripts/generate-brand-assets.py
"""

from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "assets" / "brand"
SS = 4  # 슈퍼샘플링 배율
INK = (17, 17, 17, 255)
LIME = (132, 204, 22, 255)
WHITE = (255, 255, 255, 255)


def logo_mask(size: int, scale: float):
    """(브래킷 마스크, 스파클 마스크)를 반환한다. scale=로고가 캔버스에서 차지하는 비율."""
    s = size * SS
    bracket = Image.new("L", (s, s), 0)
    d = ImageDraw.Draw(bracket)

    box = s * scale
    x0 = (s - box) / 2
    y0 = (s - box) / 2
    x1 = x0 + box
    y1 = y0 + box
    stroke = box * 0.085
    radius = box * 0.26

    d.rounded_rectangle([x0, y0, x1, y1], radius=radius, outline=255, width=round(stroke))

    # 각 변의 가운데를 지워 모서리 브래킷만 남긴다.
    gap = box * 0.30
    cx = (x0 + x1) / 2
    cy = (y0 + y1) / 2
    pad = stroke
    d.rectangle([cx - gap / 2, y0 - pad, cx + gap / 2, y0 + stroke + pad], fill=0)
    d.rectangle([cx - gap / 2, y1 - stroke - pad, cx + gap / 2, y1 + pad], fill=0)
    d.rectangle([x0 - pad, cy - gap / 2, x0 + stroke + pad, cy + gap / 2], fill=0)
    d.rectangle([x1 - stroke - pad, cy - gap / 2, x1 + pad, cy + gap / 2], fill=0)
    # 오른쪽 아래 모서리는 스파클 자리로 비운다.
    d.rectangle([cx + gap / 2 - 1, cy + gap / 2 - 1, x1 + pad, y1 + pad], fill=0)

    # 브래킷 끝을 둥글게 마감
    r = stroke / 2
    ends = [
        (cx - gap / 2, y0 + r), (cx + gap / 2, y0 + r),
        (cx - gap / 2, y1 - r),
        (x0 + r, cy - gap / 2), (x0 + r, cy + gap / 2),
        (x1 - r, cy - gap / 2),
    ]
    for ex, ey in ends:
        d.ellipse([ex - r, ey - r, ex + r, ey + r], fill=255)

    sparkle = Image.new("L", (s, s), 0)
    sd = ImageDraw.Draw(sparkle)
    scx = x1 - box * 0.14
    scy = y1 - box * 0.14
    big = box * 0.25
    p = 0.55
    pts = []
    steps = 64
    import math

    for i in range(steps * 4):
        t = (i / (steps * 4)) * 2 * math.pi
        c, sn = math.cos(t), math.sin(t)
        px = math.copysign(abs(c) ** (2 / p), c) * big
        py = math.copysign(abs(sn) ** (2 / p), sn) * big
        pts.append((scx + px, scy + py))
    sd.polygon(pts, fill=255)
    return bracket, sparkle


def render(size: int, scale: float, background, ink, accent, name: str):
    s = size * SS
    img = Image.new("RGBA", (s, s), background)
    bracket, sparkle = logo_mask(size, scale)
    img.paste(Image.new("RGBA", (s, s), ink), (0, 0), bracket)
    img.paste(Image.new("RGBA", (s, s), accent), (0, 0), sparkle)
    img = img.resize((size, size), Image.LANCZOS)
    OUT.mkdir(parents=True, exist_ok=True)
    img.save(OUT / name)
    print("wrote", OUT / name)


if __name__ == "__main__":
    clear = (0, 0, 0, 0)
    render(1024, 0.52, WHITE, INK, LIME, "icon.png")
    render(1024, 0.36, clear, INK, LIME, "android-icon-foreground.png")
    render(1024, 0.36, clear, INK, INK, "android-icon-monochrome.png")
    render(512, 0.80, clear, INK, LIME, "splash-icon.png")
    render(512, 0.80, clear, WHITE, LIME, "logo-on-dark.png")
    render(512, 0.80, clear, INK, LIME, "logo-on-light.png")
