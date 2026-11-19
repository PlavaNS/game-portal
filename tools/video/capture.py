#!/usr/bin/env python3
"""Record real gameplay of one of our games for a YouTube Short — smooth 30 fps, with the game's audio.

    xvfb-run -n 99 -s "-screen 0 1280x960x24" python3 tools/video/capture.py <slug> <seconds> <out.mp4>

Run from the repo root.

Why two passes: a screen recording of Chromium in this container drops to ~3 real fps (software
rendering), which looks choppy on YouTube (Marko caught it on the first Short, 18.11.2026). So:
  1. FRAMES: the page runs on a virtual clock (vclock.js: requestAnimationFrame/performance.now/Date.now
     are stepped exactly 1/30 s per frame). The bot plays with real mouse/keyboard input between steps
     and every frame is a screenshot -> perfectly smooth 30 fps whatever the machine speed.
     Every sound the game asks for (bot.AUDIO, e.g. audio.sfx.* and audio.music.*) is logged with its
     virtual time.
  2. AUDIO: a fresh copy of the game is opened in real time and the same sound calls are replayed at
     the same times while PulseAudio records -> the game's own sounds and music, in sync.
Never upload a clip without checking it: python3 tools/video/check.py <file> must say SMOOTH.
"""
import importlib.util, json, os, subprocess, sys, threading, time, http.server, functools, socketserver, tempfile, shutil
from playwright.sync_api import sync_playwright

slug, secs, out = sys.argv[1], float(sys.argv[2]), sys.argv[3]
ROOT = os.path.abspath('static')
PORT = int(os.environ.get('CAP_PORT', '8841'))
W, H, FPS = 1280, 720, 30
HERE = os.path.dirname(os.path.abspath(__file__))
VCLOCK = open(os.path.join(HERE, 'vclock.js')).read()

class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
socketserver.ThreadingTCPServer.allow_reuse_address = True
srv = socketserver.ThreadingTCPServer(('127.0.0.1', PORT), functools.partial(Q, directory=ROOT))
srv.daemon_threads = True
threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = f'http://127.0.0.1:{PORT}/play/{slug}/'

spec = importlib.util.spec_from_file_location('bot', os.path.join(HERE, 'bots', f'{slug}.py'))
bot = importlib.util.module_from_spec(spec); spec.loader.exec_module(bot)
AUDIO = getattr(bot, 'AUDIO', [])          # e.g. ['audio.sfx', 'audio.music']: objects whose functions make sound

# logs every call to a sound function with its virtual time (installed after the game scripts ran)
HOOK_AUDIO = """objs => { window.__alog = [];
  for (const path of objs) { let o; try { o = eval(path); } catch (e) { continue; } if (!o) continue;
    for (const k of Object.keys(o)) { const f = o[k]; if (typeof f !== 'function') continue;
      o[k] = function (...a) { try { window.__alog.push([performance.now(), path, k, JSON.parse(JSON.stringify(a))]); } catch (e) {} return f.apply(this, a); }; } }
  return true; }"""

tmp = tempfile.mkdtemp(prefix='cap-')
frames = os.path.join(tmp, 'f'); os.makedirs(frames)
nframes = int(secs * FPS)

with sync_playwright() as p:
    # ---------- pass 1: frames on a virtual clock ----------
    br = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    ctx = br.new_context(viewport={'width': W, 'height': H})
    ctx.add_init_script(VCLOCK)
    page = ctx.new_page()
    for pattern, fn in getattr(bot, 'ROUTES', {}).items(): page.route(pattern, fn)
    page.goto(URL, wait_until='load')
    if hasattr(bot, 'prepare'): bot.prepare(page)      # may set save data and reload
    page.evaluate('n => { for (let i = 0; i < n; i++) window.__V.step(1000/30); }', 20)
    if AUDIO: page.evaluate(HOOK_AUDIO, AUDIO)
    vstep = lambda n=1: page.evaluate('n => { for (let i = 0; i < n; i++) window.__V.step(1000/30); }', n)
    t0v = page.evaluate('performance.now()')
    highlights = []
    bot.start(page, vstep)
    for i in range(nframes):
        if bot.tick(page, i / FPS): highlights.append(round(i / FPS, 2))
        vstep()
        page.screenshot(path=f'{frames}/f{i:05d}.jpg', type='jpeg', quality=92)
    alog = page.evaluate('window.__alog || []') if AUDIO else []
    save = page.evaluate("() => JSON.stringify(Object.fromEntries(Object.keys(localStorage).map(k => [k, localStorage.getItem(k)])))")
    br.close()
    events = [[(e[0] - t0v) / 1000.0] + e[1:] for e in alog]
    events = [e for e in events if -0.5 <= e[0] <= secs]
    print('frames', nframes, 'sound events', len(events), 'highlights', highlights)

    # ---------- pass 2: replay the same sounds in real time and record them ----------
    wav = os.path.join(tmp, 'a.wav')
    if events:
        subprocess.run('pulseaudio --check || pulseaudio -D --exit-idle-time=-1 --system=false', shell=True)
        subprocess.run('pactl load-module module-null-sink sink_name=rec >/dev/null 2>&1; pactl set-default-sink rec', shell=True)
        br = p.chromium.launch(headless=False, args=[f'--window-size={W},{H+180}', '--autoplay-policy=no-user-gesture-required'],
            ignore_default_args=['--enable-automation', '--mute-audio'], env={**os.environ, 'PULSE_SINK': 'rec'})
        ctx = br.new_context(viewport={'width': W, 'height': H})
        ctx.add_init_script(f"(s => {{ for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }})({save})")
        page = ctx.new_page()
        page.goto(URL, wait_until='load'); time.sleep(1)
        page.mouse.click(5, 5)                                            # user gesture for the AudioContext
        page.evaluate(getattr(bot, 'AUDIO_UNLOCK', 'true'))
        time.sleep(.8)
        rec = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'pulse', '-i', 'rec.monitor',
            '-ac', '2', '-ar', '48000', '-t', str(secs + 1), wav])
        time.sleep(.35)                                                   # pulse/ffmpeg start-up
        page.evaluate("""ev => { const t0 = performance.now();
          for (const [t, path, k, a] of ev) setTimeout(() => { try { const o = eval(path); o[k].apply(o, a); } catch (e) {} }, Math.max(0, t * 1000)); }""", events)
        rec.wait(timeout=secs + 40)
        br.close()

srv.shutdown()
inputs = ['-framerate', str(FPS), '-i', f'{frames}/f%05d.jpg']
amap = []
if os.path.exists(wav):
    inputs += ['-ss', '0.35', '-i', wav]; amap = ['-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '192k', '-shortest']
else:
    inputs += ['-f', 'lavfi', '-t', str(secs), '-i', 'anullsrc=r=48000:cl=stereo']; amap = ['-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-shortest']
subprocess.run(['ffmpeg', '-y', '-v', 'error', *inputs, *amap, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '16',
                '-pix_fmt', 'yuv420p', '-r', str(FPS), out], check=True)
json.dump({'highlights': highlights, 'sound_events': len(events)}, open(out + '.json', 'w'))
shutil.rmtree(tmp, ignore_errors=True)
print('STATS', {'highlights': highlights, 'sound_events': len(events), 'out': out})
