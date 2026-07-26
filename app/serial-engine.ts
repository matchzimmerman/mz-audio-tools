export type Waveform = "sine" | "triangle" | "sawtooth" | "square";

export type EffectType = "filter" | "drive" | "tremolo" | "delay" | "reverb";

export type EffectModule = {
  id: string;
  type: EffectType;
  enabled: boolean;
  params: Record<string, number>;
};

export type ControlSpec = {
  key: string;
  label: string;
  unit: string;
  format: (value: number) => string;
};

export type EffectDefinition = {
  name: string;
  code: string;
  verb: string;
  description: string;
  listenFor: string;
  defaults: Record<string, number>;
  controls: ControlSpec[];
};

const percent = (value: number) => `${Math.round(value)}%`;

export const EFFECTS: Record<EffectType, EffectDefinition> = {
  filter: {
    name: "FILTER",
    code: "FLT",
    verb: "SCULPT",
    description: "Removes high frequencies so the signal feels darker and more distant.",
    listenFor: "Lower CUTOFF until the bright edges disappear. RESONANCE emphasizes the cutoff point.",
    defaults: { cutoff: 62, resonance: 18 },
    controls: [
      { key: "cutoff", label: "CUTOFF", unit: "HZ", format: (value) => `${Math.round(180 * Math.pow(50, value / 100))} Hz` },
      { key: "resonance", label: "RESONANCE", unit: "%", format: percent },
    ],
  },
  drive: {
    name: "DRIVE",
    code: "DRV",
    verb: "SATURATE",
    description: "Adds harmonics by rounding and clipping the signal’s peaks.",
    listenFor: "Raise GAIN for grit. Moving DRIVE before DELAY repeats the distortion; moving it after distorts every echo together.",
    defaults: { gain: 34, tone: 58 },
    controls: [
      { key: "gain", label: "GAIN", unit: "%", format: percent },
      { key: "tone", label: "TONE", unit: "%", format: percent },
    ],
  },
  tremolo: {
    name: "TREMOLO",
    code: "TRM",
    verb: "PULSE",
    description: "Moves the volume up and down at a steady rate.",
    listenFor: "DEPTH controls how far the volume falls. RATE controls how quickly the pulse repeats.",
    defaults: { rate: 38, depth: 56 },
    controls: [
      { key: "rate", label: "RATE", unit: "HZ", format: (value) => `${(0.35 * Math.pow(34.3, value / 100)).toFixed(1)} Hz` },
      { key: "depth", label: "DEPTH", unit: "%", format: percent },
    ],
  },
  delay: {
    name: "DELAY",
    code: "DLY",
    verb: "REPEAT",
    description: "Records a short moment and feeds it back as a fading echo.",
    listenFor: "TIME sets the gap between echoes. FEEDBACK decides how many repeats survive.",
    defaults: { time: 42, feedback: 38, mix: 34 },
    controls: [
      { key: "time", label: "TIME", unit: "MS", format: (value) => `${Math.round(45 + 700 * Math.pow(value / 100, 1.5))} ms` },
      { key: "feedback", label: "FEEDBACK", unit: "%", format: percent },
      { key: "mix", label: "MIX", unit: "%", format: percent },
    ],
  },
  reverb: {
    name: "REVERB",
    code: "RVB",
    verb: "PLACE",
    description: "Adds many dense reflections so the signal appears to occupy a room.",
    listenFor: "SPACE changes the room’s pre-delay and brightness. MIX blends the reflected signal with the source.",
    defaults: { space: 54, mix: 30 },
    controls: [
      { key: "space", label: "SPACE", unit: "%", format: percent },
      { key: "mix", label: "MIX", unit: "%", format: percent },
    ],
  },
};

const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));

export const makeEffect = (type: EffectType, id = `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`): EffectModule => ({
  id,
  type,
  enabled: true,
  params: { ...EFFECTS[type].defaults },
});

export class SignalChainEngine {
  readonly context: AudioContext;
  readonly analyser: AnalyserNode;

  private oscillator: OscillatorNode;
  private sourceGain: GainNode;
  private compressor: DynamicsCompressorNode;
  private master: GainNode;
  private effectNodes: AudioNode[] = [];
  private modulators: OscillatorNode[] = [];
  private impulse: AudioBuffer;
  private sounding = false;

  constructor(context: AudioContext) {
    this.context = context;
    this.oscillator = context.createOscillator();
    this.sourceGain = context.createGain();
    this.compressor = context.createDynamicsCompressor();
    this.analyser = context.createAnalyser();
    this.master = context.createGain();
    this.impulse = this.createImpulse(2.25, 2.7);

    this.oscillator.type = "sawtooth";
    this.oscillator.frequency.value = 110;
    this.sourceGain.gain.value = 0.0001;
    this.compressor.threshold.value = -20;
    this.compressor.knee.value = 18;
    this.compressor.ratio.value = 12;
    this.compressor.attack.value = 0.003;
    this.compressor.release.value = 0.19;
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.76;
    this.master.gain.value = 0.56;

    this.compressor.connect(this.analyser);
    this.analyser.connect(this.master);
    this.master.connect(context.destination);
    this.oscillator.connect(this.sourceGain);
    this.sourceGain.connect(this.compressor);
    this.oscillator.start();
  }

  setSource(waveform: Waveform, frequency: number, level: number) {
    const now = this.context.currentTime;
    this.oscillator.type = waveform;
    this.oscillator.frequency.setTargetAtTime(Math.max(40, Math.min(880, frequency)), now, 0.018);
    const target = this.sounding ? 0.035 + Math.pow(clamp(level / 100), 1.45) * 0.22 : 0.0001;
    this.sourceGain.gain.setTargetAtTime(target, now, 0.025);
  }

  setSounding(sounding: boolean, level: number) {
    this.sounding = sounding;
    const target = sounding ? 0.035 + Math.pow(clamp(level / 100), 1.45) * 0.22 : 0.0001;
    this.sourceGain.gain.setTargetAtTime(target, this.context.currentTime, sounding ? 0.028 : 0.012);
  }

  setChain(modules: EffectModule[]) {
    this.sourceGain.disconnect();
    this.effectNodes.forEach((node) => node.disconnect());
    this.modulators.forEach((oscillator) => {
      try { oscillator.stop(); } catch { /* oscillator already stopped */ }
      oscillator.disconnect();
    });
    this.effectNodes = [];
    this.modulators = [];

    let tail: AudioNode = this.sourceGain;
    for (const effect of modules) {
      if (!effect.enabled) continue;
      const next = this.buildEffect(effect);
      tail.connect(next.input);
      tail = next.output;
    }
    tail.connect(this.compressor);
  }

  dispose() {
    const now = this.context.currentTime;
    this.sourceGain.gain.setTargetAtTime(0.0001, now, 0.01);
    this.oscillator.stop(now + 0.08);
    this.modulators.forEach((oscillator) => {
      try { oscillator.stop(now + 0.08); } catch { /* oscillator already stopped */ }
    });
  }

  private remember<T extends AudioNode>(node: T) {
    this.effectNodes.push(node);
    return node;
  }

  private buildEffect(effect: EffectModule): { input: AudioNode; output: AudioNode } {
    const value = (key: string) => clamp((effect.params[key] ?? 0) / 100);

    if (effect.type === "filter") {
      const filter = this.remember(this.context.createBiquadFilter());
      filter.type = "lowpass";
      filter.frequency.value = 180 * Math.pow(50, value("cutoff"));
      filter.Q.value = 0.7 + Math.pow(value("resonance"), 2) * 15;
      return { input: filter, output: filter };
    }

    if (effect.type === "drive") {
      const pre = this.remember(this.context.createGain());
      const shaper = this.remember(this.context.createWaveShaper());
      const tone = this.remember(this.context.createBiquadFilter());
      const trim = this.remember(this.context.createGain());
      const amount = value("gain");
      pre.gain.value = 1 + Math.pow(amount, 1.45) * 20;
      shaper.curve = this.driveCurve(1.5 + amount * 10);
      shaper.oversample = "2x";
      tone.type = "lowpass";
      tone.frequency.value = 850 + Math.pow(value("tone"), 1.35) * 7200;
      trim.gain.value = 0.72 - amount * 0.24;
      pre.connect(shaper);
      shaper.connect(tone);
      tone.connect(trim);
      return { input: pre, output: trim };
    }

    if (effect.type === "tremolo") {
      const gain = this.remember(this.context.createGain());
      const depth = this.remember(this.context.createGain());
      const lfo = this.context.createOscillator();
      const amount = Math.pow(value("depth"), 1.35);
      gain.gain.value = 1 - amount * 0.52;
      depth.gain.value = amount * 0.48;
      lfo.type = "sine";
      lfo.frequency.value = 0.35 * Math.pow(34.3, value("rate"));
      lfo.connect(depth);
      depth.connect(gain.gain);
      lfo.start();
      this.modulators.push(lfo);
      return { input: gain, output: gain };
    }

    if (effect.type === "delay") {
      const input = this.remember(this.context.createGain());
      const delay = this.remember(this.context.createDelay(1));
      const feedback = this.remember(this.context.createGain());
      const damp = this.remember(this.context.createBiquadFilter());
      const dry = this.remember(this.context.createGain());
      const wet = this.remember(this.context.createGain());
      const output = this.remember(this.context.createGain());
      const mix = value("mix") * 0.68;
      delay.delayTime.value = 0.045 + 0.7 * Math.pow(value("time"), 1.5);
      feedback.gain.value = 0.05 + value("feedback") * 0.64;
      damp.type = "lowpass";
      damp.frequency.value = 4200;
      dry.gain.value = 1 - mix * 0.38;
      wet.gain.value = mix;
      input.connect(dry);
      dry.connect(output);
      input.connect(delay);
      delay.connect(damp);
      damp.connect(feedback);
      feedback.connect(delay);
      damp.connect(wet);
      wet.connect(output);
      return { input, output };
    }

    const input = this.remember(this.context.createGain());
    const dry = this.remember(this.context.createGain());
    const predelay = this.remember(this.context.createDelay(0.16));
    const convolver = this.remember(this.context.createConvolver());
    const damp = this.remember(this.context.createBiquadFilter());
    const wet = this.remember(this.context.createGain());
    const output = this.remember(this.context.createGain());
    const mix = value("mix") * 0.68;
    dry.gain.value = 1 - mix * 0.42;
    predelay.delayTime.value = value("space") * 0.105;
    convolver.buffer = this.impulse;
    damp.type = "lowpass";
    damp.frequency.value = 2600 + value("space") * 5200;
    wet.gain.value = mix;
    input.connect(dry);
    dry.connect(output);
    input.connect(predelay);
    predelay.connect(convolver);
    convolver.connect(damp);
    damp.connect(wet);
    wet.connect(output);
    return { input, output };
  }

  private driveCurve(amount: number) {
    const samples = 1024;
    const curve = new Float32Array(samples);
    const norm = Math.tanh(amount);
    for (let index = 0; index < samples; index++) {
      const x = (index / (samples - 1)) * 2 - 1;
      curve[index] = Math.tanh(x * amount) / norm;
    }
    return curve;
  }

  private createImpulse(seconds: number, decay: number) {
    const length = Math.floor(this.context.sampleRate * seconds);
    const buffer = this.context.createBuffer(2, length, this.context.sampleRate);
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const data = buffer.getChannelData(channel);
      let previous = 0;
      for (let index = 0; index < length; index++) {
        const white = Math.random() * 2 - 1;
        previous = previous * 0.62 + white * 0.38;
        data[index] = previous * Math.pow(1 - index / length, decay);
      }
    }
    return buffer;
  }
}
