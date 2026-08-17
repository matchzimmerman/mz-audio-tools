export type StreamId = "foundation" | "body" | "pulse" | "focus" | "grain" | "air";

export type EmergentParams = {
  density: number;
  entropy: number;
  energy: number;
  motion: number;
  spread: number;
  selfMix: number;
  space: number;
  output: number;
  bpm: number;
  root: number;
  mode: ModeName;
};

export type ModeName = "dorian" | "aeolian" | "minorPent" | "majorPent" | "open";

export const STREAMS: Array<{ id: StreamId; name: string; role: string; band: string }> = [
  { id: "foundation", name: "FOUNDATION", role: "LOW ANCHOR", band: "45–180 HZ" },
  { id: "body", name: "BODY", role: "MID MASS", band: "160–650 HZ" },
  { id: "pulse", name: "PULSE", role: "RHYTHMIC EDGE", band: "90–3K HZ" },
  { id: "focus", name: "FOCUS", role: "FOREGROUND", band: "350–4K HZ" },
  { id: "grain", name: "GRAIN", role: "TRANSIENT DETAIL", band: "1.5–8K HZ" },
  { id: "air", name: "AIR", role: "HIGH FIELD", band: "4–14K HZ" },
];

const SCALE: Record<ModeName, number[]> = {
  dorian: [0, 2, 3, 5, 7, 9, 10],
  aeolian: [0, 2, 3, 5, 7, 8, 10],
  minorPent: [0, 3, 5, 7, 10],
  majorPent: [0, 2, 4, 7, 9],
  open: [0, 2, 5, 7, 9],
};

const DEFAULTS: EmergentParams = {
  density: 0.55,
  entropy: 0.48,
  energy: 0.58,
  motion: 0.45,
  spread: 0.78,
  selfMix: 0.82,
  space: 0.32,
  output: 0.58,
  bpm: 84,
  root: 0,
  mode: "dorian",
};

const OVERLAP = [
  [0, .72, .45, .15, .05, .02],
  [.72, 0, .55, .62, .20, .08],
  [.45, .55, 0, .48, .52, .18],
  [.15, .62, .48, 0, .58, .35],
  [.05, .20, .52, .58, 0, .68],
  [.02, .08, .18, .35, .68, 0],
];
const PRIORITY = [1.0, .82, .92, 1.08, .72, .58];
const DUCKABILITY = [.18, .45, .28, .22, .72, .82];
const MAX_PAN = [.12, .42, .68, .76, .96, 1.0];

function clamp(v: number, a = 0, b = 1) { return Math.max(a, Math.min(b, v)); }
function midiToHz(n: number) { return 440 * Math.pow(2, (n - 69) / 12); }
function rand(a = 0, b = 1) { return a + Math.random() * (b - a); }

class StreamVoice {
  input: GainNode;
  duck: GainNode;
  analyser: AnalyserNode;
  panner: StereoPannerNode;
  send: GainNode;
  meterBuffer: Float32Array;
  pan = 0;
  panTarget = 0;
  sectionGain = .5;
  sectionTarget = .5;
  density = .5;
  densityTarget = .5;
  duckDb = 0;

  constructor(ctx: AudioContext, dry: AudioNode, reverb: AudioNode) {
    this.input = ctx.createGain();
    this.duck = ctx.createGain();
    this.analyser = ctx.createAnalyser();
    this.panner = ctx.createStereoPanner();
    this.send = ctx.createGain();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = .6;
    this.meterBuffer = new Float32Array(this.analyser.fftSize);

    this.input.connect(this.duck);
    this.duck.connect(this.analyser);
    this.analyser.connect(this.panner);
    this.panner.connect(dry);
    this.panner.connect(this.send);
    this.send.connect(reverb);
  }

  rms() {
    this.analyser.getFloatTimeDomainData(this.meterBuffer as Float32Array<ArrayBuffer>);
    let sum = 0;
    for (let i = 0; i < this.meterBuffer.length; i += 1) sum += this.meterBuffer[i] * this.meterBuffer[i];
    return Math.sqrt(sum / this.meterBuffer.length);
  }
}

export class EmergentFieldEngine {
  private ctx: AudioContext | null = null;
  private dry: GainNode | null = null;
  private wet: GainNode | null = null;
  private convolver: ConvolverNode | null = null;
  private master: GainNode | null = null;
  private limiter: DynamicsCompressorNode | null = null;
  private voices: StreamVoice[] = [];
  private noise: AudioBuffer | null = null;
  private timer: number | null = null;
  private running = false;
  private params: EmergentParams = { ...DEFAULTS };
  private nextBeat = 0;
  private sceneStarted = 0;
  private sceneDuration = 12;
  private pressure = 0;
  private adaptiveDensity = DEFAULTS.density;
  private phase = 0;

  async start() {
    if (!this.ctx) this.init();
    if (!this.ctx || !this.master) return;
    await this.ctx.resume();
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(this.params.output, now, .03);
    this.nextBeat = now + .04;
    this.sceneStarted = now;
    this.newScene(true);
    if (this.timer === null) this.timer = window.setInterval(() => this.tick(), 35);
    this.running = true;
  }

  stop() {
    if (!this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(0.0001, now, .035);
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    this.running = false;
  }

  destroy() {
    this.stop();
    this.ctx?.close();
    this.ctx = null;
    this.voices = [];
  }

  setParams(next: Partial<EmergentParams>) {
    this.params = { ...this.params, ...next };
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.wet?.gain.setTargetAtTime(.02 + this.params.space * .42, now, .08);
    this.voices.forEach((v, i) => {
      v.send.gain.setTargetAtTime((.05 + this.params.space * .45) * (.55 + i * .08), now, .08);
    });
    if (this.running && this.master) this.master.gain.setTargetAtTime(this.params.output, now, .04);
  }

  mutate() {
    if (!this.ctx) return;
    this.newScene(true);
    this.phase += rand(.8, 4.2);
    this.nextBeat = Math.min(this.nextBeat, this.ctx.currentTime + .03);
  }

  getTelemetry() {
    const levels = this.voices.map((v) => clamp(v.rms() * 3.4));
    return {
      running: this.running,
      levels,
      pans: this.voices.map((v) => v.pan),
      ducks: this.voices.map((v) => v.duckDb),
      pressure: this.pressure,
      adaptiveDensity: this.adaptiveDensity,
      bpm: this.params.bpm,
      sceneProgress: this.ctx ? clamp((this.ctx.currentTime - this.sceneStarted) / this.sceneDuration) : 0,
    };
  }

  private init() {
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) throw new Error("Web Audio is unavailable in this browser.");
    const ctx = new AudioContextClass();
    this.ctx = ctx;

    this.dry = ctx.createGain();
    this.wet = ctx.createGain();
    this.master = ctx.createGain();
    this.limiter = ctx.createDynamicsCompressor();
    this.convolver = ctx.createConvolver();
    this.noise = this.makeNoiseBuffer(ctx, 2.5);
    this.convolver.buffer = this.makeImpulse(ctx, 2.2, 2.8);

    this.dry.gain.value = .76;
    this.wet.gain.value = .02 + this.params.space * .42;
    this.master.gain.value = .0001;
    this.limiter.threshold.value = -8;
    this.limiter.knee.value = 6;
    this.limiter.ratio.value = 7;
    this.limiter.attack.value = .004;
    this.limiter.release.value = .16;

    this.dry.connect(this.master);
    this.convolver.connect(this.wet);
    this.wet.connect(this.master);
    this.master.connect(this.limiter);
    this.limiter.connect(ctx.destination);

    this.voices = STREAMS.map((_, i) => {
      const v = new StreamVoice(ctx, this.dry!, this.convolver!);
      v.send.gain.value = (.05 + this.params.space * .45) * (.55 + i * .08);
      return v;
    });
  }

  private makeNoiseBuffer(ctx: AudioContext, seconds: number) {
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i += 1) {
      const white = Math.random() * 2 - 1;
      last = last * .94 + white * .06;
      data[i] = white * .72 + last * .28;
    }
    return buffer;
  }

  private makeImpulse(ctx: AudioContext, seconds: number, decay: number) {
    const length = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch += 1) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < length; i += 1) {
        const t = i / length;
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay) * (ch ? .93 : 1);
      }
    }
    return buffer;
  }

  private newScene(force = false) {
    if (!this.ctx) return;
    const entropy = this.params.entropy;
    const focal = Math.floor(rand(0, STREAMS.length));
    this.sceneStarted = this.ctx.currentTime;
    const beats = rand(12, 30) * (1.15 - entropy * .35);
    this.sceneDuration = beats * 60 / Math.max(36, this.params.bpm);
    this.voices.forEach((v, i) => {
      const roleBias = i === focal ? rand(.72, 1) : rand(.16, .78);
      const continuity = force ? 0 : v.sectionTarget * .28;
      v.sectionTarget = clamp(roleBias * (.72 + this.params.energy * .42) + continuity);
      v.densityTarget = clamp(rand(.18, .92) * (.58 + this.params.density * .72));
      if (i === 0) v.densityTarget *= .62;
      if (i === 5) v.densityTarget *= .72;
    });
  }

  private tick() {
    if (!this.ctx || !this.running) return;
    const now = this.ctx.currentTime;
    if (now - this.sceneStarted >= this.sceneDuration) this.newScene();

    const rms = this.voices.map((v) => v.rms());
    const weighted = rms.reduce((sum, value, i) => sum + Math.min(.34, value) * (.85 + i * .035), 0);
    this.pressure += (clamp(weighted * 1.65) - this.pressure) * .16;
    const self = this.params.selfMix;
    this.adaptiveDensity = clamp(this.params.density * (1 - this.pressure * self * .62), .08, 1);

    this.applyMixNegotiation(now, rms);
    this.moveField(now);

    const beatSeconds = 60 / Math.max(36, this.params.bpm);
    const subdivision = beatSeconds / 2;
    while (this.nextBeat < now + .14) {
      this.scheduleStep(this.nextBeat, subdivision);
      this.nextBeat += subdivision;
    }
  }

  private applyMixNegotiation(now: number, rms: number[]) {
    this.voices.forEach((v, i) => {
      let competition = 0;
      for (let j = 0; j < rms.length; j += 1) {
        if (i === j) continue;
        const priorityDelta = Math.max(.3, PRIORITY[j] / PRIORITY[i]);
        competition += Math.min(.42, rms[j] * 3.2) * OVERLAP[i][j] * priorityDelta;
      }
      const reduction = clamp(competition * DUCKABILITY[i] * this.params.selfMix, 0, .78);
      const target = 1 - reduction;
      v.duck.gain.setTargetAtTime(target, now, target < v.duck.gain.value ? .016 : .11);
      v.duckDb = 20 * Math.log10(Math.max(.001, target));
      v.sectionGain += (v.sectionTarget - v.sectionGain) * .012;
      v.density += (v.densityTarget - v.density) * .01;
    });
  }

  private moveField(now: number) {
    this.phase += .004 + this.params.motion * .013;
    this.voices.forEach((v, i) => {
      if (Math.random() < .012 + this.params.motion * .018) v.panTarget = this.choosePan(i);
      const drift = Math.sin(this.phase * (.52 + i * .071) + i * 1.7) * .18 * this.params.motion;
      const target = clamp(v.panTarget + drift, -1, 1);
      v.pan += (target - v.pan) * (.018 + this.params.motion * .025);
      v.panner.pan.setTargetAtTime(v.pan, now, .045);
    });
  }

  private choosePan(index: number) {
    const width = MAX_PAN[index] * this.params.spread;
    let best = 0;
    let bestScore = -1;
    for (let k = 0; k < 7; k += 1) {
      const candidate = rand(-width, width);
      let score = 0;
      this.voices.forEach((other, j) => {
        if (j !== index) score += Math.abs(candidate - other.panTarget) * (OVERLAP[index][j] + .2);
      });
      if (score > bestScore) { bestScore = score; best = candidate; }
    }
    return best;
  }

  private scheduleStep(time: number, step: number) {
    const syncAccent = Math.sin((time * this.params.bpm / 60) * Math.PI) > .45 ? 1.12 : .88;
    this.voices.forEach((v, i) => {
      const roleDensity = v.density * this.adaptiveDensity * v.sectionGain;
      const chance = clamp(roleDensity * [.36, .46, .58, .42, .34, .22][i] * syncAccent);
      if (Math.random() < chance) this.trigger(i, time, step);
    });
  }

  private degree(octave: number, entropyShift = 0) {
    const scale = SCALE[this.params.mode];
    const pick = scale[Math.floor(rand(0, scale.length))] ?? 0;
    const mutation = Math.random() < this.params.entropy * .16 ? Math.round(rand(-2, 2)) : 0;
    return 48 + this.params.root + octave * 12 + pick + mutation + entropyShift;
  }

  private trigger(index: number, time: number, step: number) {
    const v = this.voices[index];
    const amp = clamp((.11 + this.params.energy * .18) * v.sectionGain * rand(.72, 1.12), .025, .42);
    if (index === 0) this.tone(v, time, midiToHz(this.degree(-1)), step * rand(1.2, 3.2), amp, "sine", .018);
    else if (index === 1) this.tone(v, time, midiToHz(this.degree(0)), step * rand(.8, 2.4), amp * .8, "triangle", .012);
    else if (index === 2) {
      const hz = midiToHz(this.degree(-1 + (Math.random() < .45 ? 1 : 0)));
      this.tone(v, time, hz, step * rand(.16, .46), amp * .74, Math.random() < .5 ? "square" : "sine", .004, true);
    } else if (index === 3) {
      const hz = midiToHz(this.degree(1));
      this.tone(v, time, hz, step * rand(.5, 1.9), amp * .66, Math.random() < .45 ? "sawtooth" : "triangle", .008, true);
    } else if (index === 4) this.noiseEvent(v, time, step * rand(.08, .38), amp * .54, rand(1800, 6200), rand(4, 12));
    else this.noiseEvent(v, time, step * rand(1.2, 4.0), amp * .28, rand(5000, 10500), rand(.7, 2.2));
  }

  private tone(v: StreamVoice, time: number, hz: number, dur: number, amp: number, type: OscillatorType, attack: number, glide = false) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    osc.type = type;
    osc.frequency.setValueAtTime(hz, time);
    if (glide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, hz * rand(.88, 1.18)), time + Math.max(.03, dur * .72));
    filter.type = "lowpass";
    filter.frequency.value = Math.min(12000, Math.max(500, hz * rand(3.4, 7.2)));
    filter.Q.value = rand(.2, 2.2);
    gain.gain.setValueAtTime(.0001, time);
    gain.gain.exponentialRampToValueAtTime(Math.max(.001, amp), time + attack);
    gain.gain.exponentialRampToValueAtTime(.0001, time + Math.max(attack + .025, dur));
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(v.input);
    osc.start(time);
    osc.stop(time + dur + .06);
    osc.onended = () => { osc.disconnect(); filter.disconnect(); gain.disconnect(); };
  }

  private noiseEvent(v: StreamVoice, time: number, dur: number, amp: number, hz: number, q: number) {
    if (!this.ctx || !this.noise) return;
    const src = this.ctx.createBufferSource();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    src.buffer = this.noise;
    src.loop = dur > this.noise.duration * .9;
    src.playbackRate.value = rand(.72, 1.35);
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(hz, time);
    filter.frequency.exponentialRampToValueAtTime(Math.max(300, hz * rand(.7, 1.42)), time + Math.max(.05, dur));
    filter.Q.value = q;
    gain.gain.setValueAtTime(.0001, time);
    gain.gain.exponentialRampToValueAtTime(Math.max(.001, amp), time + Math.min(.04, dur * .25));
    gain.gain.exponentialRampToValueAtTime(.0001, time + Math.max(.06, dur));
    src.connect(filter);
    filter.connect(gain);
    gain.connect(v.input);
    src.start(time, rand(0, Math.max(.01, this.noise.duration - .2)));
    src.stop(time + dur + .08);
    src.onended = () => { src.disconnect(); filter.disconnect(); gain.disconnect(); };
  }
}
