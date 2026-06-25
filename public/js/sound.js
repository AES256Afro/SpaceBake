/* SpaceBake — procedural audio. All sound is synthesized live with the Web Audio
 * API: no asset files, no dependencies. SFX are short oscillator/noise envelopes;
 * music is a slow generative chord pad. Audio can't start without a user gesture
 * (browser autoplay policy), so the context is created/resumed on first interaction.
 */
const Sound = (() => {
  let ctx = null, master = null, musicGain = null, musicTimer = null, chordIdx = 0;
  let sfxOn = localStorage.getItem('spacebake.sfx') !== 'off';   // default on
  let musicOn = localStorage.getItem('spacebake.music') === 'on'; // default off
  let masterVol = 0.32, musicVolAmt = 0.5;                        // tuned by Settings

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try {
        ctx = new AC();
        master = ctx.createGain(); master.gain.value = masterVol; master.connect(ctx.destination);
      } catch (e) { ctx = null; }
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function setMasterVolume(v) { masterVol = Math.max(0, Math.min(1, v)); if (master) master.gain.value = masterVol; }
  function setMusicVolume(v) { musicVolAmt = Math.max(0, Math.min(1, v)); if (musicGain) musicGain.gain.value = musicVolAmt; }

  // ---- low-level voices ----
  function tone(freq, dur, type, vol, when, dest) {
    const t = ctx.currentTime + (when || 0);
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'sine'; o.frequency.value = freq;
    o.connect(g); g.connect(dest || master);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t); o.stop(t + dur + 0.03);
  }
  function glide(f1, f2, dur, type, vol, when) {
    const t = ctx.currentTime + (when || 0);
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(f1, t);
    o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    o.connect(g); g.connect(master);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t); o.stop(t + dur + 0.03);
  }
  function noise(dur, vol, cutoff, when) {
    const t = ctx.currentTime + (when || 0);
    const n = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff || 1200;
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t); src.stop(t + dur);
  }

  // ---- the SFX kit ----
  const KIT = {
    click() { tone(620, 0.05, 'square', 0.05); },
    confirm() { tone(540, 0.07, 'triangle', 0.12); tone(720, 0.09, 'triangle', 0.1, 0.05); },
    error() { tone(180, 0.16, 'sawtooth', 0.16); tone(120, 0.2, 'sawtooth', 0.12, 0.04); },
    launch() { glide(180, 540, 0.35, 'sawtooth', 0.12); noise(0.35, 0.06, 900); },
    coin() { tone(900, 0.06, 'square', 0.1); tone(1350, 0.1, 'square', 0.09, 0.05); },
    scan() { glide(400, 1400, 0.5, 'sine', 0.08); },
    return() { tone(523, 0.09, 'triangle', 0.12); tone(784, 0.12, 'triangle', 0.11, 0.07); },
    fanfare() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.3, 'triangle', 0.13, i * 0.08)); },
  };

  function play(name) {
    if (!sfxOn || !name) return;
    if (!ensure()) return;
    (KIT[name] || (() => {}))();
  }

  // ---- generative ambient music: slow drifting chord pads ----
  const CHORDS = [[196, 247, 294], [220, 277, 330], [174, 220, 261], [247, 311, 370]];
  function padChord() {
    if (!musicOn || !ctx || !musicGain) return;
    const c = CHORDS[chordIdx++ % CHORDS.length];
    const t = ctx.currentTime;
    for (const base of c) {
      for (const f of [base, base * 2]) {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine'; o.frequency.value = f;
        o.connect(g); g.connect(musicGain);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.10, t + 2.2);     // slow swell
        g.gain.linearRampToValueAtTime(0.0001, t + 7.5);   // long fade
        o.start(t); o.stop(t + 7.6);
      }
    }
  }
  function startMusic() {
    if (!ensure()) return;
    if (!musicGain) {
      musicGain = ctx.createGain(); musicGain.gain.value = musicVolAmt;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
      musicGain.connect(lp); lp.connect(master);
    }
    if (musicTimer) return;
    padChord();
    musicTimer = setInterval(padChord, 6000);
  }
  function stopMusic() { if (musicTimer) { clearInterval(musicTimer); musicTimer = null; } }

  function setSfx(on) { sfxOn = on; localStorage.setItem('spacebake.sfx', on ? 'on' : 'off'); if (on) play('click'); }
  function setMusic(on) { musicOn = on; localStorage.setItem('spacebake.music', on ? 'on' : 'off'); if (on) startMusic(); else stopMusic(); }

  return {
    play, resume: ensure, startMusic, stopMusic,
    setSfx, setMusic, isSfx: () => sfxOn, isMusic: () => musicOn,
    setMasterVolume, setMusicVolume,
  };
})();
