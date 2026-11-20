#!/usr/bin/env python3
"""Turn a landscape gameplay capture into a vertical 1080x1920 YouTube Short.

    python3 tools/video/compose.py <capture.mp4> <slug> "<Game Title>" "<hook line>" <out.mp4> [seconds=22] [mode=play|submit]

Picks the window of the capture with the most highlight moments (from <capture.mp4>.json written by
capture.py), lays the real gameplay over a blurred copy of itself, adds the hook on top, a call to
action under the game and an end card with the site logo. Game audio only.

mode=play (default): CTA "PLAY FREE: ilovewebgames.com" — promotes playing the featured game.
mode=submit: CTA "SUBMIT YOUR GAME: contact@ilovewebgames.com" — promotes developers sending in
their own web game instead (Marko, 20.11.2026: 2 of every 3 nightly Shorts use this mode).
"""
import json, os, subprocess, sys, tempfile
from playwright.sync_api import sync_playwright

cap, slug, title, hook, out = sys.argv[1:6]
DUR = float(sys.argv[6]) if len(sys.argv) > 6 else 22.0
MODE = sys.argv[7] if len(sys.argv) > 7 else 'play'
END = 2.6                                   # end card length (inside DUR)
HERE = os.path.dirname(os.path.abspath(__file__))
FONT = os.path.abspath(f'static/play/ball-ball-away/lilita-one.woff2')
LOGO = os.path.join(HERE, 'assets', 'logo-512.png')
tmp = tempfile.mkdtemp(prefix='short-')
import base64
b64 = lambda f: base64.b64encode(open(f, 'rb').read()).decode()   # inline: file:// is blocked inside set_content pages

CTA = {
    'play':   {'pill': 'PLAY FREE: ilovewebgames.com', 'sub': f'{title} · no download · no sign-up',
               'end_title': title, 'end_u': 'ilovewebgames.com', 'end_s': 'Free in your browser · thousands of games'},
    'submit': {'pill': 'SUBMIT YOUR GAME: contact@ilovewebgames.com', 'sub': 'Got a web game? We publish community titles.',
               'end_title': 'Submit Your Game', 'end_u': 'contact@ilovewebgames.com', 'end_s': 'We publish community web games · ilovewebgames.com'},
}[MODE]

# ---- pick the best window ----
length = float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', cap]).decode())
hl = []
try: hl = json.load(open(cap + '.json')).get('highlights', [])
except Exception: pass
starts = [x / 2 for x in range(0, int(max(0, length - DUR) * 2) + 1)] or [0]
score = lambda s: sum(1 for h in hl if s + 1.5 <= h <= s + DUR - END - .5)
start = max(starts, key=lambda s: (score(s), -abs(s - 3)))
gameplay = DUR - END

# ---- overlays rendered from HTML (real fonts, crisp text) ----
css = f"""@font-face{{font-family:L;src:url(data:font/woff2;base64,{b64(FONT)}) format('woff2')}}
*{{margin:0;padding:0;box-sizing:border-box}} html,body{{width:1080px;height:1920px;background:transparent;font-family:L,system-ui,sans-serif;color:#fff}}
.o{{-webkit-text-stroke:0;text-shadow:0 0 2px #000,0 6px 0 #1b0b3a,0 10px 30px rgba(0,0,0,.65)}}"""
pages = {
 'over': f"""<style>{css}
 .hook{{position:absolute;top:150px;left:60px;right:60px;text-align:center;font-size:84px;line-height:1.05}}
 .cta{{position:absolute;top:1385px;left:0;right:0;text-align:center}}
 .pill{{display:inline-block;background:linear-gradient(90deg,#ff3d8b,#8a3dff);border-radius:999px;padding:22px 48px;font-size:58px;box-shadow:0 10px 40px rgba(138,61,255,.55)}}
 .sub{{margin-top:22px;font-size:40px;opacity:.95}}</style>
 <div class="hook o">{hook}</div>
 <div class="cta"><div class="pill o">{CTA['pill']}</div><div class="sub o">{CTA['sub']}</div></div>""",
 'end': f"""<style>{css} body{{background:rgba(14,6,34,.9)}}
 .w{{position:absolute;top:520px;left:0;right:0;text-align:center}}
 img{{width:380px;height:380px;border-radius:60px;box-shadow:0 20px 70px rgba(138,61,255,.6)}}
 .t{{margin-top:50px;font-size:92px}} .u{{margin-top:26px;font-size:66px;color:#ffd84a}} .s{{margin-top:26px;font-size:44px;opacity:.9}}</style>
 <div class="w"><img src="data:image/png;base64,{b64(LOGO)}"><div class="t o">{CTA['end_title']}</div><div class="u o">{CTA['end_u']}</div><div class="s o">{CTA['end_s']}</div></div>""",
}
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1080, 'height': 1920})
    for name, html in pages.items():
        pg.set_content(f'<!doctype html><meta charset=utf-8><body>{html}</body>'); pg.evaluate('document.fonts.ready'); pg.wait_for_timeout(300)
        pg.screenshot(path=f'{tmp}/{name}.png', omit_background=True)
    b.close()

# ---- video: blurred cover background + zoomed gameplay band + overlays + end card ----
fc = (
 f"[0:v]trim=start={start}:duration={DUR},setpts=PTS-STARTPTS,split=2[a][b];"
 "[a]scale=-2:1920,crop=1080:1920,boxblur=28:3,eq=brightness=-0.18:saturation=1.25[bg];"
 "[b]crop=960:720:120:0,scale=1080:810:flags=lanczos[fg];"
 "[bg][fg]overlay=0:520[v1];"
 f"[v1][1:v]overlay=0:0:enable='lt(t,{gameplay})'[v2];"
 f"[v2][2:v]overlay=0:0:enable='gte(t,{gameplay})'[v3];"
 f"[v3]fade=t=in:st=0:d=0.25,format=yuv420p[v];"
 f"[0:a]atrim=start={start}:duration={DUR},asetpts=PTS-STARTPTS,afade=t=out:st={DUR-1.2}:d=1.2,loudnorm=I=-14:TP=-1.5[au]"
)
subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', cap, '-loop', '1', '-i', f'{tmp}/over.png', '-loop', '1', '-i', f'{tmp}/end.png',
    '-filter_complex', fc, '-map', '[v]', '-map', '[au]', '-t', str(DUR), '-r', '30',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '19', '-maxrate', '9M', '-bufsize', '18M', '-profile:v', 'high',
    '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', out], check=True)
print(json.dumps({'out': out, 'start': start, 'highlights_in_clip': score(start), 'bytes': os.path.getsize(out), 'mode': MODE}))
