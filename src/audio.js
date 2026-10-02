// All sound is synthesized: no audio files to load.
// Speech uses the browser's built-in speechSynthesis (voices vary by OS).

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);

export class Sound {
  constructor() {
    this.ctx = null;
    this.settings = { music: true, sfx: true, voice: true };
    try { Object.assign(this.settings, JSON.parse(localStorage.getItem('pardon-me-audio') || '{}')); } catch { /* storage unavailable */ }
    this.voices = [];
    this.musicOn = false;
    this.step = 0;
    this.urgent = false;
    if ('speechSynthesis' in window) {
      const load = () => { this.voices = speechSynthesis.getVoices().filter((v) => /^en(-|_|$)/i.test(v.lang)); };
      load(); speechSynthesis.addEventListener?.('voiceschanged', load);
    }
  }

  save() { try { localStorage.setItem('pardon-me-audio', JSON.stringify(this.settings)); } catch { /* ignore */ } }

  init() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain(); this.master.gain.value = 0.8; this.master.connect(ctx.destination);
    this.sfx = ctx.createGain(); this.sfx.connect(this.master);
    this.musicBus = ctx.createGain(); this.musicBus.connect(this.master);
    this.ambBus = ctx.createGain(); this.ambBus.connect(this.master);
    this.applySettings();
    // shared noise buffer
    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = w; }
    this.brown = ctx.createBuffer(1, len, ctx.sampleRate);
    const b = this.brown.getChannelData(0); last = 0;
    for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; b[i] = last * 3.5; }
    this.startAmbience();
  }

  applySettings() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.sfx.gain.setTargetAtTime(this.settings.sfx ? 1 : 0, t, 0.05);
    this.ambBus.gain.setTargetAtTime(this.settings.sfx ? 1 : 0, t, 0.05);
    this.musicBus.gain.setTargetAtTime(this.settings.music ? 0.55 : 0, t, 0.1);
    if (!this.settings.voice) speechSynthesis?.cancel();
  }

  toggle(key) { this.settings[key] = !this.settings[key]; this.save(); this.applySettings(); return this.settings[key]; }

  // ---------- primitives ----------
  tone({ freq, type = 'sine', dur = 0.15, vol = 0.2, at = 0, slide = 0, attack = 0.005, bus, filter }) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime + at;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = o;
    if (filter) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filter; o.connect(f); node = f; }
    node.connect(g); g.connect(bus || this.sfx);
    o.start(t); o.stop(t + dur + 0.05);
  }

  noiseHit({ dur = 0.08, vol = 0.2, freq = 1200, q = 1, at = 0, type = 'bandpass', bus }) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime + at;
    const s = ctx.createBufferSource(); s.buffer = this.noise;
    s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(bus || this.sfx);
    s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.02);
  }

  // ---------- game sounds ----------
  footstep(hurry) { this.noiseHit({ dur: 0.06, vol: hurry ? 0.11 : 0.07, freq: 900 + Math.random() * 500, q: 2.5 }); }

  bump(big) {
    this.tone({ freq: big ? 110 : 150, type: 'sine', dur: 0.25, vol: 0.5, slide: 0.5 });
    this.noiseHit({ dur: 0.12, vol: 0.35, freq: 500, q: 0.8 });
    // cartoon boing
    this.tone({ freq: 320, type: 'triangle', dur: 0.45, vol: 0.16, at: 0.04, slide: 2.2 });
  }

  sting() {
    // "dun-DUN": someone has locked on
    this.tone({ freq: NOTE(45), type: 'sawtooth', dur: 0.22, vol: 0.13, filter: 900 });
    this.tone({ freq: NOTE(44), type: 'sawtooth', dur: 0.5, vol: 0.16, at: 0.2, filter: 900 });
  }

  dodge() {
    this.tone({ freq: NOTE(76), type: 'triangle', dur: 0.12, vol: 0.12 });
    this.tone({ freq: NOTE(83), type: 'triangle', dur: 0.2, vol: 0.12, at: 0.08 });
  }

  honk() {
    for (const [f, at] of [[392, 0], [494, 0], [392, 0.22], [494, 0.22]]) this.tone({ freq: f, type: 'square', dur: 0.18, vol: 0.07, at, filter: 1800 });
  }

  jump() { this.tone({ freq: 300, type: 'square', dur: 0.18, vol: 0.06, slide: 2.4, filter: 2500 }); }

  tick() { this.tone({ freq: 1600, type: 'square', dur: 0.04, vol: 0.05 }); }

  win() {
    [72, 76, 79, 84].forEach((n, i) => this.tone({ freq: NOTE(n), type: 'triangle', dur: 0.35, vol: 0.18, at: i * 0.12 }));
    this.tone({ freq: NOTE(88), type: 'sine', dur: 0.8, vol: 0.12, at: 0.5 });
  }

  lose() {
    [67, 66, 65, 64].forEach((n, i) => this.tone({ freq: NOTE(n - 12), type: 'sawtooth', dur: 0.45, vol: 0.12, at: i * 0.32, filter: 1200, slide: i === 3 ? 0.7 : 1 }));
  }

  ui() { this.tone({ freq: 660, type: 'triangle', dur: 0.08, vol: 0.1 }); }

  // ---------- ambience ----------
  startAmbience() {
    const ctx = this.ctx;
    const s = ctx.createBufferSource(); s.buffer = this.brown; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 380;
    const g = ctx.createGain(); g.gain.value = 0.05;
    s.connect(f); f.connect(g); g.connect(this.ambBus); s.start();
    const chirp = () => {
      if (this.ctx.state === 'running' && Math.random() < 0.7) {
        const base = 2400 + Math.random() * 1600, n = 2 + ((Math.random() * 3) | 0);
        for (let i = 0; i < n; i++) this.tone({ freq: base, type: 'sine', dur: 0.08, vol: 0.025, at: i * 0.11, slide: 1.3 + Math.random() * 0.3, bus: this.ambBus });
      }
      setTimeout(chirp, 1500 + Math.random() * 4000);
    };
    setTimeout(chirp, 2000);
  }

  // ---------- music: a jaunty little loop ----------
  startMusic() {
    if (!this.ctx || this.musicOn) return;
    this.musicOn = true;
    this.nextTime = this.ctx.currentTime + 0.1;
    this.step = 0;
    const tick = () => {
      if (!this.musicOn) return;
      while (this.nextTime < this.ctx.currentTime + 0.25) { this.playStep(this.step, this.nextTime); this.step++; this.nextTime += this.stepDur(); }
      this.musicTimer = setTimeout(tick, 60);
    };
    tick();
  }
  stopMusic() { this.musicOn = false; clearTimeout(this.musicTimer); }
  stepDur() { const bpm = this.urgent ? 150 : 124; return 60 / bpm / 2; } // eighth notes

  playStep(step, t) {
    const at = t - this.ctx.currentTime;
    const bar = Math.floor(step / 8) % 8, s = step % 8;
    // I - vi - IV - V, twice, with a turnaround
    const chords = [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62], [60, 64, 67], [57, 60, 64], [53, 57, 62], [55, 59, 65]];
    const ch = chords[bar];
    const bus = this.musicBus;
    // bass: root on 1 and 5, walking up on 7
    if (s === 0 || s === 4) this.tone({ freq: NOTE(ch[0] - 24), type: 'triangle', dur: 0.28, vol: 0.32, at, bus });
    if (s === 6) this.tone({ freq: NOTE(ch[0] - 22), type: 'triangle', dur: 0.15, vol: 0.22, at, bus });
    // off-beat plucky chords
    if (s % 2 === 1) ch.forEach((n) => this.tone({ freq: NOTE(n), type: 'square', dur: 0.09, vol: 0.025, at, bus, filter: 2200 }));
    // melody: simple bouncy pattern derived from the chord
    const mel = [ch[2] + 12, null, ch[1] + 12, ch[2] + 12, null, ch[0] + 12, ch[1] + 12, null];
    const m = (bar === 3 || bar === 7) ? [ch[0] + 12, ch[1] + 12, ch[2] + 12, null, ch[2] + 14, null, ch[2] + 12, null][s] : mel[s];
    if (m && (bar % 2 === 0 || s < 5)) this.tone({ freq: NOTE(m), type: 'triangle', dur: 0.16, vol: 0.07, at, bus });
    // brushy hat
    if (s % 2 === 1) this.noiseHit({ dur: 0.03, vol: 0.04, freq: 7000, q: 1, at, type: 'highpass', bus });
  }

  // ---------- speech ----------
  speak(text, { pitch = 1, rate = 1.05, voiceIndex = 0, interrupt = true } = {}) {
    if (!this.settings.voice || !('speechSynthesis' in window)) return;
    try {
      if (interrupt) speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text.replace(/\.\.\./g, ','));
      if (this.voices.length) u.voice = this.voices[Math.abs(voiceIndex) % this.voices.length];
      u.pitch = pitch; u.rate = rate; u.volume = 0.9;
      speechSynthesis.speak(u);
    } catch { /* speech unavailable */ }
  }
}
