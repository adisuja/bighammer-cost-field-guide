"""Render og.png (1200x630), favicon PNGs from local HTML/SVG. Run: python3 tools/render_assets.py"""
from pathlib import Path
from playwright.sync_api import sync_playwright
root = Path(__file__).resolve().parent.parent
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 1200, 'height': 630})
    pg.goto((root / 'tools/og.html').as_uri()); pg.wait_for_timeout(800)
    pg.locator('.og').screenshot(path=str(root / 'og.png'))
    svg = (root / 'favicon.svg').read_text()
    for size, name in [(32, 'favicon-32.png'), (180, 'apple-touch-icon.png')]:
        pg2 = b.new_page(viewport={'width': size, 'height': size})
        pg2.set_content(f'<html><body style="margin:0;background:transparent">{svg.replace("<svg ", f"<svg width={size} height={size} ")}</body></html>')
        pg2.screenshot(path=str(root / name), omit_background=True, clip={'x':0,'y':0,'width':size,'height':size})
    b.close()
print('ok')
