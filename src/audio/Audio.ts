import { mulberry32 } from '../core/math';

/** All audio is synthesised at runtime (original compositions, no samples):
 *  a small step sequencer plays region themes with cross-fades, plus procedural SFX and ambience. */
type Theme = 'title' | 'meadow' | 'forest' | 'beach' | 'village' | 'mountain' | 'dungeon' | 'boss' | 'temple' | 'none';
interface ThemeDef { bpm: number; root: number; scale: number[]; prog: number[][]; lead: OscillatorType; pad: OscillatorType; seed: number; swing: number; drums: number; leadOct: number; bright: number; }
const MAJ = [0, 2, 4, 5, 7, 9, 11], MIN = [0, 2, 3, 5, 7, 8, 10], DOR = [0, 2, 3, 5, 7, 9, 10], LYD = [0, 2, 4, 6, 7, 9, 11], MIX = [0, 2, 4, 5, 7, 9, 10];
const THEMES: Record<Exclude<Theme, 'none'>, ThemeDef> = {
  title:    { bpm: 84, root: 60, scale: LYD, prog: [[0, 2, 4], [3, 5, 0], [5, 0, 2], [4, 6, 1]], lead: 'triangle', pad: 'sine', seed: 11, swing: 0, drums: 0, leadOct: 1, bright: 0.7 },
  meadow:   { bpm: 112, root: 62, scale: MAJ, prog: [[0, 2, 4], [4, 6, 1], [5, 0, 2], [3, 5, 0]], lead: 'square', pad: 'triangle', seed: 23, swing: 0.12, drums: 1, leadOct: 1, bright: 0.5 },
  village:  { bpm: 96, root: 65, scale: MAJ, prog: [[0, 2, 4], [3, 5, 0], [1, 3, 5], [4, 6, 1]], lead: 'triangle', pad: 'triangle', seed: 37, swing: 0.2, drums: 0.6, leadOct: 1, bright: 0.6 },
  forest:   { bpm: 92, root: 57, scale: DOR, prog: [[0, 2, 4], [6, 1, 3], [3, 5, 0], [4, 6, 1]], lead: 'triangle', pad: 'sawtooth', seed: 41, swing: 0.15, drums: 0.5, leadOct: 1, bright: 0.35 },
  beach:    { bpm: 104, root: 64, scale: MIX, prog: [[0, 2, 4], [6, 1, 3], [3, 5, 0], [0, 2, 4]], lead: 'square', pad: 'sine', seed: 53, swing: 0.25, drums: 0.8, leadOct: 1, bright: 0.55 },
  mountain: { bpm: 100, root: 59, scale: DOR, prog: [[0, 2, 4], [3, 5, 0], [6, 1, 3], [4, 6, 1]], lead: 'sawtooth', pad: 'triangle', seed: 67, swing: 0, drums: 0.7, leadOct: 1, bright: 0.3 },
  temple:   { bpm: 72, root: 63, scale: LYD, prog: [[0, 2, 4], [1, 3, 5], [4, 6, 1], [0, 2, 4]], lead: 'sine', pad: 'sine', seed: 71, swing: 0, drums: 0, leadOct: 2, bright: 0.8 },
  dungeon:  { bpm: 80, root: 55, scale: MIN, prog: [[0, 2, 4], [5, 0, 2], [3, 5, 0], [4, 6, 1]], lead: 'triangle', pad: 'sawtooth', seed: 83, swing: 0, drums: 0.4, leadOct: 1, bright: 0.25 },
  boss:     { bpm: 148, root: 52, scale: MIN, prog: [[0, 2, 4], [5, 0, 2], [6, 1, 3], [4, 6, 1]], lead: 'sawtooth', pad: 'square', seed: 97, swing: 0, drums: 1.2, leadOct: 1, bright: 0.35 },
};
const SFX_BOOST = 2.0;
const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

class Track {
  out: GainNode; private step = 0; private nextT = 0; private melody: (number | null)[] = []; private bass: number[] = [];
  constructor(private ctx: AudioContext, dest: AudioNode, private th: ThemeDef, private noise: AudioBuffer) {
    this.out = ctx.createGain(); this.out.gain.value = 0; this.out.connect(dest);
    // compose: 4 bars x 16 steps, motif-based melody (seeded => stable, original)
    const r = mulberry32(th.seed);
    const motif: (number | null)[] = [];
    for (let i = 0; i < 8; i++) motif.push(r() < 0.22 ? null : Math.floor(r() * 5) - 1);
    for (let bar = 0; bar < 4; bar++) {
      const chord = th.prog[bar];
      for (let s = 0; s < 16; s++) {
        let n: number | null = null;
        const mi = s % 8;
        if (s % 2 === 0 || r() < 0.18) {
          const m = motif[mi];
          if (m !== null) n = chord[(Math.abs(m) + (bar === 3 && s > 11 ? 0 : (s >> 3))) % 3] + (m < 0 ? -7 : 0) + (r() < 0.15 ? 1 : 0);
        }
        if (bar % 2 === 1 && s >= 12) n = s === 12 ? chord[0] : null;
        this.melody.push(n);
      }
      this.bass.push(chord[0]);
    }
    this.nextT = ctx.currentTime + 0.05;
  }
  private deg(d: number, oct = 0) { const sc = this.th.scale; const o = Math.floor(d / 7); const i = ((d % 7) + 7) % 7; return this.th.root + sc[i] + 12 * (o + oct); }
  private note(t: number, f: number, dur: number, type: OscillatorType, vol: number, attack = 0.01, cutoff = 4000, vib = 0) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain(), fl = c.createBiquadFilter();
    o.type = type; o.frequency.value = f;
    if (vib) { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = 5.5; lg.gain.value = vib; l.connect(lg).connect(o.frequency); l.start(t); l.stop(t + dur + 0.2); }
    fl.type = 'lowpass'; fl.frequency.value = cutoff;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(vol * 0.5, t + dur * 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(fl).connect(g).connect(this.out); o.start(t); o.stop(t + dur + 0.05);
  }
  private drum(t: number, kind: 'kick' | 'hat' | 'snare', vol: number) {
    const c = this.ctx;
    if (kind === 'kick') {
      const o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18); o.connect(g).connect(this.out); o.start(t); o.stop(t + 0.2);
    } else {
      const s = c.createBufferSource(); s.buffer = this.noise; const f = c.createBiquadFilter(), g = c.createGain();
      f.type = kind === 'hat' ? 'highpass' : 'bandpass'; f.frequency.value = kind === 'hat' ? 7000 : 1800;
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + (kind === 'hat' ? 0.04 : 0.14));
      s.connect(f).connect(g).connect(this.out); s.start(t); s.stop(t + 0.2);
    }
  }
  schedule() {
    const c = this.ctx, th = this.th, spb = 60 / th.bpm / 4;
    while (this.nextT < c.currentTime + 0.25) {
      const s = this.step % 64, bar = Math.floor(s / 16), inBar = s % 16;
      const sw = inBar % 2 === 1 ? th.swing * spb : 0;
      const t = this.nextT + sw;
      const chord = th.prog[bar];
      // pad on each bar
      if (inBar === 0) for (const d of chord) this.note(t, mtof(this.deg(d, 0)), spb * 16, th.pad, 0.028, 0.35, 900 + th.bright * 1200);
      // bass
      if (inBar % 4 === 0) this.note(t, mtof(this.deg(chord[0], -1)), spb * 3.5, 'sine', 0.11, 0.01, 600);
      if (th.drums > 0 && inBar === 10) this.note(t, mtof(this.deg(chord[2], -1)), spb * 1.5, 'sine', 0.07, 0.01, 600);
      // arpeggio pluck
      if (inBar % 2 === 0) this.note(t, mtof(this.deg(chord[(inBar / 2) % 3], 1)), spb * 1.6, 'triangle', 0.03, 0.005, 2400);
      // melody
      const m = this.melody[s];
      if (m !== null && m !== undefined) this.note(t, mtof(this.deg(m, th.leadOct)), spb * 2.2, th.lead, th.lead === 'square' || th.lead === 'sawtooth' ? 0.035 : 0.06, 0.01, 1600 + th.bright * 3000, 4);
      // drums
      if (th.drums > 0) {
        if (inBar % 8 === 0) this.drum(t, 'kick', 0.32 * th.drums);
        if (inBar % 8 === 4) this.drum(t, 'snare', 0.12 * th.drums);
        if (inBar % 2 === 0) this.drum(t, 'hat', 0.05 * th.drums);
      }
      this.nextT += spb; this.step++;
    }
  }
  stop() { this.out.disconnect(); }
}

export class AudioSystem {
  ctx: AudioContext | null = null;
  private master!: GainNode; private music!: GainNode; private sfxBus!: GainNode; private ambBus!: GainNode;
  private noise!: AudioBuffer;
  private tracks: { tr: Track; theme: Theme }[] = [];
  private cur: Theme = 'none';
  private wind?: { g: GainNode; f: BiquadFilterNode }; private waves?: { g: GainNode };
  musicVol = 0.6; sfxVol = 0.8;
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try { this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)(); } catch { return; }
    const c = this.ctx;
    this.master = c.createGain(); this.master.gain.value = 0.9;
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -8; comp.ratio.value = 2.5; comp.attack.value = 0.003; comp.release.value = 0.15;
    this.master.connect(comp).connect(c.destination);
    // a short synthetic room reverb for the music
    const rev = c.createConvolver(); const len = c.sampleRate * 1.8; const ir = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
    rev.buffer = ir; const rg = c.createGain(); rg.gain.value = 0.25;
    this.music = c.createGain(); this.music.gain.value = this.musicVol; this.music.connect(this.master); this.music.connect(rev); rev.connect(rg).connect(this.master);
    this.sfxBus = c.createGain(); this.sfxBus.gain.value = this.sfxVol * SFX_BOOST; this.sfxBus.connect(this.master);
    this.ambBus = c.createGain(); this.ambBus.gain.value = 0.5 * this.sfxVol; this.ambBus.connect(this.master);
    this.noise = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const nd = this.noise.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    // ambience loops
    const mkLoop = () => { const s = c.createBufferSource(); s.buffer = this.noise; s.loop = true; return s; };
    { const s = mkLoop(), f = c.createBiquadFilter(), g = c.createGain(); f.type = 'bandpass'; f.frequency.value = 500; f.Q.value = 0.6; g.gain.value = 0;
      const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 0.12; lg.gain.value = 250; lfo.connect(lg).connect(f.frequency); lfo.start();
      s.connect(f).connect(g).connect(this.ambBus); s.start(); this.wind = { g, f }; }
    { const s = mkLoop(), f = c.createBiquadFilter(), g = c.createGain(), am = c.createGain(); f.type = 'lowpass'; f.frequency.value = 900; g.gain.value = 0; am.gain.value = 0.5;
      const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 0.18; lg.gain.value = 0.5; lfo.connect(lg).connect(am.gain); lfo.start();
      s.connect(f).connect(am).connect(g).connect(this.ambBus); s.start(); this.waves = { g }; }
    setInterval(() => this.tick(), 60);
    if (this.cur !== 'none') { const t = this.cur; this.cur = 'none'; this.setTheme(t); }
  }
  setVolumes(music: number, sfx: number) {
    this.musicVol = music; this.sfxVol = sfx;
    if (this.ctx) { this.music.gain.value = music; this.sfxBus.gain.value = sfx * SFX_BOOST; this.ambBus.gain.value = 0.5 * sfx; }
  }
  setTheme(t: Theme) {
    if (t === this.cur) return;
    this.cur = t;
    if (!this.ctx) return;
    const c = this.ctx;
    for (const x of this.tracks) { x.tr.out.gain.cancelScheduledValues(c.currentTime); x.tr.out.gain.setTargetAtTime(0, c.currentTime, 0.6); const tr = x.tr; setTimeout(() => tr.stop(), 4000); }
    this.tracks = [];
    if (t === 'none') return;
    const tr = new Track(c, this.music, THEMES[t], this.noise);
    tr.out.gain.setTargetAtTime(t === 'boss' ? 0.9 : 0.75, c.currentTime + 0.3, 0.8);
    this.tracks.push({ tr, theme: t });
  }
  setAmbience(wind: number, waves: number) {
    if (!this.ctx || !this.wind || !this.waves) return;
    const t = this.ctx.currentTime;
    this.wind.g.gain.setTargetAtTime(wind * 0.12, t, 1.2);
    this.waves.g.gain.setTargetAtTime(waves * 0.22, t, 1.2);
  }
  private tick() { for (const x of this.tracks) x.tr.schedule(); }

  // ----------------------------- SFX -----------------------------
  private env(g: GainNode, t: number, a: number, d: number, v: number) { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
  private tone(f0: number, f1: number, dur: number, type: OscillatorType, vol: number, delay = 0) {
    const c = this.ctx!; const t = c.currentTime + delay; const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    this.env(g, t, 0.005, dur, vol); o.connect(g).connect(this.sfxBus); o.start(t); o.stop(t + dur + 0.05);
  }
  private hiss(dur: number, f0: number, f1: number, vol: number, type: BiquadFilterType = 'bandpass', q = 1, delay = 0) {
    const c = this.ctx!; const t = c.currentTime + delay; const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noise; s.playbackRate.value = 0.8 + Math.random() * 0.4; f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    this.env(g, t, 0.005, dur, vol); s.connect(f).connect(g).connect(this.sfxBus); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  /** briefly lower the music so impact sounds cut through */
  private duck(amount = 0.45, time = 0.35) {
    const c = this.ctx!, g = this.music.gain, t = c.currentTime;
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(this.musicVol * amount, t + 0.02);
    g.linearRampToValueAtTime(this.musicVol, t + time);
  }
  private sweep(f0: number, f1: number, dur: number, type: OscillatorType, vol: number, delay = 0) { this.tone(f0, f1, dur, type, vol, delay); }
  play(name: string, opt?: any) {
    if (!this.ctx) return;
    const rnd = 0.9 + Math.random() * 0.2;
    switch (name) {
      case 'swing': this.hiss(0.2, 700 * rnd, 4200, 0.9, 'bandpass', 2.2); this.sweep(520 * rnd, 180, 0.16, 'sine', 0.22); break;
      case 'swing2': case 'spin': this.hiss(0.36, 500, 5000, 0.95, 'bandpass', 2); this.hiss(0.24, 2200, 700, 0.5, 'bandpass', 2.5, 0.14); this.sweep(300, 900, 0.3, 'sine', 0.2); break;
      case 'hit': this.duck(0.4, 0.3); this.sweep(190 * rnd, 45, 0.18, 'sine', 0.75); this.tone(260 * rnd, 70, 0.1, 'square', 0.28); this.hiss(0.07, 5000, 1500, 0.8, 'highpass', 0.7); this.tone(1250 * rnd, 1150, 0.12, 'triangle', 0.18, 0.01); break;
      case 'hurt': this.duck(0.35, 0.5); this.tone(620, 200, 0.28, 'sawtooth', 0.28); this.tone(470, 140, 0.28, 'square', 0.2, 0.05); this.sweep(150, 50, 0.2, 'sine', 0.5); break;
      case 'block': this.tone(1400, 1300, 0.3, 'triangle', 0.4); this.tone(2100, 2000, 0.22, 'sine', 0.22); this.hiss(0.05, 5000, 3000, 0.2, 'highpass'); break;
      case 'clank': this.tone(900, 850, 0.18, 'square', 0.12); this.tone(1350, 1300, 0.15, 'triangle', 0.1); break;
      case 'jump': this.tone(300, 600, 0.12, 'triangle', 0.12); this.hiss(0.1, 1200, 2400, 0.08); break;
      case 'land': this.hiss(0.08, 700, 300, 0.15, 'lowpass'); break;
      case 'step': opt?.water ? this.hiss(0.12, 1800, 700, 0.12, 'bandpass', 1) : this.hiss(0.05, 1400 * rnd, 500, opt?.soft ? 0.05 : 0.08, 'bandpass', 1.5); break;
      case 'roll': this.hiss(0.3, 400, 1200, 0.2, 'bandpass', 0.8); break;
      case 'cut': this.hiss(0.16, 3500, 1200, 0.75, 'bandpass', 1.2); this.hiss(0.3, 1200, 400, 0.45, 'lowpass', 1, 0.04); break;
      case 'pot': this.tone(900, 350, 0.12, 'triangle', 0.35); this.hiss(0.28, 4500, 1800, 0.8, 'highpass'); this.tone(1400, 1300, 0.08, 'square', 0.1, 0.05); break;
      case 'alert': this.tone(880, 1320, 0.09, 'square', 0.12); this.tone(1320, 1760, 0.1, 'square', 0.12, 0.08); break;
      case 'creature': this.tone(700 * rnd, 380, 0.14, 'triangle', 0.25); break;
      case 'enemyDie': this.duck(0.35, 0.6); this.sweep(700, 1800, 0.12, 'square', 0.18); this.hiss(0.35, 1500, 200, 0.75, 'lowpass', 1, 0.06); this.sweep(220, 55, 0.3, 'sine', 0.6, 0.06); [0, 7, 12].forEach((k, i) => this.tone(mtof(84 + k), mtof(84 + k), 0.1, 'triangle', 0.14, 0.2 + i * 0.06)); break;
      case 'bossDie': this.duck(0.2, 2.5); for (let i = 0; i < 6; i++) { this.tone(200 - i * 20, 50, 0.4, 'sawtooth', 0.12, i * 0.18); this.hiss(0.5, 1200, 100, 0.3, 'lowpass', 1, i * 0.18); } break;
      case 'puff': this.hiss(0.25, 600, 1800, 0.18, 'bandpass', 1); break;
      case 'spike': this.tone(1200, 700, 0.08, 'square', 0.05); break;
      case 'snap': this.tone(1600, 900, 0.05, 'square', 0.12); this.tone(1200, 600, 0.05, 'square', 0.1, 0.06); break;
      case 'charge': this.tone(200, 380, 0.3, 'sawtooth', 0.08); break;
      case 'thud': this.duck(0.4, 0.5); this.tone(110, 40, 0.45, 'sine', 0.8); this.hiss(0.3, 600, 100, 0.3, 'lowpass'); break;
      case 'chest': { const n = [0, 4, 7, 12]; n.forEach((k, i) => this.tone(mtof(67 + k), mtof(67 + k), 0.22, 'triangle', 0.12, i * 0.08)); break; }
      case 'itemGet': { const n = [0, 4, 7, 11, 12, 16]; n.forEach((k, i) => this.tone(mtof(72 + k), mtof(72 + k), i === 5 ? 0.8 : 0.18, i === 5 ? 'triangle' : 'square', i === 5 ? 0.14 : 0.06, i * 0.1)); break; }
      case 'smallGet': this.tone(1320, 1320, 0.07, 'square', 0.05); this.tone(1760, 1760, 0.12, 'square', 0.05, 0.06); break;
      case 'heal': [0, 4, 7, 12].forEach((k, i) => this.tone(mtof(76 + k), mtof(76 + k), 0.12, 'sine', 0.1, i * 0.05)); break;
      case 'door': this.tone(80, 60, 0.9, 'sawtooth', 0.08); this.hiss(0.9, 300, 150, 0.2, 'lowpass'); break;
      case 'solve': [0, 7, 12, 16, 19, 24].forEach((k, i) => this.tone(mtof(64 + k), mtof(64 + k), 0.25, 'triangle', 0.1, i * 0.09)); break;
      case 'torch': this.hiss(0.5, 300, 1600, 0.25, 'bandpass', 0.7); break;
      case 'push': this.hiss(0.35, 200, 140, 0.25, 'lowpass', 1); this.tone(70, 55, 0.35, 'sine', 0.15); break;
      case 'ui': this.tone(900, 1100, 0.05, 'triangle', 0.06); break;
      case 'uiBack': this.tone(700, 500, 0.06, 'triangle', 0.06); break;
      case 'talk': this.tone(500 + Math.random() * 300, 500, 0.03, 'triangle', 0.03); break;
      case 'splash': this.hiss(0.4, 2000, 400, 0.3, 'bandpass', 0.6); break;
      case 'lowHp': this.tone(880, 880, 0.08, 'square', 0.04); this.tone(660, 660, 0.08, 'square', 0.04, 0.12); break;
    }
  }
}
