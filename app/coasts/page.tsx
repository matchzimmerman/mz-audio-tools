"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";

type Mode = "east" | "west";
type EastPatch = {
  name: string;
  osc1: OscillatorType;
  osc2: OscillatorType;
  detune: number;
  balance: number;
  cutoff: number;
  resonance: number;
  filterEnv: number;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
};
type WestPatch = {
  name: string;
  ratio: number;
  fm: number;
  fold: number;
  symmetry: number;
  rise: number;
  fall: number;
  loop: boolean;
  uncertainty: number;
  color: number;
  ring: number;
};
type AudioRig = {
  ctx: AudioContext;
  input: GainNode;
  master: GainNode;
  analyser: AnalyserNode;
};
type ActiveVoice = {
  midi: number;
  release: () => void;
  stop: () => void;
};

const EAST_PATCHES: EastPatch[] = [
  { name: "FOUNDATION", osc1: "sawtooth", osc2: "square", detune: 7, balance: 42, cutoff: 56, resonance: 36, filterEnv: 68, attack: 4, decay: 34, sustain: 61, release: 28 },
  { name: "BRASS STUDY", osc1: "sawtooth", osc2: "sawtooth", detune: 11, balance: 50, cutoff: 44, resonance: 21, filterEnv: 82, attack: 9, decay: 52, sustain: 48, release: 22 },
  { name: "ROUND BASS", osc1: "square", osc2: "triangle", detune: -12, balance: 63, cutoff: 31, resonance: 48, filterEnv: 54, attack: 1, decay: 29, sustain: 72, release: 17 },
];

const WEST_PATCHES: WestPatch[] = [
  { name: "FOLD PLUCK", ratio: 2, fm: 34, fold: 62, symmetry: 50, rise: 3, fall: 38, loop: false, uncertainty: 8, color: 72, ring: 34 },
  { name: "METAL OBJECT", ratio: 3, fm: 78, fold: 84, symmetry: 64, rise: 1, fall: 24, loop: false, uncertainty: 18, color: 81, ring: 22 },
  { name: "UNCERTAIN FIELD", ratio: 1.5, fm: 42, fold: 48, symmetry: 38, rise: 17, fall: 68, loop: true, uncertainty: 64, color: 54, ring: 67 },
];

const EAST_KEYS = [
  { midi: 60, note: "C", code: "KeyA", key: "A" },
  { midi: 61, note: "C♯", code: "KeyW", key: "W", black: true },
  { midi: 62, note: "D", code: "KeyS", key: "S" },
  { midi: 63, note: "D♯", code: "KeyE", key: "E", black: true },
  { midi: 64, note: "E", code: "KeyD", key: "D" },
  { midi: 65, note: "F", code: "KeyF", key: "F" },
  { midi: 66, note: "F♯", code: "KeyT", key: "T", black: true },
  { midi: 67, note: "G", code: "KeyG", key: "G" },
  { midi: 68, note: "G♯", code: "KeyY", key: "Y", black: true },
  { midi: 69, note: "A", code: "KeyH", key: "H" },
  { midi: 70, note: "A♯", code: "KeyU", key: "U", black: true },
  { midi: 71, note: "B", code: "KeyJ", key: "J" },
  { midi: 72, note: "C", code: "KeyK", key: "K" },
];

const WEST_PLATES = [
  { midi: 48, note: "C2", code: "KeyA", key: "A" },
  { midi: 50, note: "D2", code: "KeyS", key: "S" },
  { midi: 51, note: "E♭2", code: "KeyD", key: "D" },
  { midi: 55, note: "G2", code: "KeyF", key: "F" },
  { midi: 57, note: "A2", code: "KeyG", key: "G" },
  { midi: 60, note: "C3", code: "KeyH", key: "H" },
  { midi: 62, note: "D3", code: "KeyJ", key: "J" },
  { midi: 63, note: "E♭3", code: "KeyK", key: "K" },
];

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const midiToHz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
const cutoffFromControl = (value: number) => Math.min(16000, 38 * 2 ** (value / 11.5));
const timeFromControl = (value: number, min: number, max: number) => min * (max / min) ** (value / 100);
const holdParam = (param: AudioParam, time: number) => {
  if ("cancelAndHoldAtTime" in param) param.cancelAndHoldAtTime(time);
  else {
    const current = param.value;
    param.cancelScheduledValues(time);
    param.setValueAtTime(current, time);
  }
};

function makeFoldCurve(fold: number, symmetry: number) {
  const samples = 4096;
  const curve = new Float32Array(samples);
  const drive = 1 + (fold / 100) * 9;
  const bias = ((symmetry - 50) / 50) * 0.34;
  for (let i = 0; i < samples; i += 1) {
    const x = (i / (samples - 1)) * 2 - 1;
    const shifted = Math.max(-1.5, Math.min(1.5, x + bias));
    curve[i] = Math.sin(shifted * drive * Math.PI * 0.5) * 0.86;
  }
  return curve;
}

function Knob({ label, value, onChange, format = (v) => String(Math.round(v)).padStart(3, "0") }: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
}) {
  return (
    <label className="co-knob-control">
      <span className="co-knob" style={{ "--turn": `${-132 + value * 2.64}deg` } as CSSProperties}>
        <input aria-label={label} type="range" min="0" max="100" value={value} onChange={(event) => onChange(Number(event.target.value))} />
        <i />
      </span>
      <span className="co-readout">{format(value)}</span>
      <b>{label}</b>
    </label>
  );
}

function ModuleHeader({ index, title, subtitle, code }: { index: string; title: string; subtitle: string; code: string }) {
  return (
    <div className="co-module-head">
      <span className="co-index">{index}</span>
      <span><strong>{title}</strong><small>{subtitle}</small></span>
      <em>{code}</em>
    </div>
  );
}

function Choice<T extends string | number>({ label, value, options, onChange }: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="co-choice">
      <legend>{label}</legend>
      <div>
        {options.map((option) => (
          <button key={String(option.value)} type="button" className={value === option.value ? "active" : ""} onClick={() => onChange(option.value)}>
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export default function CoastsPage() {
  const [mode, setMode] = useState<Mode>("east");
  const [east, setEast] = useState<EastPatch>(EAST_PATCHES[0]);
  const [west, setWest] = useState<WestPatch>(WEST_PATCHES[0]);
  const [powered, setPowered] = useState(false);
  const [activeMidi, setActiveMidi] = useState<number | null>(null);
  const [level, setLevel] = useState(0);
  const [status, setStatus] = useState("READY / AUDIO SUSPENDED");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rigRef = useRef<AudioRig | null>(null);
  const voiceRef = useRef<ActiveVoice | null>(null);
  const pressedRef = useRef(new Set<string>());

  const ensureRig = useCallback(async () => {
    if (!rigRef.current) {
      const ctx = new AudioContext();
      const input = ctx.createGain();
      const compressor = ctx.createDynamicsCompressor();
      const master = ctx.createGain();
      const analyser = ctx.createAnalyser();
      input.gain.value = 0.82;
      compressor.threshold.value = -20;
      compressor.knee.value = 18;
      compressor.ratio.value = 10;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.2;
      master.gain.value = 0.58;
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.74;
      input.connect(compressor).connect(master).connect(analyser).connect(ctx.destination);
      rigRef.current = { ctx, input, master, analyser };
    }
    if (rigRef.current.ctx.state !== "running") await rigRef.current.ctx.resume();
    setPowered(true);
    setStatus("SYSTEM ONLINE / MONOPHONIC");
    return rigRef.current;
  }, []);

  const stopVoice = useCallback((hard = false) => {
    const voice = voiceRef.current;
    if (!voice) return;
    if (hard) voice.stop();
    else voice.release();
    voiceRef.current = null;
    setActiveMidi(null);
  }, []);

  const startEastVoice = useCallback((rig: AudioRig, midi: number) => {
    const { ctx, input } = rig;
    const now = ctx.currentTime;
    const frequency = midiToHz(midi);
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    const gain2 = ctx.createGain();
    const filter1 = ctx.createBiquadFilter();
    const filter2 = ctx.createBiquadFilter();
    const amp = ctx.createGain();
    const balance = east.balance / 100;
    const baseCutoff = cutoffFromControl(east.cutoff);
    const peakCutoff = Math.min(18000, baseCutoff * (1 + east.filterEnv / 8));
    const attack = timeFromControl(east.attack, 0.004, 1.7);
    const decay = timeFromControl(east.decay, 0.025, 2.4);
    const release = timeFromControl(east.release, 0.025, 3.2);
    const sustain = Math.max(0.03, east.sustain / 100);

    osc1.type = east.osc1;
    osc2.type = east.osc2;
    osc1.frequency.value = frequency;
    osc2.frequency.value = frequency;
    osc2.detune.value = east.detune;
    gain1.gain.value = Math.cos(balance * Math.PI * 0.5) * 0.48;
    gain2.gain.value = Math.sin(balance * Math.PI * 0.5) * 0.48;
    filter1.type = "lowpass";
    filter2.type = "lowpass";
    filter1.Q.value = 0.8 + east.resonance * 0.105;
    filter2.Q.value = 0.35 + east.resonance * 0.035;
    amp.gain.setValueAtTime(0.0001, now);
    amp.gain.linearRampToValueAtTime(0.68, now + attack);
    amp.gain.exponentialRampToValueAtTime(Math.max(0.001, 0.68 * sustain), now + attack + decay);
    [filter1, filter2].forEach((filter) => {
      filter.frequency.setValueAtTime(Math.max(40, baseCutoff), now);
      filter.frequency.exponentialRampToValueAtTime(Math.max(41, peakCutoff), now + Math.max(0.01, attack));
      filter.frequency.exponentialRampToValueAtTime(Math.max(40, baseCutoff), now + attack + decay);
    });

    osc1.connect(gain1).connect(filter1);
    osc2.connect(gain2).connect(filter1);
    filter1.connect(filter2).connect(amp).connect(input);
    osc1.start(now);
    osc2.start(now);

    let stopped = false;
    const finish = (fast: boolean) => {
      if (stopped) return;
      stopped = true;
      const at = ctx.currentTime;
      const tail = fast ? 0.025 : release;
      holdParam(amp.gain, at);
      amp.gain.exponentialRampToValueAtTime(0.0001, at + tail);
      osc1.stop(at + tail + 0.06);
      osc2.stop(at + tail + 0.06);
    };
    return { midi, release: () => finish(false), stop: () => finish(true) };
  }, [east]);

  const startWestVoice = useCallback((rig: AudioRig, midi: number, expression = 0.5) => {
    const { ctx, input } = rig;
    const now = ctx.currentTime;
    const random = (Math.random() * 2 - 1) * west.uncertainty;
    const frequency = midiToHz(midi) * 2 ** (random / 1200);
    const carrier = ctx.createOscillator();
    const modulator = ctx.createOscillator();
    const modDepth = ctx.createGain();
    const shaper = ctx.createWaveShaper();
    const lpg = ctx.createBiquadFilter();
    const amp = ctx.createGain();
    const foldJitter = (Math.random() * 2 - 1) * west.uncertainty * 0.18;
    const fold = clamp(west.fold + foldJitter + expression * 18 - 9);
    const rise = timeFromControl(west.rise, 0.004, 1.35);
    const fall = timeFromControl(west.fall, 0.035, 2.8) * (0.65 + west.ring / 55);
    const maxCutoff = 420 + (west.color / 100) ** 1.7 * 14500;

    carrier.type = "sine";
    modulator.type = "sine";
    carrier.frequency.value = frequency;
    modulator.frequency.value = frequency * west.ratio;
    modDepth.gain.value = frequency * (west.fm / 100) * (1.6 + expression * 3.2);
    shaper.curve = makeFoldCurve(fold, west.symmetry);
    shaper.oversample = "4x";
    lpg.type = "lowpass";
    lpg.Q.value = 0.65;
    amp.gain.value = 0.0001;
    lpg.frequency.value = 90;

    modulator.connect(modDepth).connect(carrier.frequency);
    carrier.connect(shaper).connect(lpg).connect(amp).connect(input);
    carrier.start(now);
    modulator.start(now);

    let timer: ReturnType<typeof setInterval> | null = null;
    let stopped = false;
    const pulse = (at: number) => {
      amp.gain.cancelScheduledValues(at);
      amp.gain.setValueAtTime(0.0001, at);
      amp.gain.linearRampToValueAtTime(0.72, at + rise);
      amp.gain.exponentialRampToValueAtTime(0.0001, at + rise + fall);
      lpg.frequency.cancelScheduledValues(at);
      lpg.frequency.setValueAtTime(95, at);
      lpg.frequency.exponentialRampToValueAtTime(Math.max(100, maxCutoff), at + rise);
      lpg.frequency.exponentialRampToValueAtTime(95, at + rise + fall);
    };
    pulse(now);
    if (west.loop) {
      timer = setInterval(() => pulse(ctx.currentTime + 0.01), Math.max(90, (rise + fall) * 1000));
    }

    const finish = (fast: boolean) => {
      if (stopped) return;
      stopped = true;
      if (timer) clearInterval(timer);
      const at = ctx.currentTime;
      holdParam(amp.gain, at);
      amp.gain.exponentialRampToValueAtTime(0.0001, at + (fast ? 0.025 : 0.12));
      carrier.stop(at + 0.2);
      modulator.stop(at + 0.2);
    };
    return { midi, release: () => finish(false), stop: () => finish(true) };
  }, [west]);

  const startNote = useCallback(async (midi: number, expression = 0.5) => {
    stopVoice(true);
    const rig = await ensureRig();
    const voice = mode === "east" ? startEastVoice(rig, midi) : startWestVoice(rig, midi, expression);
    voiceRef.current = voice;
    setActiveMidi(midi);
    setStatus(mode === "east" ? "KEY GATE / FILTER CONTOUR ACTIVE" : "TOUCH PULSE / COMPLEX TIMBRE ACTIVE");
  }, [ensureRig, mode, startEastVoice, startWestVoice, stopVoice]);

  const releaseNote = useCallback((midi: number) => {
    if (voiceRef.current?.midi !== midi) return;
    stopVoice(false);
    setStatus(powered ? "SYSTEM ONLINE / AWAITING INPUT" : "READY / AUDIO SUSPENDED");
  }, [powered, stopVoice]);

  const changeMode = useCallback((next: Mode) => {
    stopVoice(true);
    setMode(next);
    if (next === "east") setEast(EAST_PATCHES[0]);
    else setWest(WEST_PATCHES[0]);
    setStatus(next === "east" ? "EAST PATCH LOADED / SUBTRACTIVE PATH" : "WEST PATCH LOADED / COMPLEX PATH");
  }, [stopVoice]);

  const togglePower = useCallback(async () => {
    if (!powered) {
      await ensureRig();
      return;
    }
    stopVoice(true);
    if (rigRef.current) await rigRef.current.ctx.suspend();
    setPowered(false);
    setStatus("READY / AUDIO SUSPENDED");
  }, [ensureRig, powered, stopVoice]);

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.repeat || pressedRef.current.has(event.code) || event.metaKey || event.ctrlKey || event.altKey) return;
      const collection = mode === "east" ? EAST_KEYS : WEST_PLATES;
      const found = collection.find((item) => item.code === event.code);
      if (!found) return;
      event.preventDefault();
      pressedRef.current.add(event.code);
      void startNote(found.midi, 0.62);
    };
    const up = (event: KeyboardEvent) => {
      if (!pressedRef.current.has(event.code)) return;
      pressedRef.current.delete(event.code);
      const collection = mode === "east" ? EAST_KEYS : WEST_PLATES;
      const found = collection.find((item) => item.code === event.code);
      if (found) releaseNote(found.midi);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [mode, releaseNote, startNote]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    let frame = 0;
    const data = new Uint8Array(2048);
    const draw = () => {
      frame = requestAnimationFrame(draw);
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      const width = Math.max(1, Math.floor(canvas.clientWidth * ratio));
      const height = Math.max(1, Math.floor(canvas.clientHeight * ratio));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      const styles = getComputedStyle(canvas);
      const ink = styles.getPropertyValue("--c-ink").trim() || "#1d1d1b";
      const paper = styles.getPropertyValue("--c-paper-light").trim() || "#faf6eb";
      const line = styles.getPropertyValue("--c-line").trim() || "rgba(29,29,27,.25)";
      const acid = styles.getPropertyValue("--acid").trim() || "#dfff00";
      context.fillStyle = paper;
      context.fillRect(0, 0, width, height);
      context.strokeStyle = line;
      context.lineWidth = ratio;
      for (let i = 1; i < 8; i += 1) {
        context.beginPath();
        context.moveTo((width / 8) * i, 0);
        context.lineTo((width / 8) * i, height);
        context.stroke();
      }
      for (let i = 1; i < 4; i += 1) {
        context.beginPath();
        context.moveTo(0, (height / 4) * i);
        context.lineTo(width, (height / 4) * i);
        context.stroke();
      }
      const analyser = rigRef.current?.analyser;
      if (!analyser || !powered) {
        context.strokeStyle = ink;
        context.beginPath();
        context.moveTo(0, height / 2);
        context.lineTo(width, height / 2);
        context.stroke();
        setLevel((previous) => previous > 0.1 ? previous * 0.9 : 0);
        return;
      }
      analyser.getByteTimeDomainData(data);
      let energy = 0;
      context.strokeStyle = activeMidi === null ? ink : acid;
      context.lineWidth = ratio * 2;
      context.beginPath();
      for (let i = 0; i < data.length; i += 1) {
        const normalized = (data[i] - 128) / 128;
        energy += normalized * normalized;
        const x = (i / (data.length - 1)) * width;
        const y = height * 0.5 + normalized * height * 0.38;
        if (i === 0) context.moveTo(x, y); else context.lineTo(x, y);
      }
      context.stroke();
      const rms = Math.min(1, Math.sqrt(energy / data.length) * 2.6);
      setLevel((previous) => previous * 0.72 + rms * 0.28);
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, [activeMidi, powered]);

  useEffect(() => () => {
    voiceRef.current?.stop();
    void rigRef.current?.ctx.close();
  }, []);

  const onPlateDown = (event: ReactPointerEvent<HTMLButtonElement>, midi: number) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const rect = event.currentTarget.getBoundingClientRect();
    const expression = clamp(1 - (event.clientY - rect.top) / rect.height, 0, 1);
    void startNote(midi, expression);
  };

  const modeData = mode === "east"
    ? { method: "SUBTRACTIVE", controller: "CHROMATIC KEYBOARD", shaper: "RESONANT LOW-PASS FILTER", movement: "ADSR + FILTER ENVELOPE" }
    : { method: "COMPLEX TIMBRE", controller: "TOUCH VOLTAGE PLATES", shaper: "FM + WAVEFOLDER + LPG", movement: "RISE/FALL + UNCERTAINTY" };

  return (
    <main className={`coasts ${mode}`}>
      <style>{STYLES}</style>
      <header className="co-masthead">
        <div className="co-plate">MZ–04</div>
        <div>
          <h1>COASTS</h1>
          <p>DUAL SYNTHESIS PHILOSOPHY / EAST ↔ WEST</p>
        </div>
        <Link href="/" className="co-back">← INDEX</Link>
      </header>

      <section className="co-transport" aria-label="Global controls">
        <button type="button" className={powered ? "active" : ""} onClick={() => void togglePower()}>{powered ? "POWER / ON" : "POWER / OFF"}</button>
        <div className="co-mode-strip" aria-label="Synthesis philosophy">
          <button type="button" className={mode === "east" ? "active" : ""} onClick={() => changeMode("east")}><strong>EAST COAST</strong><small>SUBTRACT / SCULPT</small></button>
          <button type="button" className={mode === "west" ? "active" : ""} onClick={() => changeMode("west")}><strong>WEST COAST</strong><small>GENERATE / MUTATE</small></button>
        </div>
        <button type="button" onClick={() => stopVoice(true)}>PANIC / CLEAR</button>
      </section>

      <section className="co-observation">
        <div className="co-scope-wrap">
          <span className="co-scope-label">LIVE OUTPUT / TIME DOMAIN</span>
          <canvas ref={canvasRef} aria-label="Live waveform display" />
          <div className="co-level" aria-label={`Output level ${Math.round(level * 100)} percent`}><i style={{ width: `${Math.round(level * 100)}%` }} /></div>
        </div>
        <div className="co-route">
          <span>ACTIVE SIGNAL PATH</span>
          {mode === "east" ? (
            <div><b>VCO 1 + VCO 2</b><i>→</i><b>MIX</b><i>→</i><b>VCF × 2</b><i>→</i><b>VCA</b></div>
          ) : (
            <div><b>MOD OSC</b><i>↘</i><b>COMPLEX OSC</b><i>→</i><b>FOLDER</b><i>→</i><b>LPG</b></div>
          )}
          <p>{mode === "east" ? "Begin with harmonically rich waves, then remove and contour spectral energy." : "Begin with a simple tone, then create complexity through oscillator interaction and nonlinear folding."}</p>
        </div>
      </section>

      <section className="co-register" aria-label="Philosophy comparison">
        <div><small>METHOD</small><strong>{modeData.method}</strong></div>
        <div><small>PRIMARY CONTROL</small><strong>{modeData.controller}</strong></div>
        <div><small>TIMBRE SHAPER</small><strong>{modeData.shaper}</strong></div>
        <div><small>TIME / MOTION</small><strong>{modeData.movement}</strong></div>
      </section>

      <section className="co-presets" aria-label="Patch specimens">
        <span>PATCH SPECIMENS</span>
        <div>
          {(mode === "east" ? EAST_PATCHES : WEST_PATCHES).map((patch) => (
            <button
              type="button"
              key={patch.name}
              className={(mode === "east" ? east.name : west.name) === patch.name ? "active" : ""}
              onClick={() => {
                stopVoice(true);
                if (mode === "east") setEast(patch as EastPatch); else setWest(patch as WestPatch);
                setStatus(`${patch.name} / PATCH LOADED`);
              }}
            >{patch.name}</button>
          ))}
        </div>
      </section>

      {mode === "east" ? (
        <section className="co-modules">
          <article>
            <ModuleHeader index="01" title="SOURCE" subtitle="HARMONIC MATERIAL" code="VCO" />
            <div className="co-module-body">
              <Choice label="OSCILLATOR 1" value={east.osc1} options={[{ value: "sawtooth", label: "SAW" }, { value: "square", label: "PULSE" }, { value: "triangle", label: "TRI" }]} onChange={(osc1) => setEast({ ...east, osc1 })} />
              <Choice label="OSCILLATOR 2" value={east.osc2} options={[{ value: "sawtooth", label: "SAW" }, { value: "square", label: "PULSE" }, { value: "triangle", label: "TRI" }]} onChange={(osc2) => setEast({ ...east, osc2 })} />
              <div className="co-knob-row">
                <Knob label="DETUNE" value={clamp(east.detune + 50)} onChange={(value) => setEast({ ...east, detune: Math.round(value - 50) })} format={(value) => `${Math.round(value - 50)}¢`} />
                <Knob label="BALANCE" value={east.balance} onChange={(balance) => setEast({ ...east, balance })} />
              </div>
            </div>
          </article>
          <article>
            <ModuleHeader index="02" title="FILTER" subtitle="SUBTRACTIVE SCULPTURE" code="VCF" />
            <div className="co-module-body co-knob-grid">
              <Knob label="CUTOFF" value={east.cutoff} onChange={(cutoff) => setEast({ ...east, cutoff })} format={(value) => `${Math.round(cutoffFromControl(value))}H`} />
              <Knob label="RESONANCE" value={east.resonance} onChange={(resonance) => setEast({ ...east, resonance })} />
              <Knob label="ENV AMOUNT" value={east.filterEnv} onChange={(filterEnv) => setEast({ ...east, filterEnv })} />
            </div>
          </article>
          <article>
            <ModuleHeader index="03" title="CONTOUR" subtitle="KEYED AMPLITUDE SHAPE" code="ADSR" />
            <div className="co-module-body co-knob-grid four">
              <Knob label="ATTACK" value={east.attack} onChange={(attack) => setEast({ ...east, attack })} />
              <Knob label="DECAY" value={east.decay} onChange={(decay) => setEast({ ...east, decay })} />
              <Knob label="SUSTAIN" value={east.sustain} onChange={(sustain) => setEast({ ...east, sustain })} />
              <Knob label="RELEASE" value={east.release} onChange={(release) => setEast({ ...east, release })} />
            </div>
          </article>
        </section>
      ) : (
        <section className="co-modules">
          <article>
            <ModuleHeader index="01" title="COMPLEX OSC" subtitle="HARMONICS GENERATED INSIDE" code="259" />
            <div className="co-module-body">
              <Choice label="MODULATION RATIO" value={west.ratio} options={[0.5, 1, 1.5, 2, 3, 4].map((value) => ({ value, label: `${value}:1` }))} onChange={(ratio) => setWest({ ...west, ratio })} />
              <div className="co-knob-grid four">
                <Knob label="FM INDEX" value={west.fm} onChange={(fm) => setWest({ ...west, fm })} />
                <Knob label="FOLD" value={west.fold} onChange={(fold) => setWest({ ...west, fold })} />
                <Knob label="SYMMETRY" value={west.symmetry} onChange={(symmetry) => setWest({ ...west, symmetry })} />
                <Knob label="UNCERTAINTY" value={west.uncertainty} onChange={(uncertainty) => setWest({ ...west, uncertainty })} />
              </div>
            </div>
          </article>
          <article>
            <ModuleHeader index="02" title="FUNCTION" subtitle="RISE / FALL VOLTAGE" code="281" />
            <div className="co-module-body">
              <div className="co-knob-grid">
                <Knob label="RISE" value={west.rise} onChange={(rise) => setWest({ ...west, rise })} />
                <Knob label="FALL" value={west.fall} onChange={(fall) => setWest({ ...west, fall })} />
              </div>
              <button type="button" className={`co-loop ${west.loop ? "active" : ""}`} onClick={() => setWest({ ...west, loop: !west.loop })}>{west.loop ? "CYCLER / LOOPING" : "CYCLER / ONE SHOT"}</button>
              <p className="co-note">No sustain stage. The function rises, falls, and may cycle as a modulation source.</p>
            </div>
          </article>
          <article>
            <ModuleHeader index="03" title="DYNAMICS" subtitle="TONE + AMPLITUDE TOGETHER" code="LPG" />
            <div className="co-module-body co-knob-grid">
              <Knob label="COLOR" value={west.color} onChange={(color) => setWest({ ...west, color })} />
              <Knob label="RING" value={west.ring} onChange={(ring) => setWest({ ...west, ring })} />
            </div>
            <p className="co-note inset">The low-pass gate opens brightness and loudness together—without a separate resonant filter panel.</p>
          </article>
        </section>
      )}

      <section className="co-manual">
        <ModuleHeader index="04" title={mode === "east" ? "KEYBOARD" : "TOUCH FIELD"} subtitle={mode === "east" ? "FAMILIAR PITCH / GATE CONTROL" : "ALTERNATE VOLTAGE INPUT"} code={mode === "east" ? "1V/OCT" : "CV"} />
        {mode === "east" ? (
          <div className="co-keyboard" aria-label="Chromatic keyboard">
            {EAST_KEYS.map((item) => (
              <button
                type="button"
                key={item.midi}
                className={`${item.black ? "black" : ""} ${activeMidi === item.midi ? "active" : ""}`}
                onPointerDown={(event) => { event.preventDefault(); event.currentTarget.setPointerCapture?.(event.pointerId); void startNote(item.midi); }}
                onPointerUp={() => releaseNote(item.midi)}
                onPointerCancel={() => releaseNote(item.midi)}
              ><strong>{item.note}</strong><small>{item.key}</small></button>
            ))}
          </div>
        ) : (
          <div className="co-plates" aria-label="Touch voltage plates">
            {WEST_PLATES.map((item, index) => (
              <button
                type="button"
                key={item.midi}
                className={activeMidi === item.midi ? "active" : ""}
                onPointerDown={(event) => onPlateDown(event, item.midi)}
                onPointerUp={() => releaseNote(item.midi)}
                onPointerCancel={() => releaseNote(item.midi)}
              ><span>{String(index + 1).padStart(2, "0")}</span><strong>{item.note}</strong><small>{item.key} / HIGH TOUCH = MORE TIMBRE</small></button>
            ))}
          </div>
        )}
      </section>

      <footer className="co-footer">
        <span>{status}</span>
        <span>{mode === "east" ? "EAST / KEYBOARD → VCO → VCF → VCA" : "WEST / TOUCH → COMPLEX OSC → FOLDER → LPG"}</span>
        <span>WEB AUDIO / NO SAMPLES</span>
      </footer>
    </main>
  );
}

const STYLES = `
.coasts{
  --c-paper:var(--paper); --c-paper-light:var(--paper-light); --c-ink:var(--ink); --c-muted:var(--muted); --c-line:var(--line);
  min-height:100vh; padding:24px 30px 18px; background:var(--c-paper); color:var(--c-ink); transition:background .14s ease,color .14s ease;
}
.coasts.west{ --c-paper:#1d1d1b; --c-paper-light:#2a2a27; --c-ink:#eee9dc; --c-muted:#aaa69c; --c-line:rgba(238,233,220,.28); }
.coasts *{ box-sizing:border-box; }
.coasts button,.coasts input{ color:inherit; }
.co-masthead{ display:grid; grid-template-columns:auto 1fr auto; align-items:end; gap:15px; border-top:2px solid var(--c-ink); border-bottom:2px solid var(--c-ink); padding:12px 0 14px; }
.co-plate{ align-self:stretch; min-width:56px; display:grid; place-items:center; background:var(--acid); color:var(--ink); border:1px solid var(--c-ink); font:800 10px/1 var(--mono); writing-mode:vertical-rl; transform:rotate(180deg); letter-spacing:.12em; }
.co-masthead h1{ margin:0; font-size:clamp(54px,8vw,110px); font-weight:900; letter-spacing:-.075em; line-height:.72; }
.co-masthead p{ margin:12px 0 0; color:var(--c-muted); font:800 9px/1 var(--mono); letter-spacing:.16em; }
.co-back{ align-self:start; color:inherit; text-decoration:none; border:1px solid var(--c-ink); padding:12px; min-height:44px; font:800 9px/1 var(--mono); letter-spacing:.1em; }
.co-back:hover{ background:var(--acid); color:var(--ink); }
.co-transport{ display:grid; grid-template-columns:160px 1fr 160px; margin-top:12px; border:1px solid var(--c-ink); }
.co-transport>button,.co-mode-strip button{ min-height:52px; border:0; background:transparent; font:800 9px/1 var(--mono); letter-spacing:.09em; }
.co-transport>button:first-child{ border-right:1px solid var(--c-ink); }
.co-transport>button:last-child{ border-left:1px solid var(--c-ink); }
.co-transport button:hover,.co-transport button.active{ background:var(--acid); color:var(--ink); }
.co-mode-strip{ display:grid; grid-template-columns:1fr 1fr; }
.co-mode-strip button+button{ border-left:1px solid var(--c-ink); }
.co-mode-strip strong,.co-mode-strip small{ display:block; }
.co-mode-strip strong{ font-size:11px; }
.co-mode-strip small{ margin-top:5px; color:var(--c-muted); font-size:7px; }
.co-mode-strip button.active small,.co-mode-strip button:hover small{ color:var(--ink); }
.co-observation{ display:grid; grid-template-columns:1.6fr 1fr; border:1px solid var(--c-ink); border-top:0; min-height:225px; }
.co-scope-wrap{ position:relative; border-right:1px solid var(--c-ink); min-height:225px; padding:28px 12px 18px; }
.co-scope-label{ position:absolute; left:12px; top:10px; z-index:2; font:800 8px/1 var(--mono); letter-spacing:.1em; }
.co-scope-wrap canvas{ --c-ink:inherit; --c-paper-light:inherit; --c-line:inherit; display:block; width:100%; height:174px; border:1px solid var(--c-ink); }
.co-level{ height:6px; margin-top:8px; border:1px solid var(--c-ink); }
.co-level i{ display:block; height:100%; background:var(--acid); transition:width 80ms linear; }
.co-route{ padding:18px; display:flex; flex-direction:column; justify-content:center; }
.co-route>span{ font:800 8px/1 var(--mono); color:var(--c-muted); letter-spacing:.12em; }
.co-route>div{ display:flex; align-items:center; flex-wrap:wrap; gap:8px; margin:17px 0; }
.co-route b{ border:1px solid var(--c-ink); padding:10px; font:800 9px/1 var(--mono); }
.co-route i{ font:900 15px/1 Arial; font-style:normal; color:var(--acid); -webkit-text-stroke:.4px var(--c-ink); }
.co-route p{ margin:0; font-size:13px; line-height:1.5; max-width:48ch; }
.co-register{ display:grid; grid-template-columns:repeat(4,1fr); border:1px solid var(--c-ink); border-top:0; }
.co-register>div{ padding:10px 12px; border-right:1px solid var(--c-ink); min-height:58px; }
.co-register>div:last-child{ border-right:0; }
.co-register small,.co-register strong{ display:block; }
.co-register small{ color:var(--c-muted); font:800 7px/1 var(--mono); letter-spacing:.12em; }
.co-register strong{ margin-top:7px; font:800 10px/1.2 var(--mono); }
.co-presets{ display:grid; grid-template-columns:160px 1fr; border:1px solid var(--c-ink); border-top:0; }
.co-presets>span{ display:grid; place-items:center start; padding:0 12px; border-right:1px solid var(--c-ink); font:800 8px/1 var(--mono); letter-spacing:.1em; }
.co-presets>div{ display:grid; grid-template-columns:repeat(3,1fr); }
.co-presets button{ min-height:44px; border:0; border-right:1px solid var(--c-ink); background:transparent; font:800 8px/1 var(--mono); letter-spacing:.08em; }
.co-presets button:last-child{ border-right:0; }
.co-presets button:hover,.co-presets button.active{ background:var(--acid); color:var(--ink); }
.co-modules{ display:grid; grid-template-columns:repeat(3,1fr); border:1px solid var(--c-ink); border-top:0; }
.co-modules article{ min-width:0; border-right:1px solid var(--c-ink); }
.co-modules article:last-child{ border-right:0; }
.co-module-head{ display:grid; grid-template-columns:26px 1fr auto; gap:9px; align-items:center; min-height:54px; padding:8px 10px; border-bottom:1px solid var(--c-ink); }
.co-index{ width:26px; height:26px; display:grid; place-items:center; background:var(--acid); color:var(--ink); border:1px solid var(--c-ink); font:800 9px/1 var(--mono); }
.co-module-head strong,.co-module-head small{ display:block; }
.co-module-head strong{ font-size:16px; line-height:1; letter-spacing:-.03em; }
.co-module-head small{ margin-top:4px; color:var(--c-muted); font:800 7px/1 var(--mono); letter-spacing:.09em; }
.co-module-head em{ font:800 8px/1 var(--mono); color:var(--c-muted); font-style:normal; }
.co-module-body{ padding:14px; }
.co-choice{ margin:0 0 14px; padding:0; border:0; }
.co-choice legend{ margin-bottom:7px; color:var(--c-muted); font:800 8px/1 var(--mono); letter-spacing:.1em; }
.co-choice>div{ display:grid; grid-auto-flow:column; grid-auto-columns:1fr; border:1px solid var(--c-ink); }
.co-choice button{ min-height:40px; border:0; border-right:1px solid var(--c-ink); background:transparent; font:800 8px/1 var(--mono); }
.co-choice button:last-child{ border-right:0; }
.co-choice button.active,.co-choice button:hover{ background:var(--acid); color:var(--ink); }
.co-knob-row,.co-knob-grid{ display:grid; grid-template-columns:repeat(2,1fr); gap:10px; align-items:start; }
.co-knob-grid{ grid-template-columns:repeat(3,1fr); }
.co-knob-grid.four{ grid-template-columns:repeat(4,1fr); }
.co-knob-control{ display:grid; justify-items:center; gap:5px; min-width:0; }
.co-knob{ --turn:0deg; position:relative; width:58px; height:58px; border-radius:50%; border:2px solid var(--c-ink); background:radial-gradient(circle at 36% 30%,var(--c-paper-light),var(--c-paper)); }
.co-knob:before{ content:""; position:absolute; inset:6px; border-radius:50%; border:1px solid var(--c-line); }
.co-knob i{ position:absolute; left:50%; top:50%; width:2px; height:22px; background:var(--acid); transform-origin:50% 100%; transform:translate(-50%,-100%) rotate(var(--turn)); box-shadow:0 0 0 1px rgba(29,29,27,.35); }
.co-knob input{ position:absolute; inset:0; width:100%; height:100%; opacity:0; cursor:ns-resize; }
.co-readout{ min-width:42px; text-align:center; padding:3px 4px; border:1px solid var(--c-ink); font:800 8px/1 var(--mono); }
.co-knob-control>b{ text-align:center; font:800 8px/1 var(--mono); letter-spacing:.07em; }
.co-loop{ width:100%; min-height:44px; margin-top:14px; border:1px solid var(--c-ink); background:transparent; font:800 8px/1 var(--mono); letter-spacing:.08em; }
.co-loop.active,.co-loop:hover{ background:var(--acid); color:var(--ink); }
.co-note{ margin:12px 0 0; color:var(--c-muted); font:700 9px/1.45 var(--mono); }
.co-note.inset{ padding:0 14px 14px; }
.co-manual{ border:1px solid var(--c-ink); border-top:0; }
.co-keyboard{ display:grid; grid-template-columns:repeat(13,1fr); min-height:125px; border-top:0; }
.co-keyboard button{ position:relative; border:0; border-right:1px solid var(--c-ink); background:var(--c-paper-light); color:var(--c-ink); padding:10px 4px; display:flex; flex-direction:column; justify-content:flex-end; align-items:center; gap:8px; }
.co-keyboard button:last-child{ border-right:0; }
.co-keyboard button.black{ background:var(--c-ink); color:var(--c-paper); min-height:86px; align-self:start; }
.co-keyboard button.active,.co-keyboard button:hover{ background:var(--acid); color:var(--ink); }
.co-keyboard strong{ font:900 12px/1 Arial; }
.co-keyboard small{ font:800 8px/1 var(--mono); }
.co-plates{ display:grid; grid-template-columns:repeat(8,1fr); }
.co-plates button{ min-height:132px; border:0; border-right:1px solid var(--c-ink); border-top:1px solid var(--c-ink); background:var(--c-paper-light); color:var(--c-ink); display:flex; flex-direction:column; justify-content:space-between; text-align:left; padding:10px; touch-action:none; }
.co-plates button:last-child{ border-right:0; }
.co-plates button:nth-child(even){ background:var(--c-paper); }
.co-plates button.active,.co-plates button:hover{ background:var(--acid); color:var(--ink); }
.co-plates span,.co-plates small{ font:800 7px/1.2 var(--mono); letter-spacing:.06em; }
.co-plates strong{ font-size:18px; }
.co-footer{ display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap; border-top:2px solid var(--c-ink); margin-top:14px; padding-top:10px; color:var(--c-muted); font:800 7px/1 var(--mono); letter-spacing:.08em; }
@media(max-width:980px){
  .co-observation{ grid-template-columns:1fr; }
  .co-scope-wrap{ border-right:0; border-bottom:1px solid var(--c-ink); }
  .co-register{ grid-template-columns:1fr 1fr; }
  .co-register>div:nth-child(2){ border-right:0; }
  .co-register>div:nth-child(-n+2){ border-bottom:1px solid var(--c-ink); }
  .co-modules{ grid-template-columns:1fr; }
  .co-modules article{ border-right:0; border-bottom:1px solid var(--c-ink); }
  .co-modules article:last-child{ border-bottom:0; }
  .co-plates{ grid-template-columns:repeat(4,1fr); }
  .co-plates button:nth-child(4){ border-right:0; }
  .co-plates button:nth-child(-n+4){ border-bottom:1px solid var(--c-ink); }
}
@media(max-width:680px){
  .coasts{ padding:15px; }
  .co-masthead{ grid-template-columns:auto 1fr; }
  .co-back{ grid-column:1/-1; width:100%; text-align:center; }
  .co-transport{ grid-template-columns:1fr 1fr; }
  .co-mode-strip{ grid-column:1/-1; grid-row:1; border-bottom:1px solid var(--c-ink); }
  .co-transport>button:first-child{ border-right:1px solid var(--c-ink); }
  .co-transport>button:last-child{ border-left:0; }
  .co-register{ grid-template-columns:1fr; }
  .co-register>div{ border-right:0; border-bottom:1px solid var(--c-ink); }
  .co-register>div:last-child{ border-bottom:0; }
  .co-presets{ grid-template-columns:1fr; }
  .co-presets>span{ min-height:36px; border-right:0; border-bottom:1px solid var(--c-ink); }
  .co-presets>div{ grid-template-columns:1fr; }
  .co-presets button{ border-right:0; border-bottom:1px solid var(--c-ink); }
  .co-presets button:last-child{ border-bottom:0; }
  .co-keyboard{ grid-template-columns:repeat(7,1fr); }
  .co-keyboard button{ min-height:78px; border-bottom:1px solid var(--c-ink); }
  .co-keyboard button:nth-child(7){ border-right:0; }
  .co-keyboard button.black{ min-height:62px; }
  .co-plates{ grid-template-columns:repeat(2,1fr); }
  .co-plates button:nth-child(even){ border-right:0; }
  .co-plates button:nth-child(-n+6){ border-bottom:1px solid var(--c-ink); }
  .co-knob-grid.four{ grid-template-columns:repeat(2,1fr); }
}
@media(prefers-reduced-motion:reduce){ .coasts,.co-level i{ transition:none; } }
`;
