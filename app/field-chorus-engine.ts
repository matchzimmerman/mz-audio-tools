export type ChannelId =
  | "cardinal"
  | "woodThrush"
  | "woodPewee"
  | "barredOwl"
  | "springPeeper"
  | "chorusFrog"
  | "greenFrog"
  | "bullfrog"
  | "cicada"
  | "crickets"
  | "stream"
  | "wind";

export type Season = "winter" | "earlySpring" | "lateSpring" | "summer" | "fall";
export type Habitat = "forest" | "edge" | "wetWoods" | "reservoir" | "river" | "vernal";
export type Region = "piedmont" | "susquehanna" | "delmarva" | "appalachian";

export type ChannelDefinition = {
  id: ChannelId;
  name: string;
  group: "BIRD" | "FROG" | "INSECT" | "PLACE";
  note: string;
  rateHz: number;
  seasons: Record<Season, number>;
  habitats: Partial<Record<Habitat, number>>;
  regions?: Partial<Record<Region, number>>;
  daily: "dawn" | "day" | "dawnDusk" | "duskNight" | "nightPlusDay" | "night" | "all";
  continuous?: boolean;
};

export const CHANNELS: ChannelDefinition[] = [
  {
    id: "cardinal",
    name: "Northern Cardinal",
    group: "BIRD",
    note: "clear accelerating whistles",
    rateHz: 0.12,
    seasons: { winter: 0.45, earlySpring: 1, lateSpring: 0.95, summer: 0.7, fall: 0.4 },
    habitats: { forest: 0.55, edge: 1, wetWoods: 0.55, reservoir: 0.45, river: 0.55, vernal: 0.35 },
    daily: "dawnDusk",
  },
  {
    id: "woodThrush",
    name: "Wood Thrush",
    group: "BIRD",
    note: "flute-like forest phrase",
    rateHz: 0.085,
    seasons: { winter: 0, earlySpring: 0.08, lateSpring: 1, summer: 0.8, fall: 0.08 },
    habitats: { forest: 1, edge: 0.35, wetWoods: 0.8, reservoir: 0.45, river: 0.75, vernal: 0.5 },
    daily: "dawnDusk",
  },
  {
    id: "woodPewee",
    name: "Eastern Wood-Pewee",
    group: "BIRD",
    note: "slurred pee-a-wee glide",
    rateHz: 0.07,
    seasons: { winter: 0, earlySpring: 0, lateSpring: 0.75, summer: 1, fall: 0.08 },
    habitats: { forest: 1, edge: 0.7, wetWoods: 0.65, reservoir: 0.45, river: 0.75, vernal: 0.35 },
    daily: "day",
  },
  {
    id: "barredOwl",
    name: "Barred Owl",
    group: "BIRD",
    note: "low eight-note hoot phrase",
    rateHz: 0.022,
    seasons: { winter: 0.65, earlySpring: 0.85, lateSpring: 0.75, summer: 0.55, fall: 0.6 },
    habitats: { forest: 0.8, edge: 0.35, wetWoods: 1, reservoir: 0.8, river: 1, vernal: 0.55 },
    daily: "night",
  },
  {
    id: "springPeeper",
    name: "Spring Peeper",
    group: "FROG",
    note: "high single peep chorus",
    rateHz: 1.8,
    seasons: { winter: 0.08, earlySpring: 1, lateSpring: 0.25, summer: 0.02, fall: 0 },
    habitats: { forest: 0.1, edge: 0.2, wetWoods: 0.85, reservoir: 0.25, river: 0.15, vernal: 1 },
    daily: "nightPlusDay",
  },
  {
    id: "chorusFrog",
    name: "Chorus Frogs",
    group: "FROG",
    note: "ascending comb-like trill",
    rateHz: 0.9,
    seasons: { winter: 0.05, earlySpring: 1, lateSpring: 0.18, summer: 0, fall: 0 },
    habitats: { forest: 0.08, edge: 0.25, wetWoods: 0.8, reservoir: 0.15, river: 0.12, vernal: 1 },
    regions: { piedmont: 0.9, susquehanna: 0.8, delmarva: 1, appalachian: 0.75 },
    daily: "nightPlusDay",
  },
  {
    id: "greenFrog",
    name: "Green Frog",
    group: "FROG",
    note: "broken banjo-string note",
    rateHz: 0.25,
    seasons: { winter: 0, earlySpring: 0.05, lateSpring: 0.75, summer: 1, fall: 0.12 },
    habitats: { forest: 0.05, edge: 0.12, wetWoods: 0.65, reservoir: 1, river: 0.9, vernal: 0.22 },
    daily: "nightPlusDay",
  },
  {
    id: "bullfrog",
    name: "American Bullfrog",
    group: "FROG",
    note: "deep jug-o-rum pulse",
    rateHz: 0.11,
    seasons: { winter: 0, earlySpring: 0, lateSpring: 0.45, summer: 1, fall: 0.08 },
    habitats: { forest: 0, edge: 0.08, wetWoods: 0.25, reservoir: 1, river: 0.75, vernal: 0.08 },
    daily: "nightPlusDay",
  },
  {
    id: "cicada",
    name: "Annual Cicadas",
    group: "INSECT",
    note: "hot daytime treetop buzz",
    rateHz: 0,
    seasons: { winter: 0, earlySpring: 0, lateSpring: 0.08, summer: 1, fall: 0.12 },
    habitats: { forest: 1, edge: 0.9, wetWoods: 0.7, reservoir: 0.55, river: 0.65, vernal: 0.35 },
    daily: "day",
    continuous: true,
  },
  {
    id: "crickets",
    name: "Crickets + Katydids",
    group: "INSECT",
    note: "night chirps and rasping pulses",
    rateHz: 3.2,
    seasons: { winter: 0, earlySpring: 0.02, lateSpring: 0.28, summer: 1, fall: 0.65 },
    habitats: { forest: 0.7, edge: 1, wetWoods: 0.8, reservoir: 0.85, river: 0.8, vernal: 0.6 },
    daily: "duskNight",
  },
  {
    id: "stream",
    name: "Moving Water",
    group: "PLACE",
    note: "broadband stream / river bed",
    rateHz: 0,
    seasons: { winter: 0.8, earlySpring: 1, lateSpring: 0.9, summer: 0.65, fall: 0.8 },
    habitats: { forest: 0.04, edge: 0.03, wetWoods: 0.12, reservoir: 0.08, river: 1, vernal: 0.02 },
    daily: "all",
    continuous: true,
  },
  {
    id: "wind",
    name: "Canopy Wind",
    group: "PLACE",
    note: "low filtered leaf-noise bed",
    rateHz: 0,
    seasons: { winter: 0.85, earlySpring: 0.65, lateSpring: 0.55, summer: 0.45, fall: 1 },
    habitats: { forest: 0.75, edge: 1, wetWoods: 0.6, reservoir: 0.8, river: 0.8, vernal: 0.55 },
    daily: "all",
    continuous: true,
  },
];

const channelMap = new Map(CHANNELS.map((channel) => [channel.id, channel]));

function clamp(value: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function wrappedDistance(a: number, b: number) {
  const raw = Math.abs(a - b);
  return Math.min(raw, 24 - raw);
}

function gaussianHour(hour: number, center: number, width: number) {
  const d = wrappedDistance(hour, center);
  return Math.exp(-(d * d) / (2 * width * width));
}

function dailyWeight(profile: ChannelDefinition["daily"], hour: number) {
  const dawn = gaussianHour(hour, 6, 1.7);
  const dusk = gaussianHour(hour, 19.5, 1.8);
  const midday = gaussianHour(hour, 13, 4.8);
  const midnight = Math.max(gaussianHour(hour, 0.5, 3.5), gaussianHour(hour, 23.5, 3.5));

  switch (profile) {
    case "dawn":
      return clamp(0.06 + dawn * 0.94);
    case "day":
      return clamp(0.05 + Math.max(dawn * 0.55, midday));
    case "dawnDusk":
      return clamp(0.04 + Math.max(dawn, dusk * 0.55));
    case "duskNight":
      return clamp(0.03 + Math.max(dusk, midnight * 0.9));
    case "nightPlusDay":
      return clamp(0.24 + Math.max(dusk, midnight * 0.9) * 0.76);
    case "night":
      return clamp(0.025 + Math.max(dusk * 0.45, midnight));
    case "all":
    default:
      return 0.92;
  }
}

export function ecologicalActivity(
  id: ChannelId,
  season: Season,
  habitat: Habitat,
  region: Region,
  hour: number,
) {
  const channel = channelMap.get(id);
  if (!channel) return 0;
  const seasonWeight = channel.seasons[season] ?? 0;
  const habitatWeight = channel.habitats[habitat] ?? 0;
  const regionWeight = channel.regions?.[region] ?? 1;
  const timeWeight = dailyWeight(channel.daily, hour);
  return clamp(Math.pow(seasonWeight * habitatWeight * regionWeight * timeWeight, 0.78));
}

type AudioChannel = {
  input: GainNode;
  analyser: AnalyserNode;
  fader: GainNode;
  meterData: Float32Array<ArrayBuffer>;
};

type ContinuousVoice = {
  sources: AudioScheduledSourceNode[];
  nodes: AudioNode[];
};

export class FieldChorusEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private limiter: DynamicsCompressorNode | null = null;
  private channels = new Map<ChannelId, AudioChannel>();
  private continuous = new Map<ChannelId, ContinuousVoice>();
  private scheduler: ReturnType<typeof setInterval> | null = null;
  private active = false;
  private masterLevel = 0.75;
  private faderValues = new Map<ChannelId, number>(CHANNELS.map((channel) => [channel.id, 0]));
  private activityProvider: (() => Record<ChannelId, number>) | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  async start() {
    if (!this.ctx) this.createGraph();
    if (!this.ctx) return;
    await this.ctx.resume();
    this.active = true;
    if (!this.scheduler) this.scheduler = setInterval(() => this.scheduleTick(), 120);
  }

  stop() {
    this.active = false;
    if (this.ctx) this.ctx.suspend();
  }

  destroy() {
    if (this.scheduler) clearInterval(this.scheduler);
    this.scheduler = null;
    for (const voice of this.continuous.values()) {
      voice.sources.forEach((source) => {
        try {
          source.stop();
        } catch {}
      });
      voice.nodes.forEach((node) => {
        try {
          node.disconnect();
        } catch {}
      });
    }
    this.continuous.clear();
    void this.ctx?.close();
    this.ctx = null;
    this.noiseBuffer = null;
    this.channels.clear();
  }

  setActivityProvider(provider: () => Record<ChannelId, number>) {
    this.activityProvider = provider;
  }

  setMaster(value: number) {
    this.masterLevel = clamp(value);
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(this.masterLevel, this.ctx.currentTime, 0.03);
  }

  setFader(id: ChannelId, value: number) {
    const normalized = clamp(value);
    this.faderValues.set(id, normalized);
    const channel = this.channels.get(id);
    if (channel && this.ctx) {
      const shaped = normalized * normalized * 0.95;
      channel.fader.gain.setTargetAtTime(shaped, this.ctx.currentTime, 0.05);
    }
  }

  getMeter(id: ChannelId) {
    const channel = this.channels.get(id);
    if (!channel || !this.ctx || this.ctx.state !== "running") return 0;
    channel.analyser.getFloatTimeDomainData(channel.meterData);
    let sum = 0;
    for (let i = 0; i < channel.meterData.length; i += 1) {
      const sample = channel.meterData[i] ?? 0;
      sum += sample * sample;
    }
    const rms = Math.sqrt(sum / channel.meterData.length);
    return clamp(rms * 4.5);
  }

  private createGraph() {
    this.ctx = new AudioContext({ latencyHint: "interactive" });
    this.master = this.ctx.createGain();
    this.master.gain.value = this.masterLevel;

    this.limiter = this.ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -9;
    this.limiter.knee.value = 9;
    this.limiter.ratio.value = 8;
    this.limiter.attack.value = 0.006;
    this.limiter.release.value = 0.22;

    this.master.connect(this.limiter);
    this.limiter.connect(this.ctx.destination);

    CHANNELS.forEach((definition) => {
      if (!this.ctx || !this.master) return;
      const input = this.ctx.createGain();
      const analyser = this.ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.68;
      const fader = this.ctx.createGain();
      const cached = this.faderValues.get(definition.id) ?? 0;
      fader.gain.value = cached * cached * 0.95;
      input.connect(analyser);
      analyser.connect(fader);
      fader.connect(this.master);
      this.channels.set(definition.id, {
        input,
        analyser,
        fader,
        meterData: new Float32Array(analyser.fftSize),
      });
    });

    this.createContinuousVoices();
  }

  private createContinuousVoices() {
    if (!this.ctx) return;
    this.createCicadaBed();
    this.createNoiseBed("stream", 150, 5200, 0.2);
    this.createNoiseBed("wind", 35, 900, 0.15);
  }

  private createNoiseBuffer() {
    if (!this.ctx) throw new Error("Audio context unavailable");
    if (this.noiseBuffer) return this.noiseBuffer;
    const length = this.ctx.sampleRate * 3;
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let previous = 0;
    for (let i = 0; i < data.length; i += 1) {
      const white = Math.random() * 2 - 1;
      previous = previous * 0.985 + white * 0.015;
      data[i] = white * 0.72 + previous * 0.28;
    }
    this.noiseBuffer = buffer;
    return buffer;
  }

  private createNoiseBed(id: ChannelId, highpassHz: number, lowpassHz: number, level: number) {
    if (!this.ctx) return;
    const channel = this.channels.get(id);
    if (!channel) return;

    const source = this.ctx.createBufferSource();
    source.buffer = this.createNoiseBuffer();
    source.loop = true;
    const highpass = this.ctx.createBiquadFilter();
    highpass.type = "highpass";
    highpass.frequency.value = highpassHz;
    const lowpass = this.ctx.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.value = lowpassHz;
    lowpass.Q.value = 0.35;
    const levelNode = this.ctx.createGain();
    levelNode.gain.value = level;

    source.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(levelNode);
    levelNode.connect(channel.input);
    source.start();

    this.continuous.set(id, {
      sources: [source],
      nodes: [highpass, lowpass, levelNode],
    });
  }

  private createCicadaBed() {
    if (!this.ctx) return;
    const channel = this.channels.get("cicada");
    if (!channel) return;

    const source = this.ctx.createBufferSource();
    source.buffer = this.createNoiseBuffer();
    source.loop = true;
    const band = this.ctx.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = 5650;
    band.Q.value = 1.2;
    const shimmer = this.ctx.createGain();
    shimmer.gain.value = 0.075;
    const lfo = this.ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 92;
    const lfoDepth = this.ctx.createGain();
    lfoDepth.gain.value = 0.045;

    source.connect(band);
    band.connect(shimmer);
    shimmer.connect(channel.input);
    lfo.connect(lfoDepth);
    lfoDepth.connect(shimmer.gain);
    source.start();
    lfo.start();

    this.continuous.set("cicada", {
      sources: [source, lfo],
      nodes: [band, shimmer, lfoDepth],
    });
  }

  private scheduleTick() {
    if (!this.active || !this.ctx || this.ctx.state !== "running") return;
    const activity = this.activityProvider?.();
    if (!activity) return;
    const dt = 0.12;

    CHANNELS.forEach((definition) => {
      if (definition.continuous || definition.rateHz <= 0) return;
      const amount = clamp(activity[definition.id] ?? 0);
      if (amount <= 0.012) return;
      const chance = 1 - Math.exp(-definition.rateHz * amount * dt);
      if (Math.random() < chance) this.trigger(definition.id, amount);
    });
  }

  private connectVoice(nodes: AudioNode[], id: ChannelId) {
    const channel = this.channels.get(id);
    if (!channel || nodes.length === 0) return;
    nodes[nodes.length - 1]?.connect(channel.input);
  }

  private envelope(gain: GainNode, start: number, duration: number, peak: number, attack = 0.02) {
    gain.gain.cancelScheduledValues(start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), start + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  }

  private tone(
    id: ChannelId,
    start: number,
    duration: number,
    frequency: number,
    endFrequency: number,
    peak: number,
    type: OscillatorType = "sine",
  ) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(35, frequency), start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(35, endFrequency), start + duration * 0.82);
    this.envelope(gain, start, duration, peak, Math.min(0.025, duration * 0.25));
    osc.connect(gain);
    this.connectVoice([gain], id);
    osc.start(start);
    osc.stop(start + duration + 0.04);
  }

  private noiseBurst(id: ChannelId, start: number, duration: number, frequency: number, peak: number, q = 5) {
    if (!this.ctx) return;
    const source = this.ctx.createBufferSource();
    source.buffer = this.createNoiseBuffer();
    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = frequency;
    filter.Q.value = q;
    const gain = this.ctx.createGain();
    this.envelope(gain, start, duration, peak, 0.008);
    source.connect(filter);
    filter.connect(gain);
    this.connectVoice([gain], id);
    source.start(start);
    source.stop(start + duration + 0.04);
  }

  private trigger(id: ChannelId, amount: number) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime + 0.012;
    const dynamic = 0.55 + amount * 0.45;

    switch (id) {
      case "cardinal": {
        const base = 2180 + Math.random() * 220;
        for (let i = 0; i < 4; i += 1) {
          const t = now + i * 0.16;
          this.tone(id, t, 0.12, base + i * 30, base * 0.74, 0.075 * dynamic, "sine");
        }
        break;
      }
      case "woodThrush": {
        const offset = Math.random() * 130;
        this.tone(id, now, 0.22, 920 + offset, 1220 + offset, 0.08 * dynamic, "sine");
        this.tone(id, now + 0.2, 0.2, 1530 + offset, 1120 + offset, 0.065 * dynamic, "sine");
        this.tone(id, now + 0.4, 0.22, 2050 + offset, 2520 + offset, 0.045 * dynamic, "sine");
        break;
      }
      case "woodPewee": {
        this.tone(id, now, 0.48, 1420, 910, 0.06 * dynamic, "sine");
        if (Math.random() > 0.4) this.tone(id, now + 0.72, 0.42, 930, 1320, 0.05 * dynamic, "sine");
        break;
      }
      case "barredOwl": {
        const pattern = [285, 315, 270, 250, 292, 330, 305, 245];
        pattern.forEach((freq, index) => {
          this.tone(id, now + index * 0.27, 0.19, freq, freq * 0.93, 0.09 * dynamic, "sine");
          this.tone(id, now + index * 0.27, 0.19, freq * 1.52, freq * 1.46, 0.025 * dynamic, "triangle");
        });
        break;
      }
      case "springPeeper": {
        const freq = 2680 + Math.random() * 420;
        this.tone(id, now, 0.09 + Math.random() * 0.035, freq, freq * 1.04, 0.035 * dynamic, "sine");
        break;
      }
      case "chorusFrog": {
        this.tone(id, now, 0.28, 1120 + Math.random() * 180, 1740 + Math.random() * 220, 0.045 * dynamic, "sawtooth");
        break;
      }
      case "greenFrog": {
        const freq = 170 + Math.random() * 35;
        this.tone(id, now, 0.27, freq, freq * 0.84, 0.12 * dynamic, "sine");
        this.tone(id, now, 0.18, freq * 2.1, freq * 1.75, 0.04 * dynamic, "triangle");
        break;
      }
      case "bullfrog": {
        this.tone(id, now, 0.42, 108, 83, 0.16 * dynamic, "sine");
        this.tone(id, now + 0.18, 0.34, 142, 104, 0.075 * dynamic, "triangle");
        break;
      }
      case "crickets": {
        const freq = 3850 + Math.random() * 1500;
        const pulses = Math.random() > 0.55 ? 5 : 3;
        for (let i = 0; i < pulses; i += 1) {
          this.noiseBurst(id, now + i * 0.045, 0.018, freq, 0.038 * dynamic, 7);
        }
        break;
      }
      default:
        break;
    }
  }
}
