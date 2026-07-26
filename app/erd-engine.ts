/* ============================================================
   ER·D ENGINE — six-voice percussion synth audio graph
   One oscillator, one modulator, one decay envelope per part.
   No samples anywhere. Pitches default to D Phrygian.
   ============================================================ */

export type Osc = "sine" | "triangle" | "sawtooth" | "square" | "noise";
export type Mod = "ring" | "pitch" | "grit";

export type Part = {
  name: string;
  osc: Osc;
  mod: Mod;
  pitch: number;
  bend: number;
  decay: number;
  level: number;
  pan: number;
  low: number;
  modSpeed: number;
  modDepth: number;
  send: number;
};

export type EngineSnapshot = {
  parts: Part[];
  steps: number[][];
  mutes: boolean[];
  bpm: number;
  swing: number;
  dlyTime: number;
  dlyFb: number;
  master: number;
};

/* ---------- scale / note helpers ---------- */
export const D_PHRYGIAN = [0, 1, 3, 5, 7, 8, 10]; // semitones above D
export const NOTE_NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];

export const hzToMidi = (hz: number) => 69 + 12 * Math.log2(hz / 440);
export const midiToHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
export const hzToNote = (hz: number) => {
  const m = Math.round(hzToMidi(hz));
  return NOTE_NAMES[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);
};
export const snapHz = (hz: number) => {
  const m = hzToMidi(hz);
  let best = Math.round(m);
  let bd = Infinity;
  for (let k = Math.floor(m) - 3; k <= Math.ceil(m) + 3; k++) {
    const pc = (((k - 2) % 12) + 12) % 12; // relative to D
    if (D_PHRYGIAN.includes(pc)) {
      const d = Math.abs(k - m);
      if (d < bd) { bd = d; best = k; }
    }
  }
  return midiToHz(best);
};

/* ---------- param definitions ---------- */
export type Spec = { min: number; max: number; log?: boolean };

export const SPEC: Record<string, Spec> = {
  pitch:    { min: 24,   max: 9000, log: true },
  bend:     { min: -2,   max: 2 },
  decay:    { min: 0.02, max: 2,    log: true },
  level:    { min: 0,    max: 1 },
  pan:      { min: -1,   max: 1 },
  low:      { min: 0,    max: 1 },
  modSpeed: { min: 0.2,  max: 4000, log: true },
  modDepth: { min: 0,    max: 1 },
  send:     { min: 0,    max: 1 },
  swing:    { min: 0,    max: 1 },
  dlyTime:  { min: 1,    max: 8 },
  dlyFb:    { min: 0,    max: 0.95 },
  master:   { min: 0,    max: 1 },
};

export const toNorm = (v: number, s: Spec) =>
  s.log ? Math.log(Math.max(v, s.min) / s.min) / Math.log(s.max / s.min)
        : (v - s.min) / (s.max - s.min);
export const fromNorm = (n: number, s: Spec) =>
  s.log ? s.min * Math.pow(s.max / s.min, n) : s.min + (s.max - s.min) * n;

export const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);
export const clampF = (f: number) => Math.max(8, Math.min(18000, f));
export const rnd = (a: number, b: number) => a + Math.random() * (b - a);
export const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

export const OSCS: Osc[] = ["sine", "triangle", "sawtooth", "square", "noise"];
export const OSC_LABEL: Record<Osc, string> = { sine: "SIN", triangle: "TRI", sawtooth: "SAW", square: "SQR", noise: "NOI" };
export const MODS: Mod[] = ["ring", "pitch", "grit"];
export const MOD_LABEL: Record<Mod, string> = { ring: "RING", pitch: "PTCH", grit: "GRIT" };

/* ---------- readouts ---------- */
export const fmtPitch = (v: number, osc: Osc) =>
  osc === "noise"
    ? (v >= 1000 ? (v / 1000).toFixed(2) + "k" : v.toFixed(0) + "Hz")
    : hzToNote(v);
export const fmtHz = (v: number) => (v >= 1000 ? (v / 1000).toFixed(2) + "k" : v.toFixed(v < 10 ? 2 : 0));
export const fmtMs = (v: number) => (v < 1 ? Math.round(v * 1000) + "ms" : v.toFixed(2) + "s");
export const fmtPct = (v: number) => Math.round(v * 100) + "";
export const fmtPan = (v: number) => (Math.abs(v) < 0.02 ? "C" : (v < 0 ? "L" : "R") + Math.round(Math.abs(v) * 100));
export const fmtBend = (v: number) => (v > 0 ? "+" : "") + v.toFixed(2);

/* ---------- initial kit (D Phrygian) ---------- */
export const KIT: Part[] = [
  { name: "KIK", osc: "sine",     mod: "ring",  pitch: 73.42, bend: 1.70, decay: 0.34,  level: 0.95, pan: 0,     low: 0.70, modSpeed: 8,    modDepth: 0,    send: 0 },
  { name: "SNR", osc: "noise",    mod: "grit",  pitch: 1245,  bend: 0.45, decay: 0.165, level: 0.80, pan: 0,     low: 0.20, modSpeed: 620,  modDepth: 0.32, send: 0.12 },
  { name: "CLP", osc: "noise",    mod: "grit",  pitch: 2093,  bend: 0,    decay: 0.085, level: 0.72, pan: -0.28, low: 0,    modSpeed: 1400, modDepth: 0.50, send: 0.30 },
  { name: "HAT", osc: "noise",    mod: "grit",  pitch: 7040,  bend: 0,    decay: 0.045, level: 0.52, pan: 0.30,  low: 0,    modSpeed: 2600, modDepth: 0.22, send: 0 },
  { name: "TOM", osc: "triangle", mod: "pitch", pitch: 174.6, bend: 0.85, decay: 0.30,  level: 0.70, pan: -0.42, low: 0.35, modSpeed: 6.5,  modDepth: 0.14, send: 0.18 },
  { name: "ZAP", osc: "square",   mod: "ring",  pitch: 293.7, bend: -1.2, decay: 0.115, level: 0.58, pan: 0.46,  low: 0,    modSpeed: 340,  modDepth: 0.62, send: 0.40 },
];

export function randomizeVoice(name: string, snap: boolean): Part {
  const osc = pick(OSCS);
  let pitch = osc === "noise" ? Math.exp(rnd(Math.log(300), Math.log(8000))) : Math.exp(rnd(Math.log(38), Math.log(700)));
  if (snap && osc !== "noise") pitch = snapHz(pitch);
  return {
    name,
    osc,
    mod: pick(MODS),
    pitch,
    bend: Math.random() < 0.45 ? 0 : rnd(-1.4, 2),
    decay: Math.exp(rnd(Math.log(0.03), Math.log(0.7))),
    level: rnd(0.55, 0.95),
    pan: Math.random() < 0.4 ? 0 : rnd(-0.7, 0.7),
    low: Math.random() < 0.5 ? 0 : rnd(0, 0.8),
    modSpeed: Math.exp(rnd(Math.log(1), Math.log(2400))),
    modDepth: Math.random() < 0.3 ? 0 : rnd(0.12, 0.8),
    send: Math.random() < 0.6 ? 0 : rnd(0.1, 0.5),
  };
}

export function randomizePattern(): number[][] {
  const density = [0.2, 0.13, 0.1, 0.4, 0.13, 0.1];
  return density.map((d, row) => {
    const r = Array.from({ length: 16 }, (_, i) => {
      const bias = i % 4 === 0 ? 1.7 : i % 2 === 0 ? 1.0 : 0.55;
      if (Math.random() < d * bias) return Math.random() < 0.24 ? 2 : 1;
      return 0;
    });
    if (row === 0) r[0] = 2;
    return r;
  });
}

// . = off, x = on, X = accent
export const PATTERN: number[][] = [
  "X.....x...x.....",
  "....x.......X...",
  "............x..x",
  "x.X.x.X.x.X.x.X.",
  "...........x..x.",
  "...............X",
].map((r) => [...r].map((c) => (c === "X" ? 2 : c === "x" ? 1 : 0)));

/* ============================================================
   AUDIO ENGINE — identical code paths for live + offline render
   ============================================================ */

const noiseCache = new WeakMap<BaseAudioContext, AudioBuffer>();
function getNoise(ctx: BaseAudioContext) {
  let b = noiseCache.get(ctx);
  if (!b) {
    b = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 2), ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    noiseCache.set(ctx, b);
  }
  return b;
}

function softCurve() {
  const n = 2048, c = new Float32Array(n), k = 1.7, norm = Math.tanh(k);
  for (let i = 0; i < n; i++) c[i] = Math.tanh(((i / (n - 1)) * 2 - 1) * k) / norm;
  return c;
}

export type Chain = { in: GainNode; shelf: BiquadFilterNode; pan: StereoPannerNode; send: GainNode };
export type Graph = { chains: Chain[]; sum: GainNode; out: GainNode; dly: DelayNode; fb: GainNode };

export function buildGraph(ctx: BaseAudioContext, s: EngineSnapshot): Graph {
  const out = ctx.createGain();
  out.gain.value = s.master;
  const shaper = ctx.createWaveShaper();
  shaper.curve = softCurve();
  shaper.oversample = "2x";
  const sum = ctx.createGain();
  sum.gain.value = 0.42;
  sum.connect(shaper);
  shaper.connect(out);
  out.connect(ctx.destination);

  const stepDur = 60 / s.bpm / 4;
  const dly = ctx.createDelay(2);
  dly.delayTime.value = Math.min(1.9, stepDur * s.dlyTime);
  const damp = ctx.createBiquadFilter();
  damp.type = "lowpass";
  damp.frequency.value = 3400;
  const fb = ctx.createGain();
  fb.gain.value = s.dlyFb * 0.75;
  dly.connect(damp);
  damp.connect(fb);
  fb.connect(dly);
  const dlyOut = ctx.createGain();
  dlyOut.gain.value = 0.9;
  damp.connect(dlyOut);
  dlyOut.connect(sum);

  const chains = s.parts.map((p) => {
    const inG = ctx.createGain();
    inG.gain.value = p.level;
    const shelf = ctx.createBiquadFilter();
    shelf.type = "lowshelf";
    shelf.frequency.value = 150;
    shelf.gain.value = p.low * 15;
    const pan = ctx.createStereoPanner();
    pan.pan.value = p.pan;
    const send = ctx.createGain();
    send.gain.value = p.send * 0.9;
    inG.connect(shelf);
    shelf.connect(pan);
    pan.connect(sum);
    pan.connect(send);
    send.connect(dly);
    return { in: inG, shelf, pan, send };
  });

  return { chains, sum, out, dly, fb };
}

export function triggerVoice(ctx: BaseAudioContext, chain: Chain, p: Part, t: number, accent: boolean) {
  const dec = Math.max(0.02, p.decay);
  const peak = accent ? 1 : 0.6;
  const end = t + dec + 0.04;

  const amp = ctx.createGain();
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.exponentialRampToValueAtTime(peak, t + 0.0018);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + dec);
  amp.connect(chain.in);

  const base = clampF(p.pitch);
  const start = clampF(base * Math.pow(2, p.bend));
  const sweep = Math.min(dec * 0.8, 0.3);

  let tail: AudioNode;
  let freqParam: AudioParam;

  if (p.osc === "noise") {
    const src = ctx.createBufferSource();
    src.buffer = getNoise(ctx);
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 1.1;
    bp.frequency.setValueAtTime(start, t);
    if (Math.abs(p.bend) > 0.01) bp.frequency.exponentialRampToValueAtTime(base, t + sweep);
    src.connect(bp);
    src.start(t);
    src.stop(end);
    tail = bp;
    freqParam = bp.frequency;
  } else {
    const src = ctx.createOscillator();
    src.type = p.osc;
    src.frequency.setValueAtTime(start, t);
    if (Math.abs(p.bend) > 0.01) src.frequency.exponentialRampToValueAtTime(base, t + sweep);
    src.start(t);
    src.stop(end);
    tail = src;
    freqParam = src.frequency;
  }

  const vca = ctx.createGain();
  vca.gain.setValueAtTime(1, t);
  tail.connect(vca);
  vca.connect(amp);

  const d = p.modDepth;
  if (d > 0.005) {
    if (p.mod === "ring") {
      vca.gain.setValueAtTime(1 - d, t);
      const lfo = ctx.createOscillator();
      lfo.type = "sine";
      lfo.frequency.value = p.modSpeed;
      const g = ctx.createGain();
      g.gain.value = d;
      lfo.connect(g);
      g.connect(vca.gain);
      lfo.start(t);
      lfo.stop(end);
    } else if (p.mod === "pitch") {
      const lfo = ctx.createOscillator();
      lfo.type = "triangle";
      lfo.frequency.value = p.modSpeed;
      const g = ctx.createGain();
      g.gain.value = d * base * 3.5;
      lfo.connect(g);
      g.connect(freqParam);
      lfo.start(t);
      lfo.stop(end);
    } else {
      const n = ctx.createBufferSource();
      n.buffer = getNoise(ctx);
      n.loop = true;
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = Math.max(25, Math.min(12000, p.modSpeed * 3));
      const g = ctx.createGain();
      g.gain.value = d * base * 2.2;
      n.connect(lp);
      lp.connect(g);
      g.connect(freqParam);
      n.start(t);
      n.stop(end);
    }
  }
}

export function scheduleStep(ctx: BaseAudioContext, chains: Chain[], s: EngineSnapshot, step: number, t: number) {
  for (let i = 0; i < s.parts.length; i++) {
    if (s.mutes[i]) continue;
    const v = s.steps[i][step];
    if (!v) continue;
    triggerVoice(ctx, chains[i], s.parts[i], t, v === 2);
  }
}

/* ---------- WAV encoder ---------- */
export function encodeWav(chans: Float32Array[], sr: number, gain: number) {
  const n = chans[0].length, ch = chans.length;
  const bytes = n * ch * 2;
  const buf = new ArrayBuffer(44 + bytes);
  const v = new DataView(buf);
  const w = (o: number, str: string) => { for (let i = 0; i < str.length; i++) v.setUint8(o + i, str.charCodeAt(i)); };
  w(0, "RIFF"); v.setUint32(4, 36 + bytes, true); w(8, "WAVE");
  w(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
  v.setUint16(22, ch, true); v.setUint32(24, sr, true);
  v.setUint32(28, sr * ch * 2, true); v.setUint16(32, ch * 2, true); v.setUint16(34, 16, true);
  w(36, "data"); v.setUint32(40, bytes, true);
  let o = 44;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < ch; c++) {
      let x = chans[c][i] * gain;
      x = x < -1 ? -1 : x > 1 ? 1 : x;
      v.setInt16(o, x < 0 ? x * 0x8000 : x * 0x7fff, true);
      o += 2;
    }
  }
  return buf;
}
