/* ============================================================
   LOW//END ENGINE — coordinated kick, sub, and 808 synthesis
   Browser-native Web Audio. No samples.
   ============================================================ */

export type StepValue = 0 | 1 | 2;
export type Waveform = "sine" | "triangle";

export type LowEndState = {
  bpm: number;
  swing: number;
  rootMidi: number;
  fullness: number;
  entry: number;
  evolve: boolean;
  evolveBars: number;
  renderBars: number;
  master: number;
  kick: {
    tune: number;
    drop: number;
    decay: number;
    click: number;
    drive: number;
    level: number;
  };
  sub: {
    wave: Waveform;
    octave: number;
    decay: number;
    tone: number;
    drive: number;
    level: number;
  };
  bass: {
    octave: number;
    decay: number;
    tone: number;
    drive: number;
    glide: number;
    motion: number;
    width: number;
    level: number;
  };
  mix: {
    duck: number;
    recovery: number;
    glue: number;
  };
  kickSteps: StepValue[];
  subSteps: StepValue[];
  bassSteps: StepValue[];
  bassNotes: number[];
};

export type Graph = {
  kickBus: GainNode;
  subBus: GainNode;
  subDuck: GainNode;
  subFilter: BiquadFilterNode;
  subShape: WaveShaperNode;
  bassBus: GainNode;
  bassDuck: GainNode;
  bassFilter: BiquadFilterNode;
  bassShape: WaveShaperNode;
  sum: GainNode;
  glue: DynamicsCompressorNode;
  masterShape: WaveShaperNode;
  out: GainNode;
  analyser: AnalyserNode;
};

export const NOTE_NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
export const NOTE_OFFSETS = [-5, -2, 0, 3, 5, 7, 10, 12];
export const NOTE_OFFSET_LABELS: Record<number, string> = {
  [-5]: "V↓",
  [-2]: "bVII↓",
  0: "I",
  3: "bIII",
  5: "IV",
  7: "V",
  10: "bVII",
  12: "I↑",
};

export const midiToHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
export const midiLabel = (m: number) => NOTE_NAMES[((Math.round(m) % 12) + 12) % 12] + (Math.floor(Math.round(m) / 12) - 1);
export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export const lerp = (a: number, b: number, n: number) => a + (b - a) * n;

const sv = (pattern: string): StepValue[] =>
  [...pattern].map((c) => (c === "X" ? 2 : c === "x" ? 1 : 0)) as StepValue[];

export const PRESETS: Record<string, LowEndState> = {
  "Gradual Pressure": {
    bpm: 116,
    swing: 0.08,
    rootMidi: 29,
    fullness: 0.92,
    entry: 0.18,
    evolve: true,
    evolveBars: 16,
    renderBars: 16,
    master: 0.82,
    kick: { tune: 46, drop: 0.76, decay: 0.34, click: 0.08, drive: 1.75, level: 0.92 },
    sub: { wave: "sine", octave: 0, decay: 1.25, tone: 88, drive: 1.18, level: 0.56 },
    bass: { octave: 0, decay: 0.72, tone: 360, drive: 2.25, glide: 0.11, motion: 0.26, width: 0.18, level: 0.70 },
    mix: { duck: 0.64, recovery: 0.24, glue: 0.42 },
    kickSteps: sv("X...x...X...x..."),
    subSteps: sv("X.......x......."),
    bassSteps: sv("X....xx...x..x.x"),
    bassNotes: [0,0,0,0,0,0,7,0,0,0,3,0,0,-2,0,0],
  },
  "Minimal Weight": {
    bpm: 108,
    swing: 0.03,
    rootMidi: 29,
    fullness: 0.56,
    entry: 0.20,
    evolve: false,
    evolveBars: 8,
    renderBars: 8,
    master: 0.84,
    kick: { tune: 44, drop: 0.66, decay: 0.42, click: 0.03, drive: 1.45, level: 0.94 },
    sub: { wave: "sine", octave: 0, decay: 1.55, tone: 78, drive: 1.08, level: 0.62 },
    bass: { octave: 0, decay: 0.88, tone: 250, drive: 1.65, glide: 0.05, motion: 0.10, width: 0.05, level: 0.56 },
    mix: { duck: 0.72, recovery: 0.30, glue: 0.28 },
    kickSteps: sv("X.......X......."),
    subSteps: sv("X.......X......."),
    bassSteps: sv("X.........x....."),
    bassNotes: [0,0,0,0,0,0,0,0,0,0,7,0,0,0,0,0],
  },
  "Moving 808": {
    bpm: 122,
    swing: 0.16,
    rootMidi: 27,
    fullness: 1,
    entry: 0.34,
    evolve: true,
    evolveBars: 8,
    renderBars: 8,
    master: 0.78,
    kick: { tune: 49, drop: 0.84, decay: 0.28, click: 0.12, drive: 2.10, level: 0.90 },
    sub: { wave: "sine", octave: 0, decay: 0.86, tone: 96, drive: 1.25, level: 0.46 },
    bass: { octave: 0, decay: 0.62, tone: 520, drive: 3.10, glide: 0.18, motion: 0.62, width: 0.30, level: 0.78 },
    mix: { duck: 0.56, recovery: 0.18, glue: 0.56 },
    kickSteps: sv("X...x...X.x.x..."),
    subSteps: sv("X.......x......."),
    bassSteps: sv("X.xx..x.x.x..xx."),
    bassNotes: [0,0,7,3,0,0,-2,0,0,0,7,0,0,3,12,0],
  },
  "Dub Chamber": {
    bpm: 96,
    swing: 0.20,
    rootMidi: 31,
    fullness: 0.78,
    entry: 0.26,
    evolve: true,
    evolveBars: 12,
    renderBars: 12,
    master: 0.84,
    kick: { tune: 42, drop: 0.58, decay: 0.52, click: 0.02, drive: 1.62, level: 0.90 },
    sub: { wave: "triangle", octave: -1, decay: 1.90, tone: 72, drive: 1.32, level: 0.60 },
    bass: { octave: 0, decay: 1.08, tone: 310, drive: 2.10, glide: 0.15, motion: 0.34, width: 0.16, level: 0.63 },
    mix: { duck: 0.68, recovery: 0.36, glue: 0.34 },
    kickSteps: sv("X.......X...x..."),
    subSteps: sv("X.......x......."),
    bassSteps: sv("X.....x....x...x"),
    bassNotes: [0,0,0,0,0,0,3,0,0,0,0,-2,0,0,0,7],
  },
};

export const DEFAULT_STATE: LowEndState = structuredClone(PRESETS["Gradual Pressure"]);

const noiseCache = new WeakMap<BaseAudioContext, AudioBuffer>();
function getNoise(ctx: BaseAudioContext) {
  let buffer = noiseCache.get(ctx);
  if (!buffer) {
    buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.5), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      last = last * 0.68 + white * 0.32;
      data[i] = last;
    }
    noiseCache.set(ctx, buffer);
  }
  return buffer;
}

export function saturationCurve(drive: number) {
  const n = 4096;
  const curve = new Float32Array(n);
  const k = Math.max(0.001, drive);
  const norm = Math.tanh(k);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * k) / norm;
  }
  return curve;
}

export function buildGraph(ctx: BaseAudioContext, state: LowEndState): Graph {
  const kickBus = ctx.createGain();
  const subBus = ctx.createGain();
  const subDuck = ctx.createGain();
  const subFilter = ctx.createBiquadFilter();
  const subShape = ctx.createWaveShaper();
  const bassBus = ctx.createGain();
  const bassDuck = ctx.createGain();
  const bassFilter = ctx.createBiquadFilter();
  const bassShape = ctx.createWaveShaper();
  const sum = ctx.createGain();
  const glue = ctx.createDynamicsCompressor();
  const masterShape = ctx.createWaveShaper();
  const out = ctx.createGain();
  const analyser = ctx.createAnalyser();

  subFilter.type = "lowpass";
  subFilter.Q.value = 0.55;
  bassFilter.type = "lowpass";
  bassFilter.Q.value = 0.72;

  subShape.oversample = "4x";
  bassShape.oversample = "4x";
  masterShape.oversample = "2x";

  kickBus.connect(sum);
  subBus.connect(subDuck);
  subDuck.connect(subFilter);
  subFilter.connect(subShape);
  subShape.connect(sum);
  bassBus.connect(bassDuck);
  bassDuck.connect(bassFilter);
  bassFilter.connect(bassShape);
  bassShape.connect(sum);

  sum.connect(glue);
  glue.connect(masterShape);
  masterShape.connect(out);
  out.connect(analyser);
  analyser.connect(ctx.destination);

  analyser.fftSize = 1024;
  analyser.smoothingTimeConstant = 0.78;
  sum.gain.value = 0.64;

  const graph = {
    kickBus, subBus, subDuck, subFilter, subShape,
    bassBus, bassDuck, bassFilter, bassShape,
    sum, glue, masterShape, out, analyser,
  };
  updateGraph(graph, state, ctx.currentTime);
  return graph;
}

export function updateGraph(graph: Graph, state: LowEndState, now: number) {
  graph.kickBus.gain.setTargetAtTime(state.kick.level, now, 0.012);
  graph.subBus.gain.setTargetAtTime(state.sub.level, now, 0.012);
  graph.bassBus.gain.setTargetAtTime(state.bass.level, now, 0.012);
  graph.subFilter.frequency.setTargetAtTime(state.sub.tone, now, 0.018);
  graph.bassFilter.frequency.setTargetAtTime(state.bass.tone, now, 0.018);
  graph.subShape.curve = saturationCurve(state.sub.drive);
  graph.bassShape.curve = saturationCurve(state.bass.drive);
  graph.masterShape.curve = saturationCurve(1 + state.mix.glue * 0.9);
  graph.out.gain.setTargetAtTime(state.master, now, 0.015);

  graph.glue.threshold.setTargetAtTime(-8 - state.mix.glue * 14, now, 0.02);
  graph.glue.knee.setTargetAtTime(10 + state.mix.glue * 16, now, 0.02);
  graph.glue.ratio.setTargetAtTime(1.5 + state.mix.glue * 3.5, now, 0.02);
  graph.glue.attack.setTargetAtTime(0.004 + (1 - state.mix.glue) * 0.012, now, 0.02);
  graph.glue.release.setTargetAtTime(0.12 + state.mix.glue * 0.16, now, 0.02);
}

function safeStop(node: AudioScheduledSourceNode, time: number) {
  try { node.stop(time); } catch { /* already stopped */ }
}

function gainEnvelope(gain: AudioParam, t: number, attack: number, decay: number, peak: number) {
  gain.setValueAtTime(0.0001, t);
  gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + Math.max(0.001, attack));
  gain.exponentialRampToValueAtTime(0.0001, t + Math.max(attack + 0.01, decay));
}

function duckLowEnd(graph: Graph, state: LowEndState, t: number) {
  const amount = clamp(state.mix.duck, 0, 1);
  if (amount < 0.01) return;
  const floor = 1 - amount * 0.86;
  const recovery = clamp(state.mix.recovery, 0.05, 0.7);
  for (const param of [graph.subDuck.gain, graph.bassDuck.gain]) {
    param.cancelScheduledValues(t);
    param.setValueAtTime(1, t);
    param.linearRampToValueAtTime(floor, t + 0.004);
    param.exponentialRampToValueAtTime(1, t + recovery);
  }
}

export function triggerKick(ctx: BaseAudioContext, graph: Graph, state: LowEndState, t: number, accent: boolean, build: number) {
  const p = state.kick;
  const amp = ctx.createGain();
  const osc = ctx.createOscillator();
  const bodyFilter = ctx.createBiquadFilter();
  const shaper = ctx.createWaveShaper();

  bodyFilter.type = "lowpass";
  bodyFilter.frequency.value = 900;
  bodyFilter.Q.value = 0.6;
  shaper.curve = saturationCurve(p.drive * (0.86 + build * 0.25));
  shaper.oversample = "4x";

  osc.type = "sine";
  const target = clamp(p.tune, 32, 82);
  const start = target * (1.35 + p.drop * 3.5);
  osc.frequency.setValueAtTime(start, t);
  osc.frequency.exponentialRampToValueAtTime(target, t + 0.025 + p.drop * 0.07);

  const peak = (accent ? 1 : 0.72) * (0.90 + build * 0.10);
  gainEnvelope(amp.gain, t, 0.0015, t + 0.08 > t + p.decay ? 0.08 : p.decay, peak);
  osc.connect(amp);
  amp.connect(bodyFilter);
  bodyFilter.connect(shaper);
  shaper.connect(graph.kickBus);
  osc.start(t);
  safeStop(osc, t + p.decay + 0.08);

  if (p.click > 0.002) {
    const noise = ctx.createBufferSource();
    const clickGain = ctx.createGain();
    const clickFilter = ctx.createBiquadFilter();
    noise.buffer = getNoise(ctx);
    clickFilter.type = "bandpass";
    clickFilter.frequency.value = 2100 + p.click * 2600;
    clickFilter.Q.value = 0.8;
    gainEnvelope(clickGain.gain, t, 0.0005, 0.024 + p.click * 0.025, p.click * (accent ? 0.72 : 0.52));
    noise.connect(clickFilter);
    clickFilter.connect(clickGain);
    clickGain.connect(graph.kickBus);
    noise.start(t);
    safeStop(noise, t + 0.09);
  }

  duckLowEnd(graph, state, t);
}

export function triggerSub(ctx: BaseAudioContext, graph: Graph, state: LowEndState, t: number, accent: boolean, build: number) {
  const p = state.sub;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  const freq = midiToHz(state.rootMidi + p.octave * 12);
  osc.type = p.wave;
  osc.frequency.setValueAtTime(freq * 1.02, t);
  osc.frequency.exponentialRampToValueAtTime(freq, t + 0.035);
  const decay = p.decay * (0.84 + build * 0.26);
  gainEnvelope(amp.gain, t, 0.006, decay, (accent ? 0.92 : 0.68) * (0.88 + build * 0.12));
  osc.connect(amp);
  amp.connect(graph.subBus);
  osc.start(t);
  safeStop(osc, t + decay + 0.08);
}

export function previousBassOffset(state: LowEndState, step: number) {
  for (let back = 1; back <= 16; back++) {
    const i = (step - back + 16) % 16;
    if (state.bassSteps[i] > 0) return state.bassNotes[i] ?? 0;
  }
  return 0;
}

export function triggerBass(
  ctx: BaseAudioContext,
  graph: Graph,
  state: LowEndState,
  t: number,
  step: number,
  accent: boolean,
  build: number,
) {
  const p = state.bass;
  const offset = state.bassNotes[step] ?? 0;
  const targetMidi = state.rootMidi + p.octave * 12 + offset;
  const prevMidi = state.rootMidi + p.octave * 12 + previousBassOffset(state, step);
  const target = midiToHz(targetMidi);
  const from = midiToHz(prevMidi);
  const decay = p.decay * (0.82 + build * 0.28);
  const glideTime = p.glide * (60 / state.bpm);

  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(p.glide > 0.005 ? from : target * 1.025, t);
  if (glideTime > 0.003) osc.frequency.exponentialRampToValueAtTime(target, t + glideTime);
  else osc.frequency.exponentialRampToValueAtTime(target, t + 0.025);

  const motion = p.motion * (0.45 + build * 0.55);
  if (motion > 0.01) {
    const wobble = ctx.createOscillator();
    const wobbleDepth = ctx.createGain();
    wobble.type = "sine";
    wobble.frequency.value = 0.22 + motion * 2.3;
    wobbleDepth.gain.value = target * motion * 0.007;
    wobble.connect(wobbleDepth);
    wobbleDepth.connect(osc.frequency);
    wobble.start(t);
    safeStop(wobble, t + decay + 0.12);
  }

  gainEnvelope(amp.gain, t, 0.004, decay, (accent ? 0.98 : 0.70) * (0.86 + build * 0.14));
  osc.connect(amp);
  amp.connect(graph.bassBus);
  osc.start(t);
  safeStop(osc, t + decay + 0.10);

  const upperAmount = (0.025 + p.motion * 0.11) * build;
  if (upperAmount > 0.003) {
    const upper = ctx.createOscillator();
    const upperAmp = ctx.createGain();
    const upperFilter = ctx.createBiquadFilter();
    const pan = ctx.createStereoPanner();
    upper.type = step % 3 === 0 ? "triangle" : "sine";
    upper.frequency.setValueAtTime(target * 2, t);
    if (glideTime > 0.003) upper.frequency.exponentialRampToValueAtTime(target * 2, t + glideTime);
    upperFilter.type = "highpass";
    upperFilter.frequency.value = 120;
    upperFilter.Q.value = 0.5;
    pan.pan.value = (step % 2 ? 1 : -1) * p.width * 0.72;
    gainEnvelope(upperAmp.gain, t, 0.006, decay * 0.72, upperAmount * (accent ? 1 : 0.72));
    upper.connect(upperFilter);
    upperFilter.connect(upperAmp);
    upperAmp.connect(pan);
    pan.connect(graph.sum);
    upper.start(t);
    safeStop(upper, t + decay + 0.08);
  }
}

function thresholdFor(row: "kick" | "sub" | "bass", step: number, value: StepValue) {
  const accentBonus = value === 2 ? -0.12 : 0;
  if (row === "kick") {
    if (step % 4 === 0) return 0.04 + accentBonus;
    if (step % 2 === 0) return 0.48 + accentBonus;
    return 0.78 + accentBonus;
  }
  if (row === "sub") {
    if (step === 0 || step === 8) return 0.06 + accentBonus;
    if (step % 4 === 0) return 0.42 + accentBonus;
    return 0.72 + accentBonus;
  }
  if (step === 0 || step === 8) return 0.08 + accentBonus;
  if (step % 4 === 0) return 0.36 + accentBonus;
  if (step % 2 === 0) return 0.54 + accentBonus;
  return 0.72 + accentBonus;
}

export function buildForBar(state: LowEndState, bar: number) {
  if (!state.evolve) return state.fullness;
  const span = Math.max(1, state.evolveBars - 1);
  const phase = clamp(bar / span, 0, 1);
  const eased = phase * phase * (3 - 2 * phase);
  return lerp(state.entry, state.fullness, eased);
}

export type ScheduledActivity = { kick: boolean; sub: boolean; bass: boolean; build: number };

export function scheduleStep(
  ctx: BaseAudioContext,
  graph: Graph,
  state: LowEndState,
  step: number,
  t: number,
  bar: number,
): ScheduledActivity {
  const build = buildForBar(state, bar);
  const kickValue = state.kickSteps[step] ?? 0;
  const subValue = state.subSteps[step] ?? 0;
  const bassValue = state.bassSteps[step] ?? 0;
  const kick = kickValue > 0 && build >= thresholdFor("kick", step, kickValue);
  const sub = subValue > 0 && build >= thresholdFor("sub", step, subValue);
  const bass = bassValue > 0 && build >= thresholdFor("bass", step, bassValue);

  if (kick) triggerKick(ctx, graph, state, t, kickValue === 2, build);
  if (sub) triggerSub(ctx, graph, state, t, subValue === 2, build);
  if (bass) triggerBass(ctx, graph, state, t, step, bassValue === 2, build);
  return { kick, sub, bass, build };
}

export function musicalMutate(state: LowEndState): LowEndState {
  const next = structuredClone(state);
  const density = clamp(state.fullness, 0.2, 1);
  const mutateRow = (row: StepValue[], kind: "kick" | "sub" | "bass") =>
    row.map((value, i) => {
      if (kind === "kick" && i % 4 === 0) return (i === 0 ? 2 : 1) as StepValue;
      if (kind === "sub" && (i === 0 || i === 8)) return (i === 0 ? 2 : 1) as StepValue;
      const base = kind === "bass" ? 0.16 : kind === "kick" ? 0.08 : 0.045;
      const positional = i % 2 === 0 ? 1.25 : 0.72;
      if (Math.random() < base * positional * density) return (Math.random() < 0.22 ? 2 : 1) as StepValue;
      return Math.random() < 0.08 ? 0 : value;
    });
  next.kickSteps = mutateRow(next.kickSteps, "kick");
  next.subSteps = mutateRow(next.subSteps, "sub");
  next.bassSteps = mutateRow(next.bassSteps, "bass");
  next.bassNotes = next.bassNotes.map((note, i) => {
    if (next.bassSteps[i] === 0 || Math.random() > 0.34) return note;
    return NOTE_OFFSETS[Math.floor(Math.random() * NOTE_OFFSETS.length)];
  });
  return next;
}

export function encodeWav(channels: Float32Array[], sampleRate: number, normalize = true) {
  const length = channels[0]?.length ?? 0;
  const numChannels = channels.length;
  let peak = 0;
  for (const channel of channels) {
    for (let i = 0; i < channel.length; i++) peak = Math.max(peak, Math.abs(channel[i]));
  }
  const trim = normalize && peak > 0.965 ? 0.965 / peak : 1;
  const bytesPerSample = 2;
  const buffer = new ArrayBuffer(44 + length * numChannels * bytesPerSample);
  const view = new DataView(buffer);
  const write = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };

  write(0, "RIFF");
  view.setUint32(4, 36 + length * numChannels * bytesPerSample, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * bytesPerSample, true);
  view.setUint16(32, numChannels * bytesPerSample, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, length * numChannels * bytesPerSample, true);

  let offset = 44;
  for (let i = 0; i < length; i++) {
    for (let c = 0; c < numChannels; c++) {
      const sample = clamp(channels[c][i] * trim, -1, 1);
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }
  return { buffer, peak: peak * trim };
}
