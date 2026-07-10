#!/usr/bin/env python3
"""Generate Google Play Store listing assets for Hindi PDF Editor."""

from __future__ import annotations

import html
import shutil
import subprocess
import tempfile
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "play-store-assets"
CHROME_CANDIDATES = [
    Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"),
    Path("/Applications/Chromium.app/Contents/MacOS/Chromium"),
    Path("/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary"),
]

COLORS = {
    "primary": "#2453B2",
    "primary_dark": "#1A3E8A",
    "primary_soft": "#E8EEFB",
    "background": "#F2F3F7",
    "surface": "#FFFFFF",
    "border": "#E2E4EB",
    "text": "#1B1D24",
    "muted": "#5B616E",
    "success": "#1E7B34",
    "success_soft": "#E9F5EC",
    "warning": "#8A5A00",
    "warning_soft": "#FFF4DC",
    "danger": "#C6303E",
}


def find_chrome() -> Path:
    for candidate in CHROME_CANDIDATES:
        if candidate.exists():
            return candidate
    path = shutil.which("google-chrome") or shutil.which("chromium") or shutil.which("chrome")
    if path:
        return Path(path)
    raise RuntimeError("Could not find Chrome/Chromium for Play Store screenshot rendering.")


def ensure_clean_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)
    for child in path.iterdir():
        if child.is_file():
            child.unlink()


def save_optimized_png(path: Path) -> None:
    with Image.open(path) as image:
        image.save(path, optimize=True)


def icon_html() -> str:
    return f"""
<!doctype html>
<html>
<head><meta charset="utf-8"><style>{css(512, 512)}</style></head>
<body>
  <div style="width:512px;height:512px;background:linear-gradient(145deg,#2453B2 0%,#163C8E 100%);position:relative;overflow:hidden;">
    <div style="position:absolute;inset:0;background:radial-gradient(circle at 74% 14%,rgba(255,255,255,.22),transparent 28%),radial-gradient(circle at 16% 88%,rgba(255,255,255,.16),transparent 30%);"></div>
    <div style="position:absolute;left:106px;top:82px;width:300px;height:348px;border-radius:36px;background:#fff;box-shadow:0 28px 70px rgba(7,22,64,.25);">
      <div style="position:absolute;right:0;top:0;width:86px;height:86px;background:linear-gradient(135deg,#BBD0FF 0%,#EAF0FF 100%);clip-path:polygon(0 0,100% 0,100% 100%);border-top-right-radius:36px;"></div>
      <div style="position:absolute;left:48px;right:48px;top:80px;height:12px;border-radius:999px;background:#D9E3F7;"></div>
      <div style="position:absolute;left:48px;right:78px;top:114px;height:12px;border-radius:999px;background:#D9E3F7;"></div>
      <div style="position:absolute;left:48px;right:62px;bottom:52px;height:12px;border-radius:999px;background:#D9E3F7;"></div>
      <div style="position:absolute;left:0;right:0;top:136px;text-align:center;color:#2453B2;font-family:'NotoSansDevanagariLocal',Inter,sans-serif;font-size:136px;line-height:1;font-weight:900;">हि</div>
    </div>
  </div>
</body>
</html>
"""


def make_icon(chrome: Path) -> None:
    icon_dir = OUT / "app-icon"
    ensure_clean_dir(icon_dir)
    render_html(chrome, icon_html(), icon_dir / "app-icon-512.png", 512, 512)


def css(width: int, height: int) -> str:
    font_url = (ROOT / "assets" / "fonts" / "NotoSansDevanagari-Variable.ttf").resolve().as_uri()
    return f"""
@font-face {{
  font-family: 'NotoSansDevanagariLocal';
  src: url('{font_url}') format('truetype');
  font-weight: 100 900;
}}
* {{ box-sizing: border-box; }}
html, body {{
  width: {width}px;
  height: {height}px;
  margin: 0;
  overflow: hidden;
  font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'NotoSansDevanagariLocal', sans-serif;
  color: {COLORS["text"]};
  background: {COLORS["background"]};
}}
.asset {{
  width: {width}px;
  height: {height}px;
  position: relative;
  overflow: hidden;
  background:
    linear-gradient(135deg, #f8fbff 0%, #eef3ff 48%, #f6f7fa 100%);
}}
.asset::before {{
  content: '';
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 82% 12%, rgba(36,83,178,.16), transparent 24%),
    radial-gradient(circle at 10% 80%, rgba(30,123,52,.11), transparent 28%);
}}
.caption {{
  position: absolute;
  left: 72px;
  right: 72px;
  top: 74px;
  z-index: 2;
}}
.kicker {{
  display: inline-flex;
  align-items: center;
  gap: 12px;
  padding: 11px 18px;
  border-radius: 999px;
  background: {COLORS["primary_soft"]};
  color: {COLORS["primary_dark"]};
  font-weight: 800;
  font-size: 31px;
  line-height: 1;
}}
.title {{
  margin: 28px 0 0;
  font-size: 75px;
  line-height: 1.02;
  letter-spacing: 0;
  font-weight: 900;
  max-width: 820px;
}}
.subtitle {{
  margin: 22px 0 0;
  font-size: 35px;
  line-height: 1.25;
  color: {COLORS["muted"]};
  max-width: 780px;
  font-weight: 650;
}}
.phone-frame, .tablet-frame {{
  position: absolute;
  z-index: 3;
  background: #10131b;
  border-radius: 58px;
  padding: 18px;
  box-shadow: 0 36px 90px rgba(23,38,84,.28);
}}
.phone-frame {{
  left: 146px;
  right: 146px;
  bottom: 72px;
  height: 1088px;
}}
.tablet-frame {{
  left: 112px;
  right: 112px;
  bottom: 78px;
  height: 1660px;
  border-radius: 44px;
}}
.screen {{
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: {COLORS["background"]};
  border-radius: 44px;
  position: relative;
}}
.tablet-frame .screen {{ border-radius: 30px; }}
.status {{
  height: 48px;
  padding: 12px 28px 0;
  display: flex;
  justify-content: space-between;
  color: {COLORS["text"]};
  font-size: 19px;
  font-weight: 800;
}}
.appbar {{
  height: 88px;
  padding: 0 28px;
  background: {COLORS["surface"]};
  border-bottom: 1px solid {COLORS["border"]};
  display: flex;
  align-items: center;
  justify-content: space-between;
}}
.appname {{
  font-size: 27px;
  font-weight: 900;
  display: flex;
  align-items: center;
  gap: 14px;
}}
.mini-icon {{
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: {COLORS["primary"]};
  color: white;
  display: grid;
  place-items: center;
  font-size: 22px;
  font-weight: 950;
}}
.top-actions {{ display: flex; gap: 10px; }}
.chip, .button {{
  border-radius: 14px;
  padding: 13px 17px;
  font-weight: 850;
  font-size: 19px;
  background: {COLORS["primary_soft"]};
  color: {COLORS["primary_dark"]};
  white-space: nowrap;
}}
.button.primary {{
  background: {COLORS["primary"]};
  color: white;
}}
.workspace {{
  position: absolute;
  left: 0;
  right: 0;
  top: 136px;
  bottom: 0;
  padding: 26px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}}
.page {{
  flex: 1;
  background: #fff;
  border: 1px solid #d7dce8;
  box-shadow: 0 10px 26px rgba(31,48,91,.12);
  border-radius: 14px;
  padding: 32px;
  position: relative;
  overflow: hidden;
}}
.doc-title {{
  font-family: 'NotoSansDevanagariLocal', Inter, sans-serif;
  font-size: 41px;
  line-height: 1.18;
  font-weight: 850;
  color: #222;
  text-align: center;
  margin-bottom: 22px;
}}
.rule {{ height: 1px; background: #d8dce6; margin: 14px 0 22px; }}
.line {{
  font-family: 'NotoSansDevanagariLocal', Inter, sans-serif;
  font-size: 25px;
  line-height: 1.72;
  color: #2b2f38;
}}
.line.small {{ font-size: 22px; color: #5b616e; }}
.highlight {{
  position: absolute;
  left: 82px;
  right: 76px;
  height: 60px;
  border: 3px solid rgba(36,83,178,.72);
  background: rgba(36,83,178,.10);
  border-radius: 10px;
}}
.mask {{
  position: absolute;
  left: 80px;
  right: 74px;
  height: 67px;
  background: #fbfbfb;
  border-radius: 8px;
  border: 1px solid rgba(220,220,220,.9);
}}
.edit-text {{
  position: absolute;
  left: 95px;
  right: 90px;
  height: 72px;
  display: flex;
  align-items: center;
  color: {COLORS["primary_dark"]};
  font-family: 'NotoSansDevanagariLocal', Inter, sans-serif;
  font-size: 34px;
  font-weight: 750;
}}
.toolbar {{
  min-height: 86px;
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  background: {COLORS["surface"]};
  border: 1px solid {COLORS["border"]};
  border-radius: 18px;
  box-shadow: 0 8px 20px rgba(31,48,91,.08);
}}
.toolbar .tool {{
  min-width: 76px;
  height: 52px;
  display: grid;
  place-items: center;
  border-radius: 13px;
  background: {COLORS["primary_soft"]};
  color: {COLORS["primary_dark"]};
  font-size: 22px;
  font-weight: 900;
}}
.toolbar .tool.danger {{ background: #fbeaec; color: {COLORS["danger"]}; }}
.empty-state {{
  height: 100%;
  display: grid;
  place-items: center;
  text-align: center;
  padding: 46px;
}}
.empty-card {{
  width: 100%;
  border: 2px dashed #bfd0f4;
  border-radius: 24px;
  background: #fbfdff;
  padding: 54px 36px;
}}
.empty-icon {{
  width: 116px;
  height: 116px;
  border-radius: 28px;
  margin: 0 auto 28px;
  background: {COLORS["primary"]};
  color: white;
  display: grid;
  place-items: center;
  font-size: 58px;
  font-weight: 950;
}}
.empty-title {{
  font-size: 38px;
  line-height: 1.15;
  font-weight: 900;
  margin-bottom: 16px;
}}
.empty-copy {{
  color: {COLORS["muted"]};
  font-size: 25px;
  line-height: 1.35;
  margin-bottom: 28px;
}}
.notice {{
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 18px 20px;
  border-radius: 16px;
  font-size: 21px;
  font-weight: 800;
}}
.notice.success {{ background: {COLORS["success_soft"]}; color: {COLORS["success"]}; }}
.notice.warning {{ background: {COLORS["warning_soft"]}; color: {COLORS["warning"]}; }}
.side-panel {{
  width: 330px;
  background: {COLORS["surface"]};
  border: 1px solid {COLORS["border"]};
  border-radius: 18px;
  padding: 18px;
  display: none;
}}
.tablet .workspace {{
  flex-direction: row;
  align-items: stretch;
}}
.tablet .page {{ padding: 44px; }}
.tablet .side-panel {{ display: block; }}
.panel-title {{
  font-size: 25px;
  font-weight: 900;
  margin-bottom: 16px;
}}
.panel-row {{
  border-radius: 14px;
  background: #f6f8fc;
  padding: 16px;
  margin-bottom: 12px;
  font-size: 19px;
  color: {COLORS["muted"]};
  line-height: 1.35;
  font-weight: 700;
}}
.feature {{
  width: 1024px;
  height: 500px;
  background:
    linear-gradient(135deg, #f9fbff 0%, #edf3ff 54%, #f7f9fc 100%);
  position: relative;
  overflow: hidden;
  font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'NotoSansDevanagariLocal', sans-serif;
}}
.feature::before {{
  content: '';
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 78% 18%, rgba(36,83,178,.18), transparent 24%),
    radial-gradient(circle at 8% 88%, rgba(30,123,52,.10), transparent 25%);
}}
.feature-copy {{
  position: absolute;
  left: 58px;
  top: 62px;
  width: 450px;
  z-index: 2;
}}
.feature-title {{
  font-size: 56px;
  line-height: 1.02;
  font-weight: 950;
  margin: 20px 0 16px;
}}
.feature-subtitle {{
  font-size: 25px;
  line-height: 1.25;
  color: {COLORS["muted"]};
  font-weight: 700;
}}
.feature-icon {{
  width: 82px;
  height: 82px;
  border-radius: 22px;
  background: {COLORS["primary"]};
  color: white;
  display: grid;
  place-items: center;
  font-size: 43px;
  font-weight: 950;
}}
.feature-mock {{
  position: absolute;
  right: 58px;
  top: 42px;
  width: 390px;
  height: 416px;
  border-radius: 28px;
  padding: 14px;
  background: #10131b;
  box-shadow: 0 24px 60px rgba(23,38,84,.28);
}}
.feature-screen {{
  background: {COLORS["background"]};
  width: 100%;
  height: 100%;
  border-radius: 20px;
  overflow: hidden;
  position: relative;
}}
"""


def app_screen(mode: str, tablet: bool = False) -> str:
    tablet_class = " tablet" if tablet else ""
    panel = """
      <aside class="side-panel">
        <div class="panel-title">Editing tools</div>
        <div class="panel-row">OCR highlights detected text lines.</div>
        <div class="panel-row">Mask old text, then type replacement Hindi.</div>
        <div class="panel-row">Export creates a new PDF file.</div>
      </aside>
    """
    if mode == "open":
        content = """
        <div class="page">
          <div class="empty-state">
            <div class="empty-card">
              <div class="empty-icon">हि</div>
              <div class="empty-title">Open a PDF from your device</div>
              <div class="empty-copy">Pick a document, preview every page, then start editing text directly on the page.</div>
              <div class="button primary" style="display:inline-block;font-size:26px;padding:18px 28px;">Open PDF</div>
            </div>
          </div>
        </div>
        """
    elif mode == "replace":
        content = f"""
        <div class="page">
          {document_page()}
          <div class="highlight" style="top: 302px;"></div>
          <div class="notice warning" style="position:absolute;left:44px;right:44px;bottom:36px;">Tap highlighted OCR text to replace it</div>
        </div>
        """
    elif mode == "toolbar":
        content = f"""
        <div class="page">
          {document_page()}
          <div class="mask" style="top: 302px;"></div>
          <div class="edit-text" style="top: 298px;">धर्म और हिंदी पाठ</div>
        </div>
        <div class="toolbar">
          <div class="tool">−</div>
          <div class="tool">14</div>
          <div class="tool">+</div>
          <div class="tool">Aa</div>
          <div class="tool">↶</div>
          <div class="tool danger">⌫</div>
          <div class="button primary" style="margin-left:auto;">Export</div>
        </div>
        """
    else:
        content = f"""
        <div class="page">
          {document_page()}
          <div class="mask" style="top: 302px;"></div>
          <div class="edit-text" style="top: 298px;">हिंदी आवेदन</div>
          <div class="notice success" style="position:absolute;left:44px;right:44px;bottom:36px;">Exported as a new PDF file</div>
        </div>
        """

    toolbar = "" if mode == "toolbar" else '<div class="toolbar"><div class="tool">Edit</div><div class="tool">Add</div><div class="tool">Erase</div><div class="button primary" style="margin-left:auto;">Save</div></div>'
    return f"""
    <div class="screen{tablet_class}">
      <div class="status"><span>9:41</span><span>100%</span></div>
      <div class="appbar">
        <div class="appname"><span class="mini-icon">हि</span><span>Hindi PDF Editor</span></div>
        <div class="top-actions"><span class="chip">Page 1/3</span></div>
      </div>
      <div class="workspace">
        {content}
        {panel if tablet else ""}
        {toolbar}
      </div>
    </div>
    """


def document_page() -> str:
    lines = [
        "नाम: राजेश कुमार",
        "विषय: हिंदी पीडीएफ संपादन",
        "मैं इस आवेदन पत्र में आवश्यक सुधार करना चाहता हूँ।",
        "कृपया संशोधित पाठ को सही रूप में स्वीकार करें।",
        "दिनांक: 07 जुलाई 2026",
    ]
    escaped_lines = "\n".join(f'<div class="line">{html.escape(line)}</div>' for line in lines)
    return f"""
      <div class="doc-title">आवेदन पत्र</div>
      <div class="rule"></div>
      {escaped_lines}
      <div class="rule"></div>
      <div class="line small">हस्ताक्षर: ____________</div>
    """


PHONE_SHOTS = [
    ("01-open-pdf.png", "Start with any PDF", "Open documents from your Android device.", "open"),
    ("02-tap-to-replace.png", "Tap text to replace it", "OCR highlights existing text so edits start fast.", "replace"),
    ("03-edit-controls.png", "Fine-tune every edit", "Adjust text size, undo changes, or remove edits.", "toolbar"),
    ("04-export-pdf.png", "Export a fresh PDF", "Save a new file without overwriting the original.", "export"),
]


def screenshot_html(width: int, height: int, title: str, subtitle: str, mode: str, tablet: bool) -> str:
    frame_class = "tablet-frame" if tablet else "phone-frame"
    return f"""
<!doctype html>
<html>
<head><meta charset="utf-8"><style>{css(width, height)}</style></head>
<body>
  <div class="asset">
    <section class="caption">
      <div class="kicker">Hindi PDF Editor</div>
      <h1 class="title">{html.escape(title)}</h1>
      <p class="subtitle">{html.escape(subtitle)}</p>
    </section>
    <div class="{frame_class}">
      {app_screen(mode, tablet)}
    </div>
  </div>
</body>
</html>
"""


def feature_html() -> str:
    return f"""
<!doctype html>
<html>
<head><meta charset="utf-8"><style>{css(1024, 500)}</style></head>
<body>
  <div class="feature">
    <div class="feature-copy">
      <div class="feature-icon">हि</div>
      <div class="feature-title">Hindi PDF Editor</div>
      <div class="feature-subtitle">Edit Hindi text in PDFs and export a new document from your Android device.</div>
    </div>
    <div class="feature-mock">
      <div class="feature-screen">
        <div class="appbar" style="height:62px;padding:0 18px;">
          <div class="appname" style="font-size:17px;"><span class="mini-icon" style="width:31px;height:31px;border-radius:8px;font-size:15px;">हि</span>Hindi PDF Editor</div>
        </div>
        <div style="position:absolute;left:22px;right:22px;top:88px;bottom:22px;background:#fff;border:1px solid #d8dce6;border-radius:12px;padding:24px;">
          <div class="doc-title" style="font-size:28px;margin-bottom:14px;">आवेदन पत्र</div>
          <div class="line" style="font-size:18px;">नाम: राजेश कुमार</div>
          <div class="line" style="font-size:18px;">विषय: हिंदी पीडीएफ संपादन</div>
          <div style="height:44px;background:#fbfbfb;border:1px solid #ddd;border-radius:8px;margin:12px 0;display:flex;align-items:center;padding-left:12px;color:{COLORS["primary_dark"]};font-size:20px;font-weight:800;font-family:'NotoSansDevanagariLocal';">हिंदी आवेदन</div>
          <div class="notice success" style="font-size:15px;padding:12px;margin-top:18px;">Exported as a new PDF</div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
"""


def render_html(chrome: Path, html_text: str, target: Path, width: int, height: int) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as temp_dir:
        html_path = Path(temp_dir) / "asset.html"
        html_path.write_text(html_text, encoding="utf-8")
        subprocess.run(
            [
                str(chrome),
                "--headless=new",
                "--disable-gpu",
                "--hide-scrollbars",
                "--no-first-run",
                "--no-default-browser-check",
                "--force-device-scale-factor=1",
                f"--window-size={width},{height}",
                f"--screenshot={target}",
                html_path.as_uri(),
            ],
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
    with Image.open(target) as image:
        if image.size != (width, height):
            raise RuntimeError(f"{target} rendered at {image.size}, expected {(width, height)}")
    save_optimized_png(target)


def make_screenshot_set(chrome: Path, directory: Path, width: int, height: int, tablet: bool) -> None:
    ensure_clean_dir(directory)
    for filename, title, subtitle, mode in PHONE_SHOTS:
        render_html(
            chrome,
            screenshot_html(width, height, title, subtitle, mode, tablet),
            directory / filename,
            width,
            height,
        )


def make_feature_graphic(chrome: Path) -> None:
    feature_dir = OUT / "feature-graphic"
    ensure_clean_dir(feature_dir)
    render_html(chrome, feature_html(), feature_dir / "feature-graphic-1024x500.png", 1024, 500)


def write_manifest() -> None:
    manifest = OUT / "README.md"
    manifest.write_text(
        """# Google Play Store Assets

Generated with `python3 scripts/generate-play-store-assets.py`.

## Upload files

- App icon: `app-icon/app-icon-512.png` — 512 x 512 PNG
- Feature graphic: `feature-graphic/feature-graphic-1024x500.png` — 1024 x 500 PNG
- Phone screenshots: `phone-screenshots/*.png` — 1080 x 1920 PNG
- 7-inch tablet screenshots: `tablet-7-inch-screenshots/*.png` — 1440 x 2560 PNG
- 10-inch tablet screenshots: `tablet-10-inch-screenshots/*.png` — 1800 x 3200 PNG
""",
        encoding="utf-8",
    )


def verify_assets() -> None:
    limits = {
        "app-icon/app-icon-512.png": ((512, 512), 1_000_000),
        "feature-graphic/feature-graphic-1024x500.png": ((1024, 500), 15_000_000),
    }
    for rel in sorted((OUT / "phone-screenshots").glob("*.png")):
        limits[str(rel.relative_to(OUT))] = ((1080, 1920), 8_000_000)
    for rel in sorted((OUT / "tablet-7-inch-screenshots").glob("*.png")):
        limits[str(rel.relative_to(OUT))] = ((1440, 2560), 8_000_000)
    for rel in sorted((OUT / "tablet-10-inch-screenshots").glob("*.png")):
        limits[str(rel.relative_to(OUT))] = ((1800, 3200), 8_000_000)

    rows = []
    for rel, (expected_size, max_bytes) in limits.items():
        path = OUT / rel
        with Image.open(path) as image:
            if image.size != expected_size:
                raise RuntimeError(f"{rel}: {image.size}, expected {expected_size}")
        size = path.stat().st_size
        if size > max_bytes:
            raise RuntimeError(f"{rel}: {size} bytes exceeds {max_bytes}")
        rows.append(f"{rel}: {expected_size[0]}x{expected_size[1]}, {size / 1024:.1f} KB")
    print("\n".join(rows))


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    chrome = find_chrome()
    make_icon(chrome)
    make_feature_graphic(chrome)
    make_screenshot_set(chrome, OUT / "phone-screenshots", 1080, 1920, tablet=False)
    make_screenshot_set(chrome, OUT / "tablet-7-inch-screenshots", 1440, 2560, tablet=True)
    make_screenshot_set(chrome, OUT / "tablet-10-inch-screenshots", 1800, 3200, tablet=True)
    write_manifest()
    verify_assets()


if __name__ == "__main__":
    main()
