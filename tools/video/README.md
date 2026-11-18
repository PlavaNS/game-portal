# @ILoveWebGames Shorts rig

Goal: real gameplay Shorts of our own games that send viewers to ilovewebgames.com.
Channel: https://www.youtube.com/@ILoveWebGames (UCld5TX0kD6CG9TsW_7KT4Fw), not made for kids.

## Make a Short
```
apt-get install -y -qq pulseaudio            # once per container (game audio capture)
xvfb-run -n 99 -s "-screen 0 1280x960x24" python3 tools/video/capture.py <slug> 55 /tmp/cap.mp4
python3 tools/video/compose.py /tmp/cap.mp4 <slug> "<Title>" "<hook, use <br> for line breaks>" /tmp/short.mp4 22
```
- `capture.py` serves `static/`, opens `/play/<slug>/` in headed Chromium, lets `bots/<slug>.py` play
  with real mouse/keyboard input and records screen + game audio. Writes `<out>.json` with highlight times.
- `compose.py` picks the 22 s window with the most highlights, builds 1080x1920: hook on top, zoomed
  gameplay, "PLAY FREE: ilovewebgames.com" pill, end card with the site logo.
- ALWAYS look at 4 frames of the result before uploading (blurry, empty or broken = do not upload).

## A new bot
`bots/<slug>.py` defines `ROUTES` (inject `window.__X=c=>eval(c)` into the game script so the bot can
read state, see ball-ball-away.py), optional `prepare(page)` and `play(page, secs)` returning
`{'highlights': [seconds,...]}`. Input must be what a player does (mouse/keys), never state edits.
A bot counts as done only when a 40 s capture shows real progress (score up, levels/portals passed).

## Upload (Studio in Marko's Chrome)
The file input only accepts files shared with the session, so the mp4 goes through the `media`
branch (force-replaced every run, never merged): push it, then in the Studio upload dialog
`fetch('https://raw.githubusercontent.com/PlavaNS/game-portal/media/<file>.mp4')` -> `File` ->
`DataTransfer` -> `input[type=file].files` + `change` event. raw.githubusercontent sends CORS `*`.
If Studio says "Oops, you don't have permission", switch channel at youtube.com/channel_switcher.
Links in Shorts descriptions are not clickable; the on-screen URL and the channel links do the work,
so the description link carries utm_source=youtube&utm_medium=shorts&utm_campaign=<slug> for GA4.
