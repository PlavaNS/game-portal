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
    lead(t, n, dur, kind) {
      if (kind === 'bell') {
        osc('sine', hz(n + 24), 0, t, dur * 1.6, .03, musicBus, { a: .005, rel: dur * 1.4, send: true });
        osc('sine', hz(n + 36), 0, t, dur * .5, .008, musicBus, { a: .005, rel: dur * .45 });
        return;
      }
      if (kind === 'pluck') { osc('triangle', hz(n + 12), 0, t, Math.min(dur, .3), .045, musicBus, { a: .004, lp: 1500, rel: .25, send: true }); return; }
      osc('sawtooth', hz(n + 12), 0, t, dur, .03, musicBus, { a: .04, lp: 1700, rel: dur * .5, send: true });
      osc('triangle', hz(n + 12), 0, t, dur, .03, musicBus, { a: .04, lp: 2200, rel: dur * .5, detune: 7 });
    },
  };

  // ---------- songs ----------
  // chord = triad (MIDI) around octave 3; tones for lead/arp = [root, 3rd, 5th, root+12, 3rd+12, 5th+12]
  const C = {
    Em: [52, 55, 59], C: [48, 52, 55], G: [55, 59, 62], D: [50, 54, 57], Am: [45, 48, 52], B: [47, 51, 54], F: [41, 45, 48],
    Dm: [50, 53, 57], Bb: [46, 50, 53], A: [45, 49, 52], Bm: [47, 50, 54], Cm: [48, 51, 55], Ab: [44, 48, 51], Eb: [51, 55, 58],
  };
  const MOTIFS = [
    [3, null, null, 4, null, 5, null, 4, 3, null, 2, null, 3, null, null, null],
    [5, null, 4, null, 3, null, null, 2, 3, 4, null, 5, null, null, 4, null],
    [3, null, 3, 4, 5, null, 4, 3, null, 2, null, 3, 4, null, 5, null],
    [3, null, null, null, 4, null, null, null, 5, null, null, 4, null, null, null, null],
    [5, null, null, null, 4, null, 3, null, 4, null, null, null, 2, null, null, null],
    [0, null, 2, null, 4, null, 3, null, 2, null, null, null, 1, null, null, null],
    [4, null, null, 5, null, null, 4, null, 3, null, null, null, null, null, null, null],
    [2, null, 3, null, 4, null, null, null, 5, null, 4, null, 3, null, null, null],
    [5, null, null, null, null, null, 4, null, null, null, 3, null, null, null, null, null],
    [3, 4, 5, null, 4, null, 3, null, 2, null, 3, null, null, null, null, null],
  ];
  const ARPS = { up: [0, 1, 2, 3, 2, 1, 2, 4], wave: [0, 2, 4, 2, 3, 2, 4, 5], climb: [0, 1, 2, 3, 4, 5, 4, 3], wide: [0, 3, 1, 4, 2, 5, 2, 4] };

  // Each song plays once from start to end, then the next song of the same group starts.
  // Songs differ in tempo, chords, arp pattern, lead voice and groove, so a long run never repeats one tune.
  const SONGS = {
    menu: [
      { name: 'Drift', bpm: 86, arp: 'up', leadKind: 'saw', sections: [
        { prog: ['Am', 'F', 'C', 'G'], pad: 1, arp: 1 },
        { prog: ['Am', 'F', 'C', 'G', 'Am', 'F', 'C', 'G'], pad: 1, arp: 1, bass: 'long', kick: 'half', hat: 'off' },
        { prog: ['F', 'G', 'Am', 'Am', 'F', 'G', 'C', 'G'], pad: 1, arp: 1, bass: 'eighths', kick: 'four', hat: 'off', lead: 3 },
        { prog: ['Am', 'F', 'C', 'G', 'Am', 'F', 'C', 'G'], pad: 1, bass: 'long', kick: 'half', lead: 4 },
        { prog: ['F', 'C', 'G', 'G'], pad: 1, arp: 1 },
      ] },
      { name: 'Low Tide', bpm: 78, arp: 'wave', leadKind: 'bell', sections: [
        { prog: ['F', 'C', 'Dm', 'Bb'], pad: 1 },
        { prog: ['F', 'C', 'Dm', 'Bb', 'F', 'C', 'Dm', 'Bb'], pad: 1, arp: 1, bass: 'long', lead: 8 },
        { prog: ['Dm', 'Bb', 'F', 'C', 'Dm', 'Bb', 'C', 'C'], pad: 1, arp: 1, bass: 'long', kick: 'half', lead: 6 },
        { prog: ['F', 'C', 'Dm', 'Bb'], pad: 1, arp: 1 },
      ] },
      { name: 'Orbit', bpm: 82, arp: 'climb', leadKind: 'pluck', sections: [
        { prog: ['Em', 'C', 'G', 'D'], pad: 1, arp: 1 },
        { prog: ['Em', 'C', 'G', 'D', 'Em', 'C', 'G', 'D'], pad: 1, arp: 1, bass: 'long', kick: 'half', hat: 'off', lead: 5 },
        { prog: ['C', 'D', 'Em', 'Em', 'C', 'D', 'G', 'D'], pad: 1, bass: 'long', kick: 'half', lead: 7 },
        { prog: ['Em', 'C', 'G', 'D'], pad: 1, arp: 1 },
      ] },
    ],
    battle: [
      { name: 'Neon Pulse', bpm: 108, arp: 'up', leadKind: 'saw', sections: [
        { prog: ['Em', 'C', 'G', 'D'], pad: 1, kick: 'four' },
        { prog: ['Em', 'C', 'G', 'D', 'Em', 'C', 'G', 'D'], pad: 1, kick: 'four', hat: 'off', bass: 'eighths', arp: 1 },
        { prog: ['Em', 'C', 'G', 'D', 'Em', 'C', 'G', 'D'], kick: 'four', snare: 1, hat: 'sixteen', bass: 'eighths', lead: 0 },
        { prog: ['C', 'D', 'Em', 'Em', 'Am', 'C', 'D', 'B'], pad: 1, kick: 'four', snare: 1, hat: 'sixteen', bass: 'eighths', lead: 1 },
        { prog: ['Am', 'C', 'D', 'B'], pad: 1, arp: 1, bass: 'long' },
        { prog: ['Em', 'C', 'G', 'D', 'Em', 'C', 'G', 'D'], pad: 1, kick: 'four', snare: 1, hat: 'sixteen', bass: 'eighths', arp: 1, lead: 2 },
      ] },
      { name: 'Night Drive', bpm: 102, arp: 'wave', leadKind: 'bell', sections: [
        { prog: ['Dm', 'Bb', 'F', 'C'], pad: 1, arp: 1 },
        { prog: ['Dm', 'Bb', 'F', 'C', 'Dm', 'Bb', 'F', 'C'], pad: 1, arp: 1, kick: 'broken', hat: 'off', bass: 'pulse' },
        { prog: ['Dm', 'Bb', 'F', 'C', 'Dm', 'Bb', 'F', 'C'], pad: 1, kick: 'four', snare: 1, hat: 'sixteen', bass: 'pulse', lead: 5 },
        { prog: ['Bb', 'C', 'Dm', 'Dm', 'Bb', 'C', 'A', 'A'], pad: 1, arp: 1, kick: 'half', bass: 'long', lead: 8 },
        { prog: ['Dm', 'Bb', 'F', 'C', 'Dm', 'Bb', 'F', 'C'], pad: 1, arp: 1, kick: 'four', snare: 1, hat: 'sixteen', bass: 'pulse', lead: 7 },
        { prog: ['Dm', 'Bb', 'C', 'C'], pad: 1 },
      ] },
      { name: 'Glass City', bpm: 112, arp: 'climb', leadKind: 'pluck', sections: [
        { prog: ['Am', 'Em', 'F', 'G'], arp: 1, hat: 'off' },
        { prog: ['Am', 'Em', 'F', 'G', 'Am', 'Em', 'F', 'G'], pad: 1, arp: 1, kick: 'four', hat: 'off', bass: 'eighths' },
        { prog: ['Am', 'Em', 'F', 'G', 'Am', 'Em', 'F', 'G'], kick: 'four', snare: 1, hat: 'sixteen', bass: 'eighths', lead: 9 },
        { prog: ['F', 'G', 'Am', 'Am', 'F', 'G', 'C', 'G'], pad: 1, kick: 'broken', bass: 'pulse', arp: 1 },
        { prog: ['Am', 'Em', 'F', 'G', 'Am', 'Em', 'F', 'G'], pad: 1, kick: 'four', snare: 1, hat: 'sixteen', bass: 'eighths', arp: 1, lead: 2 },
      ] },
      { name: 'Slow Burn', bpm: 96, arp: 'wide', leadKind: 'saw', sections: [
        { prog: ['Em', 'Bm', 'C', 'D'], pad: 1 },
        { prog: ['Em', 'Bm', 'C', 'D', 'Em', 'Bm', 'C', 'D'], pad: 1, kick: 'half', snare: 'half', hat: 'off', bass: 'long', lead: 3 },
        { prog: ['Em', 'Bm', 'C', 'D', 'Em', 'Bm', 'C', 'D'], pad: 1, arp: 1, kick: 'broken', snare: 'half', hat: 'sixteen', bass: 'pulse', lead: 6 },
        { prog: ['C', 'D', 'Bm', 'Em', 'C', 'D', 'B', 'B'], pad: 1, arp: 1, bass: 'long' },
        { prog: ['Em', 'Bm', 'C', 'D', 'Em', 'Bm', 'C', 'D'], pad: 1, arp: 1, kick: 'four', snare: 1, hat: 'sixteen', bass: 'eighths', lead: 4 },
      ] },
      { name: 'Starfall', bpm: 116, arp: 'up', leadKind: 'bell', sections: [
        { prog: ['Bm', 'G', 'D', 'A'], pad: 1, arp: 1 },
        { prog: ['Bm', 'G', 'D', 'A', 'Bm', 'G', 'D', 'A'], pad: 1, arp: 1, kick: 'four', hat: 'off', bass: 'eighths' },
        { prog: ['Bm', 'G', 'D', 'A', 'Bm', 'G', 'D', 'A'], kick: 'four', snare: 1, hat: 'sixteen', bass: 'eighths', lead: 0 },
        { prog: ['G', 'A', 'Bm', 'Bm', 'G', 'A', 'D', 'A'], pad: 1, kick: 'half', bass: 'long', lead: 8 },
        { prog: ['Bm', 'G', 'D', 'A', 'Bm', 'G', 'D', 'A'], pad: 1, arp: 1, kick: 'four', snare: 1, hat: 'sixteen', bass: 'eighths', lead: 9 },
      ] },
      { name: 'Deep Space', bpm: 104, arp: 'wave', leadKind: 'pluck', sections: [
        { prog: ['Cm', 'Ab', 'Eb', 'Bb'], pad: 1 },
        { prog: ['Cm', 'Ab', 'Eb', 'Bb', 'Cm', 'Ab', 'Eb', 'Bb'], pad: 1, arp: 1, kick: 'broken', hat: 'off', bass: 'pulse' },
        { prog: ['Cm', 'Ab', 'Eb', 'Bb', 'Cm', 'Ab', 'Eb', 'Bb'], pad: 1, kick: 'four', snare: 1, hat: 'sixteen', bass: 'pulse', lead: 7 },
        { prog: ['Ab', 'Bb', 'Cm', 'Cm', 'Ab', 'Bb', 'Eb', 'Bb'], pad: 1, arp: 1, bass: 'long', lead: 5 },
        { prog: ['Cm', 'Ab', 'Eb', 'Bb', 'Cm', 'Ab', 'Eb', 'Bb'], pad: 1, arp: 1, kick: 'four', snare: 1, hat: 'sixteen', bass: 'eighths', lead: 1 },
      ] },
    ],
  };

  // group = 'menu' or 'battle'; each group remembers which song is next, so every run starts a new tune
  const player = { group: null, want: 'menu', idx: { menu: 0, battle: Math.floor(Math.random() * SONGS.battle.length) }, sec: 0, bar: 0, step: 0, next: 0, timer: null, intense: false };

  function tones(ch) { const c = C[ch]; return [c[0], c[1], c[2], c[0] + 12, c[1] + 12, c[2] + 12]; }

  function playStep(t, S, sec, bar, st, sp) {
    const ch = sec.prog[bar], tn = tones(ch), root = C[ch][0], intense = player.intense && player.group === 'battle';
    if (sec.kick === 'four' && st % 4 === 0) I.kick(t);
    if (sec.kick === 'half' && st % 8 === 0) I.kick(t);
    if (sec.kick === 'broken' && (st === 0 || st === 6 || st === 10)) I.kick(t);
    if (sec.snare === 1 && (st === 4 || st === 12)) I.snare(t);
    if (sec.snare === 'half' && st === 8) I.snare(t);
    if (intense && sec.snare && st === 14) I.snare(t);
    if (sec.hat === 'off' && st % 4 === 2) I.hat(t, true);
    if ((sec.hat === 'sixteen' || intense) && st % 2 === 1) I.hat(t, false);
    if (sec.bass === 'eighths' && st % 2 === 0) I.bass(t, root - 12 + (st % 4 === 2 && intense ? 12 : 0), sp * 1.8);
    if (sec.bass === 'pulse' && [0, 3, 6, 10, 12].includes(st)) I.bass(t, root - 12 + (st === 10 ? 7 : 0), sp * 2.4);
    if (sec.bass === 'long' && st === 0) I.bass(t, root - 12, sp * 15);
    if (sec.pad && st === 0) I.pad(t, C[ch], sp * 16);
    if (sec.arp || intense) { const pat = ARPS[S.arp]; I.arp(t, tn[pat[st % 8]], sp * .9); }
    if (sec.lead != null) {
      const m = MOTIFS[sec.lead], v = m[st];
      if (v != null) {
        let len = 1; while (st + len < 16 && m[st + len] == null && len < 3) len++;
        I.lead(t, tn[v], sp * len * .95, S.leadKind);
      }
    }
  }

  function schedule() {
    while (player.next < ctx.currentTime + .15) {
      // switch group at the start of a bar; the new group continues with its next song
      if (player.step === 0 && (player.want !== player.group || player.restart)) { player.group = player.want; player.sec = 0; player.bar = 0; player.restart = false; }
      const S = SONGS[player.group][player.idx[player.group]];
      const sec = S.sections[player.sec];
      const sp = 60 / (S.bpm * (player.intense && player.group === 'battle' ? 1.06 : 1)) / 4;
      playStep(player.next, S, sec, player.bar, player.step, sp);
      player.next += sp;
      if (++player.step === 16) {
        player.step = 0;
        if (++player.bar >= sec.prog.length) {
          player.bar = 0;
          if (++player.sec >= S.sections.length) { player.sec = 0; player.idx[player.group] = (player.idx[player.group] + 1) % SONGS[player.group].length; }
        }
      }
    }
  }

  function startMusic() {
    if (!ctx || player.timer) return;
    player.group = player.want; player.sec = 0; player.bar = 0; player.step = 0;
    player.next = ctx.currentTime + .08;
    player.timer = setInterval(schedule, 40);
  }
  function setSong(name) {
    // leaving a group mid-song: next time it comes back, start its following song
    if (name !== player.want && player.group === player.want && player.sec > 0) player.idx[player.want] = (player.idx[player.want] + 1) % SONGS[player.want].length;
    player.want = name;
  }
  // each arena has its own battle song; it starts at the next bar
  function playTrack(group, i) { player.want = group; player.idx[group] = i % SONGS[group].length; player.restart = true; }
  function setIntensity(on) { player.intense = on; }

  // ---------- sound effects ----------
  const sfx = {
    bonk(pow) {
      const t = ctx.currentTime, v = .25 + pow * .3;
      osc('sine', 180, 48, t, .22, v, sfxBus);
      osc('sine', 95, 38, t, .3, v * .7, sfxBus);
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
    // new wave: rising whoosh and three climbing notes
    wave() {
      const t = ctx.currentTime;
      noise(t, .9, 300, 5000, 1.5, .12, 'bandpass', sfxBus);
      [55, 59, 62].forEach((n, i) => osc('sawtooth', hz(n + 12), 0, t + .25 + i * .14, .3, .05, sfxBus, { lp: 2500, send: true }));
      osc('sine', 60, 40, t + .7, .5, .25, sfxBus);
    },
    // wave cleared: bright fanfare chord
    clear() {
      const t = ctx.currentTime;
      [64, 68, 71, 76].forEach((n, i) => osc('sawtooth', hz(n + 12), 0, t + i * .08, .5, .055, sfxBus, { lp: 3500, send: true }));
      [64, 68, 71].forEach(n => osc('triangle', hz(n), 0, t + .35, .9, .06, sfxBus, { a: .03 }));
      noise(t + .35, .5, 6000, 9000, 1, .05, 'highpass', sfxBus);
    },
    perk() { const t = ctx.currentTime; [88, 92, 95, 100].forEach((n, i) => osc('triangle', hz(n), 0, t + i * .05, .18, .05, sfxBus)); },
    over() {
      const t = ctx.currentTime;
      [67, 63, 60, 55].forEach((n, i) => osc('sawtooth', hz(n), hz(n) * .96, t + i * .18, .4, .065, sfxBus, { lp: 1600 }));
      osc('sine', 80, 30, t + .7, .7, .3, sfxBus);
    },
    ko() { const t = ctx.currentTime; osc('sine', 140, 32, t, .5, .32, sfxBus); noise(t, .35, 2500, 300, .8, .12, 'lowpass', sfxBus); },
    win() { const t = ctx.currentTime; [64, 67, 71, 76, 79].forEach((n, i) => osc('sawtooth', hz(n + 12), 0, t + i * .1, .4, .07, sfxBus, { lp: 3500, send: true })); },
    lose() { const t = ctx.currentTime; [71, 67, 64, 59].forEach((n, i) => osc('sawtooth', hz(n), hz(n) * .97, t + i * .15, .35, .07, sfxBus, { lp: 1800 })); },
  };

  // the portal can ask for silence (ad playing, tab hidden)
  let hostMuted = false;
  function setHostMute(m) { hostMuted = m; if (out) out.gain.value = m ? 0 : .9; }

  // ---------- creature voices ----------
  // Tiny synthesized critter voices: a buzzy source shaped by two vowel filters, with a pitch curve.
  // base = the orb's own pitch (small orbs squeak, big ones grumble), so every orb sounds like itself.
  const VOWEL = { a: [850, 1250], e: [520, 1900], i: [330, 2400], o: [520, 900], u: [340, 760] };
  let voicesNow = 0;
  function syllable(t, f0, f1, dur, vowel, vol) {
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), lfo = ctx.createOscillator(), lg = ctx.createGain();
    o.type = 'sawtooth'; o2.type = 'triangle';
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    o2.frequency.setValueAtTime(f0 * 2, t); o2.frequency.exponentialRampToValueAtTime(f1 * 2, t + dur);
    lfo.frequency.value = 28; lg.gain.value = f0 * .03; lfo.connect(lg); lg.connect(o.frequency); lg.connect(o2.frequency);
    const [F1, F2] = VOWEL[vowel];
    const b1 = ctx.createBiquadFilter(), b2 = ctx.createBiquadFilter();
    b1.type = b2.type = 'bandpass'; b1.frequency.value = F1; b2.frequency.value = F2; b1.Q.value = 5; b2.Q.value = 7;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + .015);
    g.gain.setValueAtTime(vol, t + dur * .6); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const mix = ctx.createGain(); mix.gain.value = .5;
    o.connect(b1); o.connect(b2); o2.connect(mix); mix.connect(b1);
    b1.connect(g); b2.connect(g); g.connect(sfxBus);
    for (const n of [o, o2, lfo]) { n.start(t); n.stop(t + dur + .05); }
  }
  const pick = a => a[(Math.random() * a.length) | 0];
  const VOICES = {
    hup: (t, f, v) => syllable(t, f * .9, f * 1.35, .12, pick(['u', 'a']), v),
    oof: (t, f, v) => syllable(t, f * 1.1, f * .7, .16, pick(['o', 'u']), v),
    eep: (t, f, v) => syllable(t, f * 1.4, f * 1.9, .1, 'i', v),
    dizzy: (t, f, v) => { for (let i = 0; i < 3; i++) syllable(t + i * .09, f * (1.1 - i * .12), f * (1.25 - i * .12), .08, pick(['u', 'o']), v * .8); },
    scream: (t, f, v) => syllable(t, f * 1.5, f * .45, .7, pick(['a', 'i', 'e']), v),
    giggle: (t, f, v) => { for (let i = 0; i < 3; i++) syllable(t + i * .085, f * (1.3 + (i % 2) * .15), f * (1.45 + (i % 2) * .15), .065, pick(['e', 'i']), v * .85); },
    // a cute little laugh: a breathy "hee-hee-hee-hee" that tumbles down, then one happy squeak
    laugh: (t, f, v) => {
      const n = 4 + (Math.random() * 2 | 0), top = 1.75 + Math.random() * .2;
      for (let i = 0; i < n; i++) {
        const p = f * (top - i * .1), tt = t + i * .105;
        noise(tt, .035, 3200, 2600, 1.2, v * .35, 'bandpass', sfxBus);
        syllable(tt + .012, p, p * 1.12, .07, i % 2 ? 'e' : 'i', v * (1 - i * .08));
      }
      syllable(t + n * .105 + .04, f * 1.5, f * 2.05, .12, 'i', v * .8);
    },
    ooh: (t, f, v) => syllable(t, f * .9, f * 1.5, .3, 'o', v),
    yay: (t, f, v) => { syllable(t, f * 1.1, f * 1.6, .14, 'a', v); syllable(t + .16, f * 1.5, f * 1.9, .22, 'e', v); },
    nom: (t, f, v) => syllable(t, f, f * .9, .07, 'o', v * .6),
    chatter: (t, f, v) => { const n = 2 + (Math.random() * 3 | 0); for (let i = 0; i < n; i++) { const p = f * (.85 + Math.random() * .4); syllable(t + i * .11, p, p * (.9 + Math.random() * .3), .08, pick(['a', 'e', 'i', 'o', 'u']), v * .7); } },
  };
  // vol 0..1 relative; skipped when too many voices overlap, so it never turns into noise
  function voice(kind, base, vol, force) {
    if (!ctx || !state.sfx || (voicesNow >= 3 && !force)) return;
    voicesNow++; setTimeout(() => voicesNow--, 300);
    VOICES[kind](ctx.currentTime + .01, base, .13 * (vol == null ? 1 : vol));
  }

  function setSfx(on) { state.sfx = on; if (sfxBus) sfxBus.gain.value = on ? 1 : 0; }
  function setMusic(on) { state.music = on; if (musicBus) musicBus.gain.value = on ? MUSIC_VOL : 0; }
  function play(name, arg) { if (ctx && state.sfx) sfx[name](arg); }

  root.Audio2 = { init, play, voice, startMusic, setSong, playTrack, setIntensity, setSfx, setMusic, setHostMute, state, SONGS };
})(this);
