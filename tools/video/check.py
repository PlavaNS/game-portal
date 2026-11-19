#!/usr/bin/env python3
"""Fail loudly if a rendered clip is choppy. Run on every clip before it is ever uploaded.

    python3 tools/video/check.py <file.mp4>

Counts frames ffmpeg's mpdecimate filter calls duplicates of the previous frame. A real,
smoothly-captured 30fps clip has ~0 duplicates; a stuttery capture (e.g. a real-time screen
recording that couldn't keep up with 30fps rendering) has most of its frames as duplicates.
Exits 1 and prints STUTTER if more than 8% of frames are duplicates; prints SMOOTH otherwise.
"""
import subprocess, sys, re

f = sys.argv[1]
out = subprocess.run(['ffmpeg', '-i', f, '-vf', 'mpdecimate,metadata=mode=print:file=-', '-f', 'null', '-'],
                      capture_output=True, text=True).stdout + subprocess.run(
    ['ffprobe', '-v', 'error', '-select_streams', 'v', '-count_frames', '-show_entries', 'stream=nb_read_frames', '-of', 'csv=p=0', f],
    capture_output=True, text=True).stdout
total = int(re.search(r'\d+', out.strip().splitlines()[-1] or '0').group())
r = subprocess.run(['ffmpeg', '-i', f, '-vf', 'mpdecimate=hi=0:lo=0:frac=1', '-loglevel', 'error', '-f', 'null', '-vsync', '0', '-c:v', 'rawvideo', '-y', '/dev/null'],
                    capture_output=True, text=True)
kept = int(subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v', '-show_entries', 'stream=nb_read_frames', '-of', 'csv=p=0',
    *subprocess.run(['sh', '-c', f"ffmpeg -y -loglevel error -i '{f}' -vf mpdecimate=hi=0:lo=0:frac=1 -vsync 0 /tmp/_chk_$$.mp4 && echo /tmp/_chk_$$.mp4"],
                     capture_output=True, text=True).stdout.strip().split()],
    capture_output=True, text=True).stdout.strip() or '0')
dup_pct = 100 * (1 - kept / total) if total else 0
print(f'{f}: total={total} unique={kept} duplicate%={dup_pct:.1f}')
if dup_pct > 8:
    print('STUTTER'); sys.exit(1)
print('SMOOTH')
