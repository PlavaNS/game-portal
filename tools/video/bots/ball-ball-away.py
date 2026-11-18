"""Bot for Ball Ball Away: draws real ramps with the mouse (the same input a player uses)."""
import json, random, time

def _hook(route):
    r = route.fetch(); body = r.text()
    i = body.rfind('})();')
    route.fulfill(response=r, body=body[:i] + 'window.__X=c=>eval(c);' + body[i:])

ROUTES = {'**/play/ball-ball-away/game.js': _hook}

def prepare(page):
    # skip the first-run tutorial and pick a flashy look the game really has (owned skins are local save data)
    ball = random.choice(['fire', 'disco', 'gold', 'melon', 'ice', 'eye'])
    line = random.choice(['rainbow', 'laser', 'flame', 'gold', 'lime'])
    page.evaluate("""([b,l]) => { const s = JSON.parse(localStorage.getItem('bba_save')||'{}');
      Object.assign(s, {tut:true, ball:b, line:l, ownBalls:['blue',b], ownLines:['neon',l], gift:new Date().toISOString().slice(0,10)});
      localStorage.setItem('bba_save', JSON.stringify(s)); }""", [ball, line])
    page.reload(wait_until='load')

STATE = "JSON.stringify({m:mode,x:ball&&ball.x,y:ball&&ball.y,vx:ball&&ball.vx,vy:ball&&ball.vy,cx:camX,cy:camY,s:scale,rx:stages[cur]&&stages[cur].ringX,ry:stages[cur]&&stages[cur].ringY,p:portals,sc:score,n:lines.length,g:ball?surfaceY(stages[cur],ball.x):540,u:!!ball&&lines.some(l=>{const a=Math.min(l.ax,l.bx),b=Math.max(l.ax,l.bx);if(ball.x<a-10||ball.x>b+10)return false;const ly=l.ay+(l.by-l.ay)*((ball.x-l.ax)/((l.bx-l.ax)||1));return ly-ball.y>0&&ly-ball.y<140;})})"

def play(page, secs):
    t0 = time.time(); last_line = 0
    page.click('#btnPlay', force=True); time.sleep(1.2)
    best = 0; events = []
    while time.time() - t0 < secs:
        st = json.loads(page.evaluate(f'window.__X({json.dumps(STATE)})'))
        m = st['m']
        if (st['p'] or 0) > best: best = st['p']; events.append(round(time.time() - t0, 1))   # portal passed: a highlight moment
        scr = lambda wx, wy: ((wx - st['cx']) * st['s'], (wy - st['cy']) * st['s'])
        if m == 'ready':
            time.sleep(.4); page.mouse.click(640, 360); time.sleep(.2); continue
        if m == 'over':
            b = page.query_selector('#btnAgain, #btnRetry, #btnPlay')
            if b and b.is_visible(): b.click(force=True)
            time.sleep(1); continue
        if m != 'play':
            time.sleep(.05); continue
        x, y, vx, vy = st['x'], st['y'], st['vx'], st['vy']
        to_ring = st['rx'] - x
        # a ramp right under where the ball will be in a moment, sloping down to the right (bounces it up and onward)
        grounded = y > st['g'] - 40 and abs(vy) < 160
        if (grounded or (vy > 40 and y > 250)) and not st['u'] and time.time() - last_line > .3:
            px, py = x + vx * .07, min(y + max(vy, 0) * .07, st['g'] - 20)
            steep = 0 < to_ring < 700 and st['ry'] < 190
            ax, ay = px - 70, py + 22 - (0 if steep else 10)
            bx, by = px + 80, py + 22 + (random.uniform(6, 14) if steep else random.uniform(26, 42))   # falls to the right: the bounce sends the ball up AND forward
            ay, by = min(ay, st['g'] - 4), min(by, st['g'] - 4)
            sa, sb = scr(ax, ay), scr(bx, by)
            page.mouse.move(*sa); page.mouse.down()
            for k in range(1, 6):
                page.mouse.move(sa[0] + (sb[0] - sa[0]) * k / 5, sa[1] + (sb[1] - sa[1]) * k / 5); time.sleep(.01)
            page.mouse.up(); last_line = time.time()
            if __import__('os').environ.get('BOTDBG'): print('LINE', round(x), round(y), round(vx), round(vy), round(st['g']), (round(ax),round(ay),round(bx),round(by)), flush=True)
        time.sleep(.02)
    return {'portals': best, 'highlights': events}
