// Bonkers Arena — synthwave music and neon sound effects, all generated with Web Audio.
(function (root) {
  let ctx = null, out = null, sfxBus = null, musicBus = null, delayIn = null, noiseBuf = null;
  const state = { sfx: true, music: true };
  const MUSIC_VOL = 0.3;

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    comp.connect(ctx.destination);
    out = ctx.createGain(); out.gain.value = hostMuted ? 0 : .9; out.connect(comp);
    sfxBus = ctx.createGain(); sfxBus.gain.value = state.sfx ? 1 : 0; sfxBus.connect(out);
    musicBus = ctx.createGain(); musicBus.gain.value = state.music ? MUSIC_VOL : 0; musicBus.connect(out);
    // echo for the lead synth
    delayIn = ctx.createGain(); delayIn.gain.value = .35;
    const d = ctx.createDelay(1); d.delayTime.value = 60 / 108 * .75;
    const fb = ctx.createGain(); fb.gain.value = .38;
    const dl = ctx.createBiquadFilter(); dl.type = 'lowpass'; dl.frequency.value = 2200;
    delayIn.connect(d); d.connect(dl); dl.connect(fb); fb.connect(d); dl.connect(musicBus);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  }

  const hz = n => 440 * Math.pow(2, (n - 69) / 12);

  function env(g, t, a, peak, dur, rel) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.setValueAtTime(peak, t + Math.max(a, dur - rel));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }

  function osc(type, f0, f1, t, dur, vol, dest, opts) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    if (opts && opts.detune) o.detune.value = opts.detune;
    env(g, t, (opts && opts.a) || .005, vol, dur, (opts && opts.rel) || dur * .6);
    let node = o;
    if (opts && opts.lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = opts.lp; f.Q.value = opts.q || 1; o.connect(f); node = f; }
    node.connect(g); g.connect(dest);
    if (opts && opts.send) g.connect(delayIn);
    o.start(t); o.stop(t + dur + .05);
  }

  function noise(t, dur, f0, f1, q, vol, type, dest) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest);
    s.start(t, Math.random() * .5); s.stop(t + dur + .05);
  }

  // ---------- instruments ----------
  const I = {
    kick(t) { osc('sine', 130, 40, t, .32, .34, musicBus, { rel: .28 }); },
    snare(t) { noise(t, .26, 1600, 900, .7, .11, 'bandpass', musicBus); osc('triangle', 190, 130, t, .1, .06, musicBus); },
    hat(t, open) { noise(t, open ? .14 : .04, 8000, 6500, 1, open ? .028 : .018, 'highpass', musicBus); },
    bass(t, n, dur) {
      const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      o.type = 'sawtooth'; o.frequency.value = hz(n);
      f.type = 'lowpass'; f.Q.value = 3; f.frequency.setValueAtTime(220, t); f.frequency.exponentialRampToValueAtTime(650, t + .05); f.frequency.exponentialRampToValueAtTime(260, t + dur);
      env(g, t, .01, .14, dur, dur * .3);
      o.connect(f); f.connect(g); g.connect(musicBus); o.start(t); o.stop(t + dur + .05);
    },
    pad(t, notes, dur) {
      for (const n of notes) for (const dt of [-10, 10]) osc('sawtooth', hz(n + 12), 0, t, dur, .02, musicBus, { a: .6, rel: .7, lp: 950, detune: dt });
    },
    arp(t, n, dur) { osc('triangle', hz(n + 24), 0, t, dur, .022, musicBus, { lp: 1800, rel: dur * .8, send: true }); },
    lead(t, n, dur) {
      osc('sawtooth', hz(n + 12), 0, t, dur, .03, musicBus, { a: .04, lp: 1700, rel: dur * .5, send: true });
      osc('triangle', hz(n + 12), 0, t, dur, .03, musicBus, { a: .04, lp: 2200, rel: dur * .5, detune: 7 });
    },
  };

  // ---------- songs ----------
  // chord = triad (MIDI) around octave 3; tones for lead/arp = [root, 3rd, 5th, root+12, 3rd+12, 5th+12]
  const C = {
    Em: [52, 55, 59], C: [48, 52, 55], G: [55, 59, 62], D: [50, 54, 57], Am: [45, 48, 52], B: [47, 51, 54], F: [41, 45, 48], Gm: [43, 47, 50],
  };
  const MOTIFS = [
    [3, null, null, 4, null, 5, null, 4, 3, null, 2, null, 3, null, null, null],
    [5, null, 4, null, 3, null, null, 2, 3, 4, null, 5, null, null, 4, null],
    [3, null, 3, 4, 5, null, 4, 3, null, 2, null, 3, 4, null, 5, null],
    [3, null, null, null, 4, null, null, null, 5, null, null, 4, null, null, null, null],
    [5, null, null, null, 4, null, 3, null, 4, null, null, null, 2, null, null, null],
  ];
  const SONGS = {
    menu: {
      bpm: 86, loopFrom: 1,
      sections: [
        { prog: ['Am', 'F', 'C', 'G'], pad: 1, arp: 1 },
        { prog: ['Am', 'F', 'C', 'G', 'Am', 'F', 'C', 'G'], pad: 1, arp: 1, bass: 'long', kick: 'half', hat: 'off' },
        { prog: ['F', 'G', 'Am', 'Am', 'F', 'G', 'C', 'G'], pad: 1, arp: 1, bass: 'eighths', kick: 'four', hat: 'off', lead: 3 },
        { prog: ['Am', 'F', 'C', 'G', 'Am', 'F', 'C', 'G'], pad: 1, bass: 'long', kick: 'half', lead: 4 },
        { prog: ['F', 'C', 'G', 'G'], pad: 1, arp: 1 },
      ],
    },
    battle: {
      bpm: 108, loopFrom: 1,
      sections: [
        { prog: ['Em', 'C', 'G', 'D'], pad: 1, kick: 'four' },
        { prog: ['Em', 'C', 'G', 'D', 'Em', 'C', 'G', 'D'], pad: 1, kick: 'four', hat: 'off', bass: 'eighths', arp: 1 },
        { prog: ['Em', 'C', 'G', 'D', 'Em', 'C', 'G', 'D'], kick: 'four', snare: 1, hat: 'sixteen', bass: 'eighths', lead: 0 },
        { prog: ['C', 'D', 'Em', 'Em', 'Am', 'C', 'D', 'B'], pad: 1, kick: 'four', snare: 1, hat: 'sixteen', bass: 'eighths', lead: 1 },
        { prog: ['Am', 'C', 'D', 'B'], pad: 1, arp: 1, bass: 'long' },
        { prog: ['Em', 'C', 'G', 'D', 'Em', 'C', 'G', 'D'], pad: 1, kick: 'four', snare: 1, hat: 'sixteen', bass: 'eighths', arp: 1, lead: 2 },
      ],
    },
  };

  const player = { song: null, want: 'menu', sec: 0, bar: 0, step: 0, next: 0, timer: null, intense: false };

  function tones(ch) { const c = C[ch]; return [c[0], c[1], c[2], c[0] + 12, c[1] + 12, c[2] + 12]; }

  function playStep(t, S, sec, bar, st, sp) {
    const ch = sec.prog[bar], tn = tones(ch), root = C[ch][0], intense = player.intense && S === SONGS.battle;
    if (sec.kick === 'four' && st % 4 === 0) I.kick(t);
    if (sec.kick === 'half' && st % 8 === 0) I.kick(t);
    if (sec.snare && (st === 4 || st === 12)) I.snare(t);
    if (intense && sec.snare && st === 14) I.snare(t);
    if (sec.hat === 'off' && st % 4 === 2) I.hat(t, true);
    if ((sec.hat === 'sixteen' || intense) && st % 2 === 1) I.hat(t, false);
    if (sec.bass === 'eighths' && st % 2 === 0) I.bass(t, root - 12 + (st % 4 === 2 && intense ? 12 : 0), sp * 1.8);
    if (sec.bass === 'long' && st === 0) I.bass(t, root - 12, sp * 15);
    if (sec.pad && st === 0) I.pad(t, C[ch], sp * 16);
    if (sec.arp || intense) { const pat = [0, 1, 2, 3, 2, 1, 2, 4]; I.arp(t, tn[pat[st % 8]], sp * .9); }
    if (sec.lead != null) {
      const m = MOTIFS[sec.lead], v = m[st];
      if (v != null) {
        let len = 1; while (st + len < 16 && m[st + len] == null && len < 3) len++;
        I.lead(t, tn[v], sp * len * .95);
      }
    }
  }

  function schedule() {
    const S = SONGS[player.song];
    while (player.next < ctx.currentTime + .15) {
      // switch song at the start of a bar
      if (player.step === 0 && player.want !== player.song) { player.song = player.want; player.sec = 0; player.bar = 0; return schedule(); }
      const sec = S.sections[player.sec];
      const sp = 60 / (S.bpm * (player.intense && S === SONGS.battle ? 1.06 : 1)) / 4;
      playStep(player.next, S, sec, player.bar, player.step, sp);
      player.next += sp;
      if (++player.step === 16) {
        player.step = 0;
        if (++player.bar >= sec.prog.length) { player.bar = 0; player.sec++; if (player.sec >= S.sections.length) player.sec = S.loopFrom; }
      }
    }
  }

  function startMusic() {
    if (!ctx || player.timer) return;
    player.song = player.want; player.sec = 0; player.bar = 0; player.step = 0;
    player.next = ctx.currentTime + .08;
    player.timer = setInterval(schedule, 40);
  }
  function setSong(name) { player.want = name; }
  function setIntensity(on) { player.intense = on; }

  // ---------- sound effects ----------
  const sfx = {
    bonk(pow) {
      const t = ctx.currentTime, v = .25 + pow * .3;
      osc('sine', 180, 48, t, .22, v, sfxBus);
      osc('square', 900 + Math.random() * 300, 260, t, .09, v * .25, sfxBus, { lp: 3000 });
      noise(t, .06, 5000, 2000, 1, v * .3, 'highpass', sfxBus);
    },
    eat(k) { const f = [1046, 1175, 1319, 1568][k || 0]; osc('triangle', f, f * 1.5, ctx.currentTime, .07, .07, sfxBus); },
    dash() { const t = ctx.currentTime; noise(t, .26, 400, 3200, 2, .22, 'bandpass', sfxBus); osc('sawtooth', 180, 720, t, .16, .05, sfxBus, { lp: 2000 }); },
    splash() {
      const t = ctx.currentTime;
      osc('sawtooth', 700, 50, t, .75, .12, sfxBus, { lp: 1800, rel: .5 });
      noise(t, .6, 3000, 200, 1, .18, 'lowpass', sfxBus);
      for (let i = 0; i < 3; i++) osc('square', 2000 - i * 400, 1800 - i * 400, t + .1 + i * .06, .04, .03, sfxBus);
    },
    bump() { const t = ctx.currentTime; osc('square', 880, 880, t, .07, .05, sfxBus, { lp: 4000 }); osc('square', 1320, 1320, t + .05, .12, .05, sfxBus, { lp: 4000 }); },
    click() { osc('triangle', 1500, 1000, ctx.currentTime, .035, .08, sfxBus); },
    beep(go) { osc('square', go ? 1318 : 659, 0, ctx.currentTime, go ? .4 : .14, .07, sfxBus, { lp: 3000 }); },
    coin() { const t = ctx.currentTime; osc('square', 1568, 0, t, .07, .04, sfxBus); osc('square', 2093, 0, t + .07, .18, .04, sfxBus); },
    win() { const t = ctx.currentTime; [64, 67, 71, 76, 79].forEach((n, i) => osc('sawtooth', hz(n + 12), 0, t + i * .1, .4, .07, sfxBus, { lp: 3500, send: true })); },
    lose() { const t = ctx.currentTime; [71, 67, 64, 59].forEach((n, i) => osc('sawtooth', hz(n), hz(n) * .97, t + i * .15, .35, .07, sfxBus, { lp: 1800 })); },
  };

  // the portal can ask for silence (ad playing, tab hidden)
  let hostMuted = false;
  function setHostMute(m) { hostMuted = m; if (out) out.gain.value = m ? 0 : .9; }

  function setSfx(on) { state.sfx = on; if (sfxBus) sfxBus.gain.value = on ? 1 : 0; }
  function setMusic(on) { state.music = on; if (musicBus) musicBus.gain.value = on ? MUSIC_VOL : 0; }
  function play(name, arg) { if (ctx && state.sfx) sfx[name](arg); }

  root.Audio2 = { init, play, startMusic, setSong, setIntensity, setSfx, setMusic, setHostMute, state, SONGS };
})(this);
