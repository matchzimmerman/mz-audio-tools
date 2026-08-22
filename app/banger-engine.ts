export type FollowMode = "KICK" | "BASS";
export type KickStep = 0 | 1 | 2;
export type SubStep = 0 | 1 | 2 | 3;

export type BangerParams = {
  banger: number;
  bump: number;
  weight: number;
  knock: number;
  depth: number;
  tail: number;
  nest: number;
  grit: number;
  space: number;
  system: number;
};

export type BangerStep = {
  kick: KickStep;
  sub: SubStep;
};

export type BangerSnapshot = {
  bpm: number;
  swing: number;
  root: number;
  octave: 1 | 2;
  follow: FollowMode;
  params: BangerParams;
  steps: BangerStep[];
  main: number;
};

export type BangerGraph = {
  kickBus: GainNode;
  subBus: GainNode;
  knockBus: GainNode;
  spaceSend: GainNode;
  spaceReturn: GainNode;
  sum: GainNode;
  compressor: DynamicsCompressorNode;
  analyser: AnalyserNode;
  out: GainNode;
};

export type BangerPreset = {
  name: string;
  subtitle: string;
  bpm: number;
  follow: FollowMode;
  params: BangerParams;
  steps: BangerStep[];
};

export type TriggerTelemetry = {
  when: number;
  handoffMs: number;
  impactEnd: number;
  subEntry: number;
  noteHz: number;
  kickTailHz: number;
  accent: number;
};

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * clamp(t);

export const ROOTS = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
export const SUB_LABELS = ["OFF", "ROOT", "5TH", "8VE"] as const;

export function midiToHz(midi: number) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function rootHz(root: number, octave: 1 | 2) {
  return midiToHz(24 + root + (octave - 1) * 12);
}

export function subStepHz(root: number, octave: 1 | 2, sub: SubStep) {
  const base = rootHz(root, octave);
  if (sub === 2) return base * 1.5;
  if (sub === 3) return base * 2;
  return base;
}

export const DEFAULT_PARAMS: BangerParams = {
  banger: 0.7,
  bump: 0.78,
  weight: 0.82,
  knock: 0.42,
  depth: 0.78,
  tail: 0.48,
  nest: 0.88,
  grit: 0.26,
  space: 0.08,
  system: 0.82,
};

function makeSteps(kicks: number[], accents: number[], subs: Record<number, SubStep>): BangerStep[] {
  return Array.from({ length: 16 }, (_, i) => ({
    kick: (accents.includes(i) ? 2 : kicks.includes(i) ? 1 : 0) as KickStep,
    sub: (subs[i] ?? 0) as SubStep,
  }));
}

export const DEFAULT_STEPS = makeSteps(
  [0, 3, 4, 7, 8, 11, 12, 14],
  [0, 8, 14],
  { 0: 1, 4: 1, 8: 2, 12: 1 },
);

export const PRESETS: BangerPreset[] = [
  {
    name: "CLUB",
    subtitle: "TIGHT IMPACT / CLEAN WEIGHT",
    bpm: 132,
    follow: "KICK",
    params: { banger: .72, bump: .78, weight: .84, knock: .44, depth: .78, tail: .42, nest: .92, grit: .24, space: .05, system: .86 },
    steps: makeSteps([0, 3, 4, 7, 8, 11, 12, 14], [0, 8, 14], { 0: 1, 4: 1, 8: 1, 12: 1 }),
  },
  {
    name: "TRUNK",
    subtitle: "LONG BOOM / SATURATED MASS",
    bpm: 102,
    follow: "KICK",
    params: { banger: .88, bump: .9, weight: .96, knock: .28, depth: .92, tail: .72, nest: .82, grit: .54, space: .03, system: 1 },
    steps: makeSteps([0, 4, 7, 8, 12, 15], [0, 8], { 0: 1, 4: 1, 8: 1, 12: 1 }),
  },
  {
    name: "WAREHOUSE",
    subtitle: "HARD BODY / CLIPPED IMPACT",
    bpm: 138,
    follow: "KICK",
    params: { banger: .84, bump: .82, weight: .7, knock: .66, depth: .64, tail: .34, nest: .84, grit: .68, space: .12, system: .76 },
    steps: makeSteps([0, 4, 8, 12], [0, 8], { 0: 1, 4: 1, 8: 1, 12: 1 }),
  },
  {
    name: "SOUNDSYSTEM",
    subtitle: "FAST KICK / HUGE FUNDAMENTAL",
    bpm: 92,
    follow: "BASS",
    params: { banger: .7, bump: .68, weight: 1, knock: .3, depth: 1, tail: .82, nest: .96, grit: .22, space: .18, system: 1 },
    steps: makeSteps([0, 4, 8, 12], [0, 12], { 0: 1, 3: 1, 6: 2, 8: 1, 11: 3, 14: 2 }),
  },
  {
    name: "RATTLER",
    subtitle: "UPPER HARMONICS / SMALL-SPEAKER READ",
    bpm: 118,
    follow: "KICK",
    params: { banger: .76, bump: .66, weight: .72, knock: .6, depth: .5, tail: .4, nest: .86, grit: .76, space: .06, system: .18 },
    steps: makeSteps([0, 2, 4, 7, 8, 10, 12, 15], [4, 12], { 0: 1, 4: 1, 8: 2, 12: 1 }),
  },
  {
    name: "CAVE",
    subtitle: "DEEP EVENT / UPPER-BAND BLOOM",
    bpm: 84,
    follow: "BASS",
    params: { banger: .64, bump: .74, weight: .92, knock: .26, depth: .94, tail: .9, nest: .86, grit: .3, space: .66, system: .9 },
    steps: makeSteps([0, 6, 8, 14], [0, 8], { 0: 1, 4: 1, 8: 2, 12: 1 }),
  },
  {
    name: "DRY AF",
    subtitle: "CLOSE / BRUTAL / NO BLOOM",
    bpm: 124,
    follow: "KICK",
    params: { banger: .8, bump: .88, weight: .78, knock: .74, depth: .68, tail: .24, nest: .94, grit: .62, space: 0, system: .72 },
    steps: makeSteps([0, 3, 4, 6, 8, 11, 12, 15], [0, 6, 12], { 0: 1, 4: 1, 8: 1, 12: 1 }),
  },
];

function makeDriveCurve(amount: number) {
  const n = 2048;
  const curve = new Float32Array(n);
  const k = 1 + clamp(amount) * 38;
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
  }
  return curve;
}

function makeShaper(ctx: AudioContext | OfflineAudioContext, drive: number) {
  const shaper = ctx.createWaveShaper();
  shaper.curve = makeDriveCurve(drive);
  shaper.oversample = "2x";
  return shaper;
}

export function buildBangerGraph(
  ctx: AudioContext | OfflineAudioContext,
  destination: AudioNode,
  main = 0.82,
): BangerGraph {
  const kickBus = ctx.createGain();
  const subBus = ctx.createGain();
  const knockBus = ctx.createGain();
  const spaceSend = ctx.createGain();
  const spaceReturn = ctx.createGain();
  const sum = ctx.createGain();
  const compressor = ctx.createDynamicsCompressor();
  const analyser = ctx.createAnalyser();
  const out = ctx.createGain();

  kickBus.gain.value = 1;
  subBus.gain.value = 1;
  knockBus.gain.value = 1;
  spaceSend.gain.value = 1;
  spaceReturn.gain.value = 1;
  sum.gain.value = 0.86;
  out.gain.value = main;

  const spaceHp = ctx.createBiquadFilter();
  spaceHp.type = "highpass";
  spaceHp.frequency.value = 240;
  spaceHp.Q.value = 0.65;
  const spaceDelay = ctx.createDelay(0.25);
  spaceDelay.delayTime.value = 0.047;
  const spaceLp = ctx.createBiquadFilter();
  spaceLp.type = "lowpass";
  spaceLp.frequency.value = 3600;
  const spaceFb = ctx.createGain();
  spaceFb.gain.value = 0.18;

  compressor.threshold.value = -11;
  compressor.knee.value = 10;
  compressor.ratio.value = 10;
  compressor.attack.value = 0.0025;
  compressor.release.value = 0.12;

  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.76;

  kickBus.connect(sum);
  subBus.connect(sum);
  knockBus.connect(sum);
  knockBus.connect(spaceSend);
  spaceSend.connect(spaceHp);
  spaceHp.connect(spaceDelay);
  spaceDelay.connect(spaceLp);
  spaceLp.connect(spaceReturn);
  spaceLp.connect(spaceFb);
  spaceFb.connect(spaceDelay);
  spaceReturn.connect(sum);
  sum.connect(compressor);
  compressor.connect(analyser);
  analyser.connect(out);
  out.connect(destination);

  return { kickBus, subBus, knockBus, spaceSend, spaceReturn, sum, compressor, analyser, out };
}

function safeExp(param: AudioParam, value: number, when: number) {
  param.exponentialRampToValueAtTime(Math.max(0.0001, value), when);
}

function stopNode(node: AudioScheduledSourceNode, when: number) {
  try { node.stop(when); } catch { /* already stopped */ }
}

function triggerKnock(
  ctx: AudioContext | OfflineAudioContext,
  graph: BangerGraph,
  p: BangerParams,
  when: number,
  accent: number,
) {
  const banger = Math.pow(clamp(p.banger), 1.35);
  const knock = clamp(p.knock * (0.72 + 0.48 * banger));
  if (knock < 0.005) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const hp = ctx.createBiquadFilter();
  const shaper = makeShaper(ctx, clamp(p.grit * 0.72 + banger * 0.18));

  osc.type = "triangle";
  osc.frequency.setValueAtTime(900 + knock * 900, when);
  osc.frequency.exponentialRampToValueAtTime(150 + knock * 180, when + 0.027 + knock * 0.018);

  hp.type = "highpass";
  hp.frequency.value = 95;
  hp.Q.value = 0.55;

  const amp = (0.07 + knock * 0.18) * accent;
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, amp), when + 0.0015);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.035 + knock * 0.035);

  osc.connect(shaper);
  shaper.connect(hp);
  hp.connect(gain);
  gain.connect(graph.knockBus);
  graph.spaceReturn.gain.setValueAtTime(0.04 + p.space * 0.34, when);

  osc.start(when);
  stopNode(osc, when + 0.12);
}

function triggerKickBody(
  ctx: AudioContext | OfflineAudioContext,
  graph: BangerGraph,
  p: BangerParams,
  when: number,
  noteHz: number,
  accent: number,
) {
  const banger = Math.pow(clamp(p.banger), 1.22);
  const nest = clamp(p.nest);
  const bump = clamp(p.bump * (0.78 + 0.42 * banger));
  const depth = clamp(p.depth);

  const independentTail = lerp(58, 43, depth);
  const kickTailHz = clamp(lerp(independentTail, noteHz, nest * 0.92), 27, 82);
  const startHz = 120 + 110 * p.knock + 46 * banger;
  const pitchDrop = lerp(0.072, 0.026, bump * 0.62 + nest * 0.38);
  const handoffMs = lerp(126, 42, nest) * lerp(1.08, 0.86, banger);
  const impactEnd = when + handoffMs / 1000;
  const tailSeconds = lerp(0.14, 0.52, p.tail) * lerp(0.92, 1.08, banger);
  const end = when + tailSeconds;

  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  const lp = ctx.createBiquadFilter();
  const pre = ctx.createGain();
  const shaper = makeShaper(ctx, clamp(p.grit * 0.82 + banger * 0.34));

  osc.type = "sine";
  osc.frequency.setValueAtTime(Math.max(kickTailHz + 2, startHz), when);
  osc.frequency.exponentialRampToValueAtTime(Math.max(24, kickTailHz), when + pitchDrop);
  osc.frequency.setValueAtTime(Math.max(24, kickTailHz), Math.min(end - 0.01, when + pitchDrop + 0.004));

  const kickPeak = (0.54 + bump * 0.55) * accent;
  amp.gain.setValueAtTime(0.0001, when);
  amp.gain.exponentialRampToValueAtTime(Math.max(0.0002, kickPeak), when + 0.0015);
  amp.gain.exponentialRampToValueAtTime(Math.max(0.0002, kickPeak * lerp(.56, .24, nest)), impactEnd);
  safeExp(amp.gain, 0.0001, Math.max(impactEnd + 0.018, end));

  lp.type = "lowpass";
  lp.frequency.value = 165 + p.knock * 130;
  lp.Q.value = 0.72;
  pre.gain.value = 0.9 + banger * 0.65 + p.grit * 0.45;

  osc.connect(pre);
  pre.connect(shaper);
  shaper.connect(lp);
  lp.connect(amp);
  amp.connect(graph.kickBus);

  osc.start(when);
  stopNode(osc, Math.max(end + 0.04, impactEnd + 0.06));

  triggerKnock(ctx, graph, p, when, accent);

  return { handoffMs, impactEnd, kickTailHz };
}

function triggerSubVoice(
  ctx: AudioContext | OfflineAudioContext,
  graph: BangerGraph,
  p: BangerParams,
  when: number,
  noteHz: number,
  accent: number,
  stepSeconds: number,
  impacted: boolean,
  handoffMs: number,
) {
  const banger = Math.pow(clamp(p.banger), 1.3);
  const nest = clamp(p.nest);
  const system = clamp(p.system);
  const weight = clamp(p.weight * (0.76 + 0.42 * banger));
  const tail = lerp(stepSeconds * .62, stepSeconds * 1.85, p.tail);
  const entry = impacted ? when + Math.max(0.022, handoffMs / 1000 * 0.72) : when + 0.004;
  const hold = Math.max(entry + 0.045, when + tail * 0.72);
  const end = Math.max(hold + 0.04, when + tail);

  const osc = ctx.createOscillator();
  const harmonic = ctx.createOscillator();
  const fundGain = ctx.createGain();
  const harmGain = ctx.createGain();
  const subAmp = ctx.createGain();
  const harmAmp = ctx.createGain();
  const lp = ctx.createBiquadFilter();
  const harmBp = ctx.createBiquadFilter();
  const shaper = makeShaper(ctx, clamp(p.grit * 0.72 + (1 - system) * 0.42 + banger * 0.18));

  osc.type = "sine";
  osc.frequency.setValueAtTime(Math.max(24, noteHz), when);
  harmonic.type = "triangle";
  harmonic.frequency.setValueAtTime(Math.max(48, noteHz * 2), when);

  fundGain.gain.value = (0.4 + system * 0.72) * weight * accent;
  harmGain.gain.value = (0.08 + (1 - system) * 0.44 + p.grit * 0.08) * weight * accent;

  subAmp.gain.setValueAtTime(0.0001, when);
  if (impacted) {
    subAmp.gain.setValueAtTime(0.0001, Math.max(when + 0.001, entry - 0.012));
    subAmp.gain.exponentialRampToValueAtTime(Math.max(0.0002, .76 + weight * .24), entry + 0.028 * (1 - nest * .45));
  } else {
    subAmp.gain.exponentialRampToValueAtTime(Math.max(0.0002, .7 + weight * .3), entry);
  }
  subAmp.gain.setValueAtTime(Math.max(0.0002, .7 + weight * .3), hold);
  safeExp(subAmp.gain, 0.0001, end);

  harmAmp.gain.setValueAtTime(0.0001, when);
  harmAmp.gain.exponentialRampToValueAtTime(1, impacted ? entry + 0.018 : entry);
  harmAmp.gain.setValueAtTime(1, hold);
  safeExp(harmAmp.gain, 0.0001, end);

  lp.type = "lowpass";
  lp.frequency.value = lerp(86, 142, 1 - p.depth) + system * 26;
  lp.Q.value = 0.45;
  harmBp.type = "bandpass";
  harmBp.frequency.value = Math.max(90, Math.min(320, noteHz * 2.3));
  harmBp.Q.value = 0.8;

  osc.connect(fundGain);
  fundGain.connect(lp);
  lp.connect(subAmp);
  subAmp.connect(graph.subBus);

  harmonic.connect(shaper);
  shaper.connect(harmBp);
  harmBp.connect(harmGain);
  harmGain.connect(harmAmp);
  harmAmp.connect(graph.subBus);

  osc.start(when);
  harmonic.start(when);
  stopNode(osc, end + 0.05);
  stopNode(harmonic, end + 0.05);

  return entry;
}

export function triggerBanger(
  ctx: AudioContext | OfflineAudioContext,
  graph: BangerGraph,
  snapshot: BangerSnapshot,
  when: number,
  kick: KickStep,
  sub: SubStep,
  stepSeconds: number,
): TriggerTelemetry | null {
  if (!kick && !sub) return null;

  const p = snapshot.params;
  const accent = kick === 2 ? 1.17 : 1;
  const subChoice = sub || 1;
  const noteHz = subStepHz(snapshot.root, snapshot.octave, subChoice as SubStep);

  let handoffMs = lerp(126, 42, p.nest);
  let impactEnd = when;
  let kickTailHz = noteHz;

  if (kick) {
    const k = triggerKickBody(ctx, graph, p, when, noteHz, accent);
    handoffMs = k.handoffMs;
    impactEnd = k.impactEnd;
    kickTailHz = k.kickTailHz;
  }

  const wantsSub = snapshot.follow === "KICK" ? Boolean(kick) : Boolean(sub);
  const subEntry = wantsSub
    ? triggerSubVoice(ctx, graph, p, when, noteHz, accent, stepSeconds, Boolean(kick), handoffMs)
    : when;

  return { when, handoffMs, impactEnd, subEntry, noteHz, kickTailHz, accent };
}

export function scheduleBangerStep(
  ctx: AudioContext | OfflineAudioContext,
  graph: BangerGraph,
  snapshot: BangerSnapshot,
  stepIndex: number,
  when: number,
) {
  const step = snapshot.steps[stepIndex % snapshot.steps.length];
  const stepSeconds = 60 / snapshot.bpm / 4;
  return triggerBanger(ctx, graph, snapshot, when, step.kick, step.sub, stepSeconds);
}

export function encodeWav(channels: Float32Array[], sampleRate: number, gain = 1) {
  const frames = channels[0]?.length ?? 0;
  const numChannels = channels.length;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const buffer = new ArrayBuffer(44 + frames * blockAlign);
  const view = new DataView(buffer);
  const write = (off: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };

  write(0, "RIFF");
  view.setUint32(4, 36 + frames * blockAlign, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, frames * blockAlign, true);

  let off = 44;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < numChannels; c++) {
      const s = clamp(channels[c][i] * gain, -1, 1);
      view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      off += 2;
    }
  }
  return buffer;
}
