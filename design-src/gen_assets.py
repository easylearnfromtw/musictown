#!/usr/bin/env python3
"""Render icons, iOS startup images and the social preview with Chromium.
usage: python3 gen_assets.py out_dir"""
import asyncio, json, sys, pathlib
from playwright.async_api import async_playwright

OUT = pathlib.Path(sys.argv[1]); (OUT / "assets/icons").mkdir(parents=True, exist_ok=True); (OUT / "assets/splash").mkdir(parents=True, exist_ok=True)

GLOBE = lambda c, w: f'''<g fill="none" stroke="{c}" stroke-width="{w}" stroke-linecap="round">
  <circle cx="512" cy="512" r="292"/>
  <ellipse cx="512" cy="512" rx="122" ry="292"/>
  <ellipse cx="512" cy="512" rx="292" ry="108" transform="rotate(-14 512 512)"/>
</g><circle cx="512" cy="512" r="30" fill="{c}"/>'''

ICON = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="__N__" height="__N__">
<defs>
 <linearGradient id="bg" x1="0" y1="0" x2="0.6" y2="1"><stop offset="0" stop-color="#2A4C7E"/><stop offset="0.55" stop-color="#1F3A63"/><stop offset="1" stop-color="#152945"/></linearGradient>
 <radialGradient id="glow" cx="0.28" cy="0.16" r="0.75"><stop offset="0" stop-color="#9FC2EA" stop-opacity="0.45"/><stop offset="1" stop-color="#9FC2EA" stop-opacity="0"/></radialGradient>
 <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F6EBCF"/><stop offset="0.5" stop-color="#E6D3A6"/><stop offset="1" stop-color="#CDB27A"/></linearGradient>
</defs>
<rect width="1024" height="1024" fill="url(#bg)"/>
<rect width="1024" height="1024" fill="url(#glow)"/>
<rect x="64" y="64" width="896" height="896" rx="150" fill="none" stroke="#E6D3A6" stroke-opacity="0.22" stroke-width="5"/>
{GLOBE("url(#gold)", 30)}
</svg>'''

FAVICON = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="15" fill="#1F3A63"/><g fill="none" stroke="#E9D9B2" stroke-width="3.4"><circle cx="32" cy="32" r="18"/><ellipse cx="32" cy="32" rx="7.6" ry="18"/><ellipse cx="32" cy="32" rx="18" ry="6.8" transform="rotate(-14 32 32)"/></g><circle cx="32" cy="32" r="2.2" fill="#E9D9B2"/></svg>'''

SPLASH = [  # css width/height and pixel ratio of iPhones (portrait)
    (430, 932, 3), (393, 852, 3), (402, 874, 3), (440, 956, 3), (390, 844, 3), (428, 926, 3),
    (375, 812, 3), (414, 896, 3), (414, 896, 2), (375, 667, 2), (414, 736, 3), (360, 780, 3)]

def splash_html(w, h):
    s = min(w, h) * .26
    return f'''<html><body style="margin:0;width:{w}px;height:{h}px;background:#F5F6FA;display:grid;place-items:center;overflow:hidden">
<div style="display:grid;justify-items:center;gap:{s*.2}px;transform:translateY(-4%)">
<svg viewBox="0 0 1024 1024" width="{s}" height="{s}">{GLOBE("#1F3A63", 34)}</svg>
<div style="font:600 {s*.15}px Inter, sans-serif;letter-spacing:.1em;color:#18213A">musicetown</div></div></body></html>'''

OG = f'''<html><body style="margin:0;width:1200px;height:630px;background:#F5F6FA;font-family:Inter,sans-serif;overflow:hidden;position:relative">
<div style="position:absolute;inset:0;background:radial-gradient(60% 80% at 15% 10%, #D7E7F8 0%, transparent 60%), radial-gradient(50% 70% at 95% 100%, #F5DCE6 0%, transparent 60%)"></div>
<div style="position:absolute;left:80px;top:96px;color:#18213A">
 <div style="font:600 26px Inter;letter-spacing:.1em;display:flex;align-items:center;gap:14px"><svg viewBox="0 0 1024 1024" width="40" height="40">{GLOBE("#18213A", 44)}</svg>musicetown</div>
 <div style="margin-top:60px;font:400 104px/0.95 'GFS Baskerville', Caladea, serif;letter-spacing:-.02em">Music for<br>where you are.</div>
 <div style="margin-top:34px;font:500 27px Inter;color:#4A5470">23 destinations · city-limited ticket stubs</div>
</div>
<div style="position:absolute;right:86px;top:118px;width:300px;height:394px;border-radius:30px;background:#fff;box-shadow:0 30px 60px rgba(24,33,58,.18);overflow:hidden;transform:rotate(4deg)">
 <div style="height:220px;background:#5f8f96;color:#fff;padding:26px;box-sizing:border-box">
  <div style="font:600 14px Inter;letter-spacing:.08em;opacity:.9">CITY LIMITED PASS</div>
  <div style="margin-top:38px;font:italic 400 108px/0.8 'GFS Baskerville', Caladea, serif">TPE</div>
 </div>
 <div style="border-top:3px dashed rgba(24,33,58,.16);margin:0 18px"></div>
 <div style="padding:22px 26px;font:600 20px Inter;color:#18213A">Taipei Dream<div style="margin-top:8px;font:500 15px Inter;color:#8790A6">發行於當地 · 2026.10.02</div></div>
</div></body></html>'''

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        async def shot(html, w, h, path, scale=1):
            pg = await b.new_page(viewport={"width": w, "height": h}, device_scale_factor=scale)
            await pg.set_content(html); await pg.wait_for_timeout(120)
            await pg.screenshot(path=str(path), omit_background=False); await pg.close()
        icon_html = lambda n: f'<html><body style="margin:0;width:{n}px;height:{n}px;overflow:hidden">{ICON.replace("__N__", str(n))}</body></html>'
        for n, name in [(180, "apple-touch-icon.png"), (192, "icon-192.png"), (512, "icon-512.png"), (512, "icon-maskable-512.png"), (32, "favicon-32.png")]:
            await shot(icon_html(n), n, n, OUT / name)
        for n in (167, 152, 120, 1024):
            await shot(icon_html(n), n, n, OUT / f"assets/icons/apple-touch-icon-{n}.png")
        (OUT / "favicon.svg").write_text(FAVICON)
        meta = []
        for w, h, r in SPLASH:
            f = f"launch-{w*r}x{h*r}.png"
            await shot(splash_html(w, h), w, h, OUT / "assets/splash" / f, r)
            meta.append({"file": f, "dw": w, "dh": h, "r": r})
        (pathlib.Path(__file__).parent / "splash.json").write_text(json.dumps(meta))
        await shot(OG, 1200, 630, OUT / "assets/og-image.png")
        await b.close()
asyncio.run(main())
print("assets ok")
