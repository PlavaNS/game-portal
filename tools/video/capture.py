#!/usr/bin/env python3
"""Record real gameplay of one of our games (with game audio) for a YouTube Short.

    xvfb-run -n 99 -s "-screen 0 1280x720x24" python3 tools/video/capture.py <slug> <seconds> <out.mp4>

Run from the repo root. Serves static/ on a local port, opens /play/<slug>/ in a headed Chromium
(kiosk, 1280x720) on the Xvfb display, plays the game with the bot in tools/video/bots/<slug>.py,
and records the display + a PulseAudio null sink with ffmpeg. A copy of the game's script gets a
debug hook (window.__X) injected so the bot can read game state; the repo files are never changed.
"""
import importlib.util, os, subprocess, sys, threading, time, http.server, functools, socketserver
from playwright.sync_api import sync_playwright

slug, secs, out = sys.argv[1], float(sys.argv[2]), sys.argv[3]
ROOT = os.path.abspath('static')
PORT = int(os.environ.get("CAP_PORT", "8841"))
W, H = 1280, 720
DISPLAY = os.environ.get('DISPLAY', ':99')

# ---- local static server (quiet) ----
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
socketserver.ThreadingTCPServer.allow_reuse_address = True
srv = socketserver.ThreadingTCPServer(('127.0.0.1', PORT), functools.partial(Q, directory=ROOT))
srv.daemon_threads = True
threading.Thread(target=srv.serve_forever, daemon=True).start()

# ---- audio: PulseAudio null sink, chromium plays into it, ffmpeg records its monitor ----
subprocess.run('pulseaudio --check || pulseaudio -D --exit-idle-time=-1 --system=false', shell=True)
subprocess.run('pactl load-module module-null-sink sink_name=rec >/dev/null 2>&1; pactl set-default-sink rec', shell=True)

spec = importlib.util.spec_from_file_location('bot', f'tools/video/bots/{slug}.py')
bot = importlib.util.module_from_spec(spec); spec.loader.exec_module(bot)

with sync_playwright() as p:
    br = p.chromium.launch(headless=False, args=[f'--window-size={W},{H+180}', '--window-position=0,0', 
        '--autoplay-policy=no-user-gesture-required', '--disable-infobars', '--no-first-run'],
        ignore_default_args=['--enable-automation', '--mute-audio'], env={**os.environ, 'PULSE_SINK': 'rec'})
    ctx = br.new_context(viewport={'width': W, 'height': H})
    page = ctx.new_page()
    for pattern, fn in getattr(bot, 'ROUTES', {}).items():
        page.route(pattern, fn)
    page.goto(f'http://127.0.0.1:{PORT}/play/{slug}/', wait_until='load')
    if hasattr(bot, 'prepare'): bot.prepare(page)
    time.sleep(1.5)
    top = page.evaluate('window.outerHeight - window.innerHeight')   # browser toolbar height: crop it away
    rec = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'x11grab', '-framerate', '30', '-video_size', f'{W}x{H}',
        '-draw_mouse', '0', '-i', f'{DISPLAY}.0+0,{top}', '-f', 'pulse', '-i', 'rec.monitor',
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '16', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k',
        '-t', str(secs), out], stdin=subprocess.PIPE)
    stats = bot.play(page, secs)
    rec.wait(timeout=secs + 30)
    print('STATS', stats)
    import json; json.dump(stats, open(out + '.json', 'w'))
    br.close()
srv.shutdown()
