export type CallModel = "warble" | "rattle" | "whistle" | "swarm";

export type EngineParams = {
  call: number;
  tone: number;
  grain: number;
  glide: number;
  flutter: number;
  scatter: number;
  space: number;
  delay: number;
  field: number;
};

export type TriggerOptions = {
  midi: number;
  velocity?: number;
  duration?: number;
  pan?: number;
  when?: number;
};

const floor = 0.0001;
const midiToHz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

export class MagpieEngine {
  readonly context: AudioContext;
  readonly analyser: AnalyserNode;
  readonly recordStream: MediaStream;

  private input: GainNode;
  private dry: GainNode;
  private wet: GainNode;
  private convolver: ConvolverNode;
  private delay: DelayNode;
  private delayWet: GainNode;
  private feedback: GainNode;
  private compressor: DynamicsCompressorNode;
  private recorderDestination: MediaStreamAudioDestinationNode;
  private fieldSource: AudioBufferSourceNode;
  private fieldFilter: BiquadFilterNode;
  private fieldGain: GainNode;
  private fieldPan: StereoPannerNode;
  private fieldLfo: OscillatorNode;
  private fieldLfoDepth: GainNode;
  private noiseBuffer: AudioBuffer;
  private params: EngineParams;
  private model: CallModel = "warble";
  private bpm = 112;

  constructor(context: AudioContext, params: EngineParams) {
    this.context = context;
    this.params = params;
    this.noiseBuffer = this.createNoiseBuffer(4);

    this.input = context.createGain();
    this.dry = context.createGain();
    this.wet = context.createGain();
    this.convolver = context.createConvolver();
    this.delay = context.createDelay(2);
    this.delayWet = context.createGain();
    this.feedback = context.createGain();
    this.compressor = context.createDynamicsCompressor();
    this.analyser = context.createAnalyser();
    this.recorderDestination = context.createMediaStreamDestination();

    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.72;
    this.convolver.buffer = this.createImpulse(2.8, 2.6);
    this.compressor.threshold.value = -16;
    this.compressor.knee.value = 14;
    this.compressor.ratio.value = 7;
    this.compressor.attack.value = 0.003;
    this.compressor.release.value = 0.16;

    this.input.connect(this.dry);
    this.dry.connect(this.compressor);
    this.input.connect(this.convolver);
    this.convolver.connect(this.wet);
    this.wet.connect(this.compressor);
    this.input.connect(this.delay);
    this.delay.connect(this.feedback);
    this.feedback.connect(this.delay);
    this.delay.connect(this.delayWet);
    this.delayWet.connect(this.compressor);
    this.compressor.connect(this.analyser);
    this.analyser.connect(context.destination);
    this.analyser.connect(this.recorderDestination);
    this.recordStream = this.recorderDestination.stream;

    this.fieldFilter = context.createBiquadFilter();
    this.fieldGain = context.createGain();
    this.fieldPan = context.createStereoPanner();
    this.fieldLfo = context.createOscillator();
    this.fieldLfoDepth = context.createGain();
    this.fieldSource = context.createBufferSource();
    this.fieldSource.buffer = this.noiseBuffer;
    this.fieldSource.loop = true;
    this.fieldFilter.type = "bandpass";
    this.fieldLfo.type = "sine";
    this.fieldLfo.frequency.value = 0.055;
    this.fieldLfo.connect(this.fieldLfoDepth);
    this.fieldLfoDepth.connect(this.fieldPan.pan);
    this.fieldSource.connect(this.fieldFilter);
    this.fieldFilter.connect(this.fieldGain);
    this.fieldGain.connect(this.fieldPan);
    this.fieldPan.connect(this.input);
    this.fieldSource.start();
    this.fieldLfo.start();
    this.setParams(params, this.bpm, this.model);
  }

  setParams(params: EngineParams, bpm = this.bpm, model = this.model) {
    this.params = params;
    this.bpm = bpm;
    this.model = model;
    const now = this.context.currentTime;
    const smooth = (node: AudioParam, value: number) => node.setTargetAtTime(value, now, 0.025);
    const beat = 60 / Math.max(60, bpm);
    smooth(this.delay.delayTime, Math.min(1.6, beat * (0.25 + params.delay / 92)));
    smooth(this.feedback.gain, 0.06 + params.delay * 0.0054);
    smooth(this.delayWet.gain, 0.04 + params.delay * 0.0034);
    smooth(this.wet.gain, 0.03 + params.space * 0.0072);
    smooth(this.dry.gain, 0.88 - params.space * 0.0018);
    smooth(this.fieldGain.gain, Math.pow(params.field / 100, 1.7) * 0.085);
    smooth(this.fieldFilter.frequency, 260 + params.tone * 20);
    smooth(this.fieldFilter.Q, 0.45 + params.grain / 80);
    smooth(this.fieldLfoDepth.gain, 0.15 + params.scatter / 125);
  }

  trigger({ midi, velocity = 0.82, duration, pan, when }: TriggerOptions) {
    const intensity = Math.max(0.08, Math.min(1, velocity));
    const stereo = Math.max(-1, Math.min(1, pan ?? (Math.random() * 2 - 1) * this.params.scatter / 120));
    const start = Math.max(this.context.currentTime, when ?? this.context.currentTime);
    const mainDuration = duration ?? (this.model === "rattle" ? 0.38 : this.model === "whistle" ? 0.68 : this.model === "swarm" ? 1.18 : 0.52);
    this.renderVoice(midi, intensity, mainDuration, stereo, start);
    const scatterVoices = Math.floor(this.params.scatter / 34) + (Math.random() < (this.params.scatter % 34) / 34 ? 1 : 0);
    const intervals = [7, 12, -5];
    for (let index = 0; index < Math.min(3, scatterVoices); index++) {
      this.renderVoice(
        midi + intervals[index],
        intensity * (0.42 - index * 0.06),
        mainDuration * (0.74 + index * 0.09),
        Math.max(-1, Math.min(1, (index % 2 ? -1 : 1) * (0.58 + this.params.scatter / 280))),
        start + 0.075 + index * (0.065 + this.params.glide / 1600),
      );
    }
  }

  private renderVoice(midi: number, velocity: number, duration: number, pan: number, start: number) {
    if (this.model === "rattle") this.rattle(midi, velocity, duration, pan, start);
    else if (this.model === "whistle") this.whistle(midi, velocity, duration, pan, start);
    else if (this.model === "swarm") this.swarm(midi, velocity, duration, pan, start);
    else this.warble(midi, velocity, duration, pan, start);
  }

  dispose() {
    const now = this.context.currentTime;
    this.fieldGain.gain.setTargetAtTime(floor, now, 0.02);
    this.fieldSource.stop(now + 0.08);
    this.fieldLfo.stop(now + 0.08);
  }

  private createNoiseBuffer(seconds: number) {
    const length = Math.floor(this.context.sampleRate * seconds);
    const buffer = this.context.createBuffer(2, length, this.context.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      let brown = 0;
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        brown = (brown + 0.018 * white) / 1.018;
        data[i] = Math.max(-1, Math.min(1, white * 0.34 + brown * 3.1));
      }
    }
    return buffer;
  }

  private createImpulse(seconds: number, decay: number) {
    const length = Math.floor(this.context.sampleRate * seconds);
    const impulse = this.context.createBuffer(2, length, this.context.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const data = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        const envelope = Math.pow(1 - i / length, decay);
        data[i] = (Math.random() * 2 - 1) * envelope * (i < 80 ? i / 80 : 1);
      }
      [0.031, 0.067, 0.113, 0.179].forEach((time, index) => {
        const position = Math.floor(time * this.context.sampleRate);
        if (position < length) data[position] += (0.7 - index * 0.12) * (channel ? -1 : 1);
      });
    }
    return impulse;
  }

  private voiceOutput(pan: number) {
    const panner = this.context.createStereoPanner();
    panner.pan.value = pan;
    panner.connect(this.input);
    return panner;
  }

  private envelope(gain: AudioParam, now: number, attack: number, peak: number, duration: number, release = duration * 0.42) {
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(floor, now);
    gain.exponentialRampToValueAtTime(Math.max(floor, peak), now + attack);
    gain.setTargetAtTime(floor, now + Math.max(attack + 0.02, duration - release), Math.max(0.012, release / 5));
  }

  private warble(midi: number, velocity: number, duration: number, pan: number, now: number) {
    const { context: ctx, params: p } = this;
    const base = midiToHz(midi);
    const output = this.voiceOutput(pan);
    const amp = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const carrier = ctx.createOscillator();
    const harmonic = ctx.createOscillator();
    const harmonicGain = ctx.createGain();
    const lfo = ctx.createOscillator();
    const lfoDepth = ctx.createGain();
    const air = ctx.createBufferSource();
    const airFilter = ctx.createBiquadFilter();
    const airGain = ctx.createGain();
    const start = base * (0.72 + p.glide / 260);
    const crest = base * (1.04 + p.call / 145);

    carrier.type = p.grain > 70 ? "sawtooth" : "triangle";
    carrier.frequency.setValueAtTime(start, now);
    carrier.frequency.exponentialRampToValueAtTime(crest, now + duration * 0.28);
    carrier.frequency.exponentialRampToValueAtTime(base * (0.92 + p.glide / 520), now + duration);
    harmonic.type = "sine";
    harmonic.frequency.setValueAtTime(base * (1.98 + p.tone / 2600), now);
    harmonicGain.gain.value = 0.04 + p.tone / 820;
    lfo.frequency.value = 3.2 + p.flutter * 0.18;
    lfoDepth.gain.value = base * (0.002 + p.flutter * 0.00135);
    filter.type = "bandpass";
    filter.frequency.value = 850 + p.tone * 38;
    filter.Q.value = 1.5 + p.grain / 13;
    air.buffer = this.noiseBuffer;
    airFilter.type = "highpass";
    airFilter.frequency.value = 1600 + p.tone * 25;
    this.envelope(amp.gain, now, 0.008 + (100 - p.call) / 9000, 0.2 * velocity, duration);
    this.envelope(airGain.gain, now, 0.004, (0.005 + p.grain / 1250) * velocity, duration * 0.72);

    lfo.connect(lfoDepth); lfoDepth.connect(carrier.frequency);
    carrier.connect(filter); harmonic.connect(harmonicGain); harmonicGain.connect(filter);
    filter.connect(amp); air.connect(airFilter); airFilter.connect(airGain); airGain.connect(amp); amp.connect(output);
    carrier.start(now); harmonic.start(now); lfo.start(now); air.start(now);
    const stop = now + duration + 0.16;
    carrier.stop(stop); harmonic.stop(stop); lfo.stop(stop); air.stop(stop);
  }

  private whistle(midi: number, velocity: number, duration: number, pan: number, now: number) {
    const { context: ctx, params: p } = this;
    const base = midiToHz(midi + 12);
    const output = this.voiceOutput(pan);
    const amp = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const carrier = ctx.createOscillator();
    const overtone = ctx.createOscillator();
    const overtoneGain = ctx.createGain();
    const vibrato = ctx.createOscillator();
    const vibratoDepth = ctx.createGain();
    carrier.type = "sine";
    overtone.type = "sine";
    const rise = base * (1.1 + p.glide / 120);
    carrier.frequency.setValueAtTime(base * (0.84 + p.call / 620), now);
    carrier.frequency.exponentialRampToValueAtTime(rise, now + duration * 0.36);
    carrier.frequency.exponentialRampToValueAtTime(base * (0.98 + p.call / 800), now + duration);
    overtone.frequency.setValueAtTime(base * 2.005, now);
    overtoneGain.gain.value = 0.015 + p.tone / 1400;
    vibrato.frequency.value = 4.5 + p.flutter * 0.14;
    vibratoDepth.gain.value = base * (0.001 + p.flutter / 17000);
    filter.type = "lowpass"; filter.frequency.value = 2100 + p.tone * 75; filter.Q.value = 0.8 + p.grain / 28;
    this.envelope(amp.gain, now, 0.014 + (100 - p.call) / 2400, 0.15 * velocity, duration, duration * 0.48);
    vibrato.connect(vibratoDepth); vibratoDepth.connect(carrier.frequency);
    carrier.connect(filter); overtone.connect(overtoneGain); overtoneGain.connect(filter); filter.connect(amp); amp.connect(output);
    carrier.start(now); overtone.start(now); vibrato.start(now);
    const stop = now + duration + 0.2; carrier.stop(stop); overtone.stop(stop); vibrato.stop(stop);
  }

  private rattle(midi: number, velocity: number, duration: number, pan: number, now: number) {
    const { context: ctx, params: p } = this;
    const base = midiToHz(midi);
    const output = this.voiceOutput(pan);
    const amp = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const noise = ctx.createBufferSource();
    const metalA = ctx.createOscillator();
    const metalB = ctx.createOscillator();
    const metalGain = ctx.createGain();
    const pulseCount = 3 + Math.floor(p.call / 12);
    const spacing = duration / pulseCount;
    noise.buffer = this.noiseBuffer;
    filter.type = "bandpass"; filter.frequency.value = 620 + p.tone * 44; filter.Q.value = 2 + p.grain / 8;
    metalA.type = "square"; metalB.type = "triangle";
    metalA.frequency.value = base * (2.13 + p.glide / 480);
    metalB.frequency.value = base * (3.71 + p.flutter / 350);
    metalGain.gain.value = 0.018 + p.tone / 1900;
    amp.gain.setValueAtTime(floor, now);
    for (let i = 0; i < pulseCount; i++) {
      const t = now + i * spacing;
      const peak = (0.11 + Math.random() * 0.07) * velocity;
      amp.gain.setValueAtTime(floor, t);
      amp.gain.exponentialRampToValueAtTime(peak, t + Math.min(0.008, spacing * 0.3));
      amp.gain.exponentialRampToValueAtTime(floor, t + spacing * (0.5 + p.grain / 230));
    }
    noise.connect(filter); metalA.connect(metalGain); metalB.connect(metalGain); metalGain.connect(filter); filter.connect(amp); amp.connect(output);
    noise.start(now); metalA.start(now); metalB.start(now);
    const stop = now + duration + 0.08; noise.stop(stop); metalA.stop(stop); metalB.stop(stop);
  }

  private swarm(midi: number, velocity: number, duration: number, pan: number, now: number) {
    const { context: ctx, params: p } = this;
    const base = midiToHz(midi);
    const ratios = [1, 1.503, 1.997, 2.813, 3.98];
    ratios.forEach((ratio, index) => {
      const oscillator = ctx.createOscillator();
      const amp = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      const panner = this.voiceOutput(Math.max(-1, Math.min(1, pan + (index - 2) * 0.2)));
      oscillator.type = index % 2 ? "sine" : "triangle";
      oscillator.frequency.setValueAtTime(base * ratio * (0.992 + Math.random() * 0.016), now);
      oscillator.frequency.exponentialRampToValueAtTime(base * ratio * (1 + p.glide / 520), now + duration);
      filter.type = "bandpass"; filter.frequency.value = Math.min(11000, base * ratio * (1.4 + p.tone / 90)); filter.Q.value = 1.2 + p.grain / 25;
      this.envelope(amp.gain, now + index * 0.018, 0.018 + index * 0.009, (0.072 / (1 + index * 0.38)) * velocity, duration, duration * 0.65);
      oscillator.connect(filter); filter.connect(amp); amp.connect(panner); oscillator.start(now + index * 0.018); oscillator.stop(now + duration + 0.45);
    });
  }
}
