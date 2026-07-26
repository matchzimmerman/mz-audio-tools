"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import { MagpieEngine } from "../magpie-engine";
import type { CallModel, EngineParams } from "../magpie-engine";

type Params = EngineParams;
type ScaleId = "majorPent" | "minorPent" | "dorian" | "chromatic";
type StepLevel = "off" | "normal" | "accent";
type Step = { degree: number; level: StepLevel };
type Patch = { name: string; model: CallModel; params: Params; bpm: number; rootMidi: number; scale: ScaleId; steps: Step[] };

const scales: Record<ScaleId, { name: string; intervals: number[] }> = {
  majorPent: { name: "MAJOR PENT.", intervals: [0, 2, 4, 7, 9] },
  minorPent: { name: "MINOR PENT.", intervals: [0, 3, 5, 7, 10] },
  dorian: { name: "DORIAN", intervals: [0, 2, 3, 5, 7, 9, 10] },
  chromatic: { name: "CHROMATIC", intervals: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
};

const modelNames: Record<CallModel, string> = { warble: "WARBLE", rattle: "RATTLE", whistle: "WHISTLE", swarm: "SWARM" };
const modelSpecimens: Record<CallModel, string> = { warble: "WOODY FORMANT", rattle: "METALLIC FM", whistle: "CLEAR CHIRPLET", swarm: "STEREO FLOCK" };
const noteNames = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
const noteLabel = (midi: number) => `${noteNames[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const makeSteps = (active: number[], degrees: number[], accents: number[] = []): Step[] => Array.from({ length: 16 }, (_, index) => ({
  degree: degrees[index] ?? 0,
  level: !active.includes(index) ? "off" : accents.includes(index) ? "accent" : "normal",
}));

const patches: Patch[] = [
  {
    name: "HEDGEROW", model: "warble", bpm: 112, rootMidi: 55, scale: "dorian",
    params: { call: 62, tone: 74, grain: 26, glide: 44, flutter: 18, scatter: 36, space: 52, delay: 28, field: 20 },
    steps: makeSteps([0, 3, 5, 8, 10, 13], [0, 2, 4, 1, 5, 3, 2, 6, 0, 3, 5, 1, 4, 2, 6, 3], [5, 13]),
  },
  {
    name: "DAWN CHORUS", model: "whistle", bpm: 126, rootMidi: 62, scale: "majorPent",
    params: { call: 78, tone: 88, grain: 10, glide: 58, flutter: 42, scatter: 48, space: 64, delay: 21, field: 14 },
    steps: makeSteps([0, 2, 3, 6, 7, 9, 11, 14], [0, 2, 4, 3, 1, 5, 6, 4, 2, 7, 5, 3, 8, 6, 4, 2], [3, 9, 14]),
  },
  {
    name: "TIN ROOF", model: "rattle", bpm: 94, rootMidi: 52, scale: "chromatic",
    params: { call: 70, tone: 52, grain: 84, glide: 19, flutter: 63, scatter: 25, space: 31, delay: 46, field: 8 },
    steps: makeSteps([0, 1, 4, 6, 8, 9, 12, 15], [0, 7, 3, 10, 1, 8, 5, 11, 0, 6, 2, 9, 4, 7, 1, 10], [1, 6, 9, 15]),
  },
  {
    name: "MURMURATION", model: "swarm", bpm: 82, rootMidi: 57, scale: "minorPent",
    params: { call: 38, tone: 61, grain: 34, glide: 27, flutter: 31, scatter: 82, space: 86, delay: 62, field: 44 },
    steps: makeSteps([0, 3, 5, 7, 10, 12, 14], [0, 3, 5, 7, 4, 2, 6, 9, 7, 5, 3, 1, 4, 6, 8, 5], [7, 14]),
  },
];

const keys = [
  { name: "C", midi: 60, code: "KeyA", key: "A" }, { name: "C♯", midi: 61, code: "KeyW", key: "W", black: true },
  { name: "D", midi: 62, code: "KeyS", key: "S" }, { name: "D♯", midi: 63, code: "KeyE", key: "E", black: true },
  { name: "E", midi: 64, code: "KeyD", key: "D" }, { name: "F", midi: 65, code: "KeyF", key: "F" },
  { name: "F♯", midi: 66, code: "KeyT", key: "T", black: true }, { name: "G", midi: 67, code: "KeyG", key: "G" },
  { name: "G♯", midi: 68, code: "KeyY", key: "Y", black: true }, { name: "A", midi: 69, code: "KeyH", key: "H" },
  { name: "A♯", midi: 70, code: "KeyU", key: "U", black: true }, { name: "B", midi: 71, code: "KeyJ", key: "J" },
  { name: "C", midi: 72, code: "KeyK", key: "K" },
];

function Knob({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="knob-control">
      <span className="knob" style={{ "--turn": `${-132 + value * 2.64}deg` } as CSSProperties}>
        <input aria-label={label} type="range" min="0" max="100" value={value} onChange={(event) => onChange(Number(event.target.value))} />
        <i />
      </span>
      <span className="knob-readout">{String(value).padStart(3, "0")}</span>
      <b>{label}</b>
    </label>
  );
}

export default function Home() {
  const [params, setParams] = useState<Params>(patches[0].params);
  const [steps, setSteps] = useState<Step[]>(patches[0].steps);
  const [model, setModel] = useState<CallModel>(patches[0].model);
  const [rootMidi, setRootMidi] = useState(patches[0].rootMidi);
  const [scale, setScale] = useState<ScaleId>(patches[0].scale);
  const [preset, setPreset] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordMessage, setRecordMessage] = useState("READY");
  const [bpm, setBpm] = useState(patches[0].bpm);
  const [octave, setOctave] = useState(4);
  const [currentStep, setCurrentStep] = useState(-1);
  const [activeNotes, setActiveNotes] = useState<number[]>([]);
  const [audioReady, setAudioReady] = useState(false);
  const [gesture, setGesture] = useState({ x: 0.5, y: 0.5, active: false });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<MagpieEngine | null>(null);
  const paramsRef = useRef(params);
  const stepsRef = useRef(steps);
  const bpmRef = useRef(bpm);
  const rootRef = useRef(rootMidi);
  const scaleRef = useRef(scale);
  const modelRef = useRef(model);
  const noteTimers = useRef<Map<number, number>>(new Map());
  const visualTimers = useRef<number[]>([]);
  const scopeLastCall = useRef(0);
  const stepGesture = useRef<{ index: number; startY: number; startDegree: number; moved: boolean } | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recorderChunks = useRef<Blob[]>([]);

  useEffect(() => { paramsRef.current = params; }, [params]);
  useEffect(() => { stepsRef.current = steps; }, [steps]);
  useEffect(() => { bpmRef.current = bpm; }, [bpm]);
  useEffect(() => { rootRef.current = rootMidi; }, [rootMidi]);
  useEffect(() => { scaleRef.current = scale; }, [scale]);
  useEffect(() => { modelRef.current = model; }, [model]);

  const ensureAudio = useCallback(async () => {
    if (!engineRef.current) {
      const AudioCtor = window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      engineRef.current = new MagpieEngine(new AudioCtor(), paramsRef.current);
      engineRef.current.setParams(paramsRef.current, bpmRef.current, modelRef.current);
    }
    if (engineRef.current.context.state === "suspended") await engineRef.current.context.resume();
    setAudioReady(true);
    return engineRef.current;
  }, []);

  useEffect(() => {
    engineRef.current?.setParams(params, bpm, model);
  }, [params, bpm, model]);

  const trigger = useCallback(async (midi: number, velocity = 0.76, pan?: number, duration?: number) => {
    const engine = await ensureAudio();
    engine.trigger({ midi, velocity, pan, duration });
    setActiveNotes((active) => active.includes(midi) ? active : [...active, midi]);
    const existing = noteTimers.current.get(midi);
    if (existing) window.clearTimeout(existing);
    noteTimers.current.set(midi, window.setTimeout(() => setActiveNotes((active) => active.filter((note) => note !== midi)), 260));
  }, [ensureAudio]);

  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.repeat || target?.matches("input, select, textarea, [contenteditable='true']")) return;
      const key = keys.find((item) => item.code === event.code);
      if (!key) return;
      event.preventDefault();
      void trigger(key.midi + (octave - 4) * 12, 0.82, (key.midi - 66) / 9);
    };
    const keyUp = (event: KeyboardEvent) => {
      const key = keys.find((item) => item.code === event.code);
      if (key) setActiveNotes((active) => active.filter((note) => note !== key.midi + (octave - 4) * 12));
    };
    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);
    return () => { window.removeEventListener("keydown", keyDown); window.removeEventListener("keyup", keyUp); };
  }, [octave, trigger]);

  useEffect(() => {
    if (!playing) return;
    let cancelled = false;
    let index = 0;
    let nextTime = engineRef.current ? engineRef.current.context.currentTime + 0.06 : 0;
    const tick = async () => {
      const engine = await ensureAudio();
      if (cancelled) return;
      if (!nextTime) nextTime = engine.context.currentTime + 0.06;
      while (nextTime < engine.context.currentTime + 0.12) {
        const step = stepsRef.current[index];
        if (step.level !== "off") {
          const scaleIntervals = scales[scaleRef.current].intervals;
          const octaveOffset = Math.floor(step.degree / scaleIntervals.length) * 12;
          const interval = scaleIntervals[((step.degree % scaleIntervals.length) + scaleIntervals.length) % scaleIntervals.length];
          const midi = rootRef.current + octaveOffset + interval;
          engine.trigger({ midi, velocity: step.level === "accent" ? 1 : 0.62, duration: (60 / bpmRef.current / 4) * (step.level === "accent" ? 1.7 : 1.05), pan: (index / 15) * 1.4 - 0.7, when: nextTime });
        }
        const shown = index;
        visualTimers.current.push(window.setTimeout(() => setCurrentStep(shown), Math.max(0, (nextTime - engine.context.currentTime) * 1000)));
        index = (index + 1) % 16;
        nextTime += 60 / bpmRef.current / 4;
      }
    };
    void tick();
    const timer = window.setInterval(() => { void tick(); }, 25);
    return () => { cancelled = true; window.clearInterval(timer); visualTimers.current.forEach(window.clearTimeout); visualTimers.current = []; };
  }, [playing, ensureAudio]);

  useEffect(() => {
    let frame = 0;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const draw = () => {
      const ratio = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      if (canvas.width !== Math.floor(rect.width * ratio) || canvas.height !== Math.floor(rect.height * ratio)) { canvas.width = Math.floor(rect.width * ratio); canvas.height = Math.floor(rect.height * ratio); }
      const context = canvas.getContext("2d")!;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, rect.width, rect.height);
      context.strokeStyle = "rgba(29,29,27,.12)"; context.lineWidth = 1;
      for (let x = 0; x < rect.width; x += 32) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, rect.height); context.stroke(); }
      for (let y = 0; y < rect.height; y += 32) { context.beginPath(); context.moveTo(0, y); context.lineTo(rect.width, y); context.stroke(); }

      const analyser = engineRef.current?.analyser;
      let wave: Uint8Array<ArrayBuffer> | null = null;
      if (analyser) {
        wave = new Uint8Array(analyser.fftSize);
        analyser.getByteTimeDomainData(wave);
        const spectrum = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(spectrum);
        context.fillStyle = "rgba(223,255,0,.48)";
        const bars = 72;
        for (let bar = 0; bar < bars; bar++) {
          const strength = spectrum[Math.floor((bar / bars) * spectrum.length * 0.42)] / 255;
          context.fillRect((bar / bars) * rect.width, rect.height - strength * rect.height * 0.32, Math.max(1, rect.width / bars - 2), strength * rect.height * 0.32);
        }
      }
      context.beginPath(); context.strokeStyle = audioReady ? "#1d1d1b" : "#77756e"; context.lineWidth = 2;
      const length = wave?.length || 512;
      for (let x = 0; x < rect.width; x++) {
        const point = Math.floor((x / rect.width) * length);
        const idle = Math.sin(x * 0.036 + Date.now() / 900) * 0.04;
        const value = wave ? (wave[point] - 128) / 128 : idle;
        const y = rect.height / 2 + value * rect.height * 0.38;
        if (x === 0) context.moveTo(x, y); else context.lineTo(x, y);
      }
      context.stroke();
      frame = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, [audioReady]);

  const updateParam = (key: keyof Params) => (value: number) => { setParams((current) => ({ ...current, [key]: value })); setDirty(true); };

  const loadPreset = (index: number) => {
    const patch = patches[index];
    setPreset(index); setParams({ ...patch.params }); setSteps(patch.steps.map((step) => ({ ...step })));
    setModel(patch.model); setRootMidi(patch.rootMidi); setScale(patch.scale); setBpm(patch.bpm); setDirty(false);
  };

  const cyclePreset = () => loadPreset((preset + 1) % patches.length);

  const mutate = () => {
    const nextParams = { ...params };
    (Object.keys(nextParams) as (keyof Params)[]).forEach((key) => { if (Math.random() > 0.34) nextParams[key] = clamp(nextParams[key] + Math.round((Math.random() - 0.5) * 28), 4, 96); });
    setParams(nextParams);
    setSteps((current) => current.map((step) => Math.random() < 0.3 ? { degree: clamp(step.degree + Math.round(Math.random() * 4 - 2), -4, 12), level: Math.random() < 0.18 ? (step.level === "off" ? "normal" : "off") : step.level } : step));
    setDirty(true);
  };

  const cycleStep = (index: number) => {
    setSteps((current) => current.map((step, stepIndex) => stepIndex !== index ? step : { ...step, level: step.level === "off" ? "normal" : step.level === "normal" ? "accent" : "off" }));
    setDirty(true);
  };

  const shiftStep = (index: number, delta: number) => {
    setSteps((current) => current.map((step, stepIndex) => stepIndex !== index ? step : { ...step, degree: clamp(step.degree + delta, -4, 12) }));
    setDirty(true);
  };

  const stepPointerDown = (event: ReactPointerEvent<HTMLButtonElement>, index: number) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    stepGesture.current = { index, startY: event.clientY, startDegree: steps[index].degree, moved: false };
  };
  const stepPointerMove = (event: ReactPointerEvent<HTMLButtonElement>, index: number) => {
    const gestureState = stepGesture.current;
    if (!gestureState || gestureState.index !== index) return;
    const delta = Math.round((gestureState.startY - event.clientY) / 15);
    if (delta !== 0) {
      gestureState.moved = true;
      setSteps((current) => current.map((step, stepIndex) => stepIndex !== index ? step : { ...step, degree: clamp(gestureState.startDegree + delta, -4, 12) }));
      setDirty(true);
    }
  };
  const stepPointerUp = (_event: ReactPointerEvent<HTMLButtonElement>, index: number) => {
    if (stepGesture.current?.index === index && !stepGesture.current.moved) cycleStep(index);
    stepGesture.current = null;
  };
  const stepKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === "ArrowUp" || event.key === "ArrowDown") { event.preventDefault(); shiftStep(index, event.key === "ArrowUp" ? 1 : -1); }
    if (event.key === " " || event.key === "Enter") { event.preventDefault(); cycleStep(index); }
  };

  const scopeCall = (event: ReactPointerEvent<HTMLDivElement>, immediate = false) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    const y = clamp((event.clientY - rect.top) / rect.height, 0, 1);
    setGesture({ x, y, active: true });
    const now = performance.now();
    if (!immediate && now - scopeLastCall.current < 70) return;
    scopeLastCall.current = now;
    const intervals = scales[scaleRef.current].intervals;
    const degree = Math.round(x * (intervals.length * 2 - 1));
    const midi = rootRef.current + intervals[degree % intervals.length] + Math.floor(degree / intervals.length) * 12;
    void trigger(midi, 0.28 + (1 - y) * 0.72, x * 2 - 1, 0.24 + (1 - y) * 0.9);
  };

  const toggleRecording = async () => {
    if (recording && recorderRef.current) { recorderRef.current.stop(); return; }
    const engine = await ensureAudio();
    if (!("MediaRecorder" in window)) { setRecordMessage("UNSUPPORTED"); return; }
    const types = ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/mp4", "audio/webm"];
    const mimeType = types.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
    const recorder = new MediaRecorder(engine.recordStream, mimeType ? { mimeType } : undefined);
    recorderChunks.current = [];
    recorder.ondataavailable = (event) => { if (event.data.size) recorderChunks.current.push(event.data); };
    recorder.onstop = () => {
      const blob = new Blob(recorderChunks.current, { type: recorder.mimeType || "audio/webm" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const extension = recorder.mimeType.includes("ogg") ? "ogg" : recorder.mimeType.includes("mp4") ? "m4a" : "webm";
      link.href = url; link.download = `magpie-field-take-${new Date().toISOString().replace(/[:.]/g, "-")}.${extension}`; link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setRecording(false); setRecordMessage("TAKE SAVED");
    };
    recorder.start(); recorderRef.current = recorder; setRecording(true); setRecordMessage("CAPTURING");
  };

  const selectedIntervals = scales[scale].intervals;
  const selectedPatchName = `${String(preset + 1).padStart(2, "0")} — ${patches[preset].name}${dirty ? " *" : ""}`;
  const currentFrequency = activeNotes.length ? Math.round(440 * Math.pow(2, (activeNotes[0] - 69) / 12)) : null;

  return (
    <main className="magpie">
      <style>{STYLES}</style>
      <header className="masthead">
        <div><span className="plate">MZ–01</span><h1>MAGPIE</h1><p>AVIAN SIGNAL SYNTHESIZER</p></div>
        <div className="transport" aria-label="Transport controls">
          <label className="tempo"><span>TEMPO / BPM</span><input aria-label="Tempo" type="number" min="60" max="180" value={bpm} onChange={(event) => { setBpm(clamp(Number(event.target.value), 60, 180)); setDirty(true); }} /></label>
          <button className={playing ? "active" : ""} onClick={async () => { if (!playing) await ensureAudio(); else setCurrentStep(-1); setPlaying((value) => !value); }}><span className="play-icon">{playing ? "Ⅱ" : "▶"}</span>{playing ? "STOP" : "FLY"}</button>
          <button className={recording ? "recording" : ""} onClick={() => { void toggleRecording(); }}><span className="rec-dot" />{recording ? "STOP REC" : "REC TAKE"}</button>
          <button onClick={mutate}>↝ MUTATE</button>
        </div>
      </header>

      <section className="scope-section">
        <div className="scope-head">
          <div><span>OBSERVATION 02 / EXPRESSIVE SURFACE</span><strong>LIVE SIGNAL / {audioReady ? "ACTIVE" : "AWAITING INPUT"}</strong></div>
          <div className="preset"><span>FIELD PRESET / CLICK TO ADVANCE</span><button onClick={cyclePreset}>{selectedPatchName} <i>↕</i></button></div>
        </div>
        <div className={`scope ${gesture.active ? "gesturing" : ""}`} onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); scopeCall(event, true); }} onPointerMove={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) scopeCall(event); }} onPointerUp={() => setGesture((value) => ({ ...value, active: false }))} onPointerCancel={() => setGesture((value) => ({ ...value, active: false }))}>
          <canvas ref={canvasRef} />
          <div className="axis left">+1<br /><span>0</span><br />−1</div><div className="axis bottom">LOW CALL <span>← PITCH →</span> HIGH CALL</div>
          <div className="scope-status"><i className={audioReady ? "on" : ""} /> AUDIO ENGINE {audioReady ? "ONLINE" : "STANDBY"}</div>
          <div className="scope-hint">DRAG SIGNAL TO CALL <span>Y / ENERGY · X / PITCH + PAN</span></div>
          <i className="gesture-crosshair" style={{ left: `${gesture.x * 100}%`, top: `${gesture.y * 100}%`, opacity: gesture.active ? 1 : 0 }} />
        </div>
        <div className="observations">
          <span><b>FUNDAMENTAL</b>{currentFrequency ? `${currentFrequency} Hz` : "— Hz"}</span><span><b>CALL MODEL</b>{modelNames[model]}</span><span><b>TONAL MAP</b>{noteLabel(rootMidi)} / {scales[scale].name}</span><span><b>HABITAT</b>{params.field ? `${params.field}% AIR` : "DRY FIELD"}</span><span><b>FIELD TAKE</b>{recordMessage}</span>
        </div>
        <div className="model-strip"><b>CALL MORPHOLOGY</b>{(Object.keys(modelNames) as CallModel[]).map((item) => <button key={item} className={model === item ? "selected" : ""} onClick={() => { setModel(item); setDirty(true); }}>{modelNames[item]} <span>{modelSpecimens[item]}</span></button>)}</div>
      </section>

      <section className="modules">
        <div className="module"><div className="module-title"><span>01</span><div><h2>VOICE</h2><p>VOCAL MORPHOLOGY</p></div><i>VCE</i></div><div className="knobs"><Knob label="CALL" value={params.call} onChange={updateParam("call")} /><Knob label="TONE" value={params.tone} onChange={updateParam("tone")} /><Knob label="GRAIN" value={params.grain} onChange={updateParam("grain")} /></div></div>
        <div className="module"><div className="module-title"><span>02</span><div><h2>FLIGHT</h2><p>MOTION &amp; MODULATION</p></div><i>FLT</i></div><div className="knobs"><Knob label="GLIDE" value={params.glide} onChange={updateParam("glide")} /><Knob label="FLUTTER" value={params.flutter} onChange={updateParam("flutter")} /><Knob label="SCATTER" value={params.scatter} onChange={updateParam("scatter")} /></div></div>
        <div className="module"><div className="module-title"><span>03</span><div><h2>HABITAT</h2><p>ACOUSTIC ENVIRONMENT</p></div><i>HBT</i></div><div className="knobs"><Knob label="SPACE" value={params.space} onChange={updateParam("space")} /><Knob label="DELAY" value={params.delay} onChange={updateParam("delay")} /><Knob label="FIELD" value={params.field} onChange={updateParam("field")} /></div></div>
      </section>

      <section className="flight-path">
        <div className="section-label">
          <div><span>04</span><h2>FLIGHT PATH</h2><p>16–STEP PITCHED CALL SEQUENCE</p></div>
          <div className="sequence-settings"><label>ROOT<select aria-label="Sequence root" value={rootMidi} onChange={(event) => { setRootMidi(Number(event.target.value)); setDirty(true); }}>{[48, 50, 52, 53, 55, 57, 59, 60, 62].map((midi) => <option key={midi} value={midi}>{noteLabel(midi)}</option>)}</select></label><label>SCALE<select aria-label="Sequence scale" value={scale} onChange={(event) => { setScale(event.target.value as ScaleId); setDirty(true); }}>{(Object.keys(scales) as ScaleId[]).map((id) => <option key={id} value={id}>{scales[id].name}</option>)}</select></label></div>
          <small>TAP = OFF / CALL / ACCENT · DRAG ↑↓ = PITCH</small>
        </div>
        <div className="steps">{steps.map((step, index) => {
          const degree = ((step.degree % selectedIntervals.length) + selectedIntervals.length) % selectedIntervals.length;
          const midi = rootMidi + selectedIntervals[degree] + Math.floor(step.degree / selectedIntervals.length) * 12;
          return <button key={index} aria-label={`Step ${index + 1}, ${noteLabel(midi)}, ${step.level}`} aria-pressed={step.level !== "off"} className={`${step.level} ${currentStep === index ? "current" : ""}`} onPointerDown={(event) => stepPointerDown(event, index)} onPointerMove={(event) => stepPointerMove(event, index)} onPointerUp={(event) => stepPointerUp(event, index)} onPointerCancel={() => { stepGesture.current = null; }} onKeyDown={(event) => stepKeyDown(event, index)}><b>{String(index + 1).padStart(2, "0")}</b><span>{noteLabel(midi)}</span><i /></button>;
        })}</div>
      </section>

      <section className="keyboard-section">
        <div className="keyboard-note"><div><b>MANUAL CALL</b><span>HOME ROW + W E T Y U</span></div><div className="octave"><button aria-label="Octave down" onClick={() => setOctave((value) => clamp(value - 1, 2, 6))}>−</button><span>OCT {octave}</span><button aria-label="Octave up" onClick={() => setOctave((value) => clamp(value + 1, 2, 6))}>+</button></div></div>
        <div className="keyboard">{keys.map((key) => {
          const midi = key.midi + (octave - 4) * 12;
          return <button key={key.midi} className={`${key.black ? "black" : "white"} ${activeNotes.includes(midi) ? "pressed" : ""}`} onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); void trigger(midi, 0.84, (key.midi - 66) / 9); }} onPointerUp={() => setActiveNotes((active) => active.filter((note) => note !== midi))} aria-label={`${noteLabel(midi)} note`}><span>{key.key}</span><b>{noteLabel(midi)}</b></button>;
        })}</div>
      </section>
      <footer><span>MAGPIE SIGNAL LABORATORY</span><span>4 VOICE MODELS / STEREO HABITAT / LIVE CAPTURE</span><span>FIELD UNIT № 02</span></footer>
    </main>
  );
}

/* ============================================================
   STYLES — scoped under .magpie so this instrument never leaks
   into or depends on another tool's global classes.
   ============================================================ */
const STYLES = `
.magpie { min-height:100vh; padding:24px 30px 14px; max-width:1720px; margin:0 auto; }
.magpie .masthead { display:flex; justify-content:space-between; align-items:flex-end; border-top:2px solid var(--ink); border-bottom:2px solid var(--ink); padding:12px 0 14px; }
.magpie .masthead>div:first-child { display:grid; grid-template-columns:auto auto; column-gap:14px; align-items:end; }
.magpie .plate { grid-row:1/3; align-self:stretch; writing-mode:vertical-rl; transform:rotate(180deg); background:var(--ink); color:var(--paper); font:700 10px/1 monospace; padding:7px 6px; letter-spacing:1px; }
.magpie h1 { margin:0; font-size:clamp(48px,6.2vw,92px); letter-spacing:-.075em; line-height:.72; font-weight:900; }
.magpie .masthead p { margin:8px 0 0 4px; font:700 10px/1 monospace; letter-spacing:.16em; }
.magpie .transport { display:flex; align-items:stretch; gap:7px; }
.magpie .transport button, .magpie .tempo { min-width:84px; min-height:52px; border:1.5px solid var(--ink); background:transparent; padding:7px 12px; font:700 10px/1 monospace; display:flex; align-items:center; justify-content:center; gap:8px; letter-spacing:.08em; transition:.15s; }
.magpie .transport button:hover, .magpie .transport button.active { background:var(--acid); }
.magpie .transport button.recording { color:var(--danger); box-shadow:inset 0 0 0 2px var(--danger); }
.magpie .play-icon { font-size:13px; }
.magpie .rec-dot { width:9px; height:9px; border-radius:50%; background:var(--danger); }
.magpie .tempo { flex-direction:column; align-items:flex-start; min-width:112px; }
.magpie .tempo span { font-size:8px; color:var(--muted); }
.magpie .tempo input { width:70px; border:0; background:transparent; font:800 20px/1 monospace; outline:0; }
.magpie .scope-section { border-bottom:1.5px solid var(--ink); padding:14px 0 12px; }
.magpie .scope-head { display:flex; justify-content:space-between; align-items:end; margin-bottom:9px; }
.magpie .scope-head span, .magpie .preset span { display:block; font:700 8px/1 monospace; letter-spacing:.12em; color:var(--muted); margin-bottom:5px; }
.magpie .scope-head strong { font:800 14px/1 monospace; }
.magpie .preset button { border:0; border-bottom:1px solid var(--ink); background:transparent; min-width:220px; padding:0 0 6px; text-align:left; font:700 11px/1 monospace; }
.magpie .preset i { float:right; }
.magpie .scope { height:clamp(210px,27vh,320px); position:relative; border:1.5px solid var(--ink); overflow:hidden; background:rgba(255,255,255,.13); touch-action:none; user-select:none; cursor:crosshair; }
.magpie .scope.gesturing { box-shadow:inset 0 0 0 3px var(--acid); }
.magpie .scope:after { content:""; position:absolute; left:0; right:0; top:50%; border-top:1px solid rgba(29,29,27,.35); pointer-events:none; }
.magpie .scope canvas { width:100%; height:100%; display:block; }
.magpie .axis { position:absolute; font:700 7px/1.7 monospace; color:var(--muted); pointer-events:none; }
.magpie .axis.left { left:8px; top:7px; height:calc(100% - 15px); display:flex; flex-direction:column; justify-content:space-between; }
.magpie .axis.bottom { left:38px; right:12px; bottom:5px; display:flex; justify-content:space-between; }
.magpie .scope-status { position:absolute; right:9px; top:8px; background:var(--paper); border:1px solid var(--ink); padding:5px 8px; font:700 7px monospace; }
.magpie .scope-status i { display:inline-block; width:6px; height:6px; background:var(--muted); border-radius:50%; margin-right:6px; }
.magpie .scope-status i.on { background:var(--acid); box-shadow:0 0 0 1px var(--ink); }
.magpie .scope-hint { position:absolute; left:50%; top:12px; transform:translateX(-50%); background:var(--paper); border:1px solid var(--ink); padding:6px 9px; font:800 8px monospace; letter-spacing:.08em; pointer-events:none; }
.magpie .scope-hint span { color:var(--muted);margin-left:12px;font-size:7px }
.magpie .gesture-crosshair { position:absolute;width:34px;height:34px;border:1px solid var(--ink);border-radius:50%;transform:translate(-50%,-50%);pointer-events:none;transition:opacity .12s }
.magpie .gesture-crosshair:before, .magpie .gesture-crosshair:after { content:"";position:absolute;background:var(--ink) }
.magpie .gesture-crosshair:before { left:50%;top:-9px;bottom:-9px;width:1px }
.magpie .gesture-crosshair:after { top:50%;left:-9px;right:-9px;height:1px }
.magpie .observations { display:grid; grid-template-columns:repeat(5,1fr); border:1px solid var(--ink); border-top:0; }
.magpie .observations span { padding:7px 10px; border-right:1px solid var(--line); font:700 10px monospace; }
.magpie .observations span:last-child { border:0 }
.magpie .observations b { display:block;color:var(--muted);font-size:7px;margin-bottom:4px;letter-spacing:.08em }
.magpie .model-strip { display:grid;grid-template-columns:130px repeat(4,1fr);align-items:stretch;border:1px solid var(--ink);border-top:0;min-height:42px }
.magpie .model-strip>b { display:flex;align-items:center;padding:8px 10px;font:800 8px monospace;letter-spacing:.08em }
.magpie .model-strip button { border:0;border-left:1px solid var(--line);background:transparent;text-align:left;padding:7px 10px;font:800 9px monospace }
.magpie .model-strip button span { display:block;margin-top:3px;color:var(--muted);font-size:7px }
.magpie .model-strip button:hover, .magpie .model-strip button.selected { background:var(--acid) }
.magpie .modules { display:grid; grid-template-columns:repeat(3,1fr); border-bottom:1.5px solid var(--ink); }
.magpie .module { padding:14px 18px 16px; border-right:1px solid var(--ink); }
.magpie .module:first-child { padding-left:0 }
.magpie .module:last-child { border-right:0;padding-right:0 }
.magpie .module-title { display:grid; grid-template-columns:28px 1fr auto; align-items:start; border-bottom:1px solid var(--line); padding-bottom:8px; }
.magpie .module-title>span, .magpie .section-label>div>span { background:var(--acid); width:22px; height:22px; display:grid; place-items:center; border:1px solid var(--ink); font:800 8px monospace; }
.magpie .module-title h2, .magpie .section-label h2 { font-size:17px;line-height:1;margin:0;letter-spacing:-.03em }
.magpie .module-title p, .magpie .section-label p { font:700 7px monospace;color:var(--muted);margin:4px 0 0;letter-spacing:.1em }
.magpie .module-title i { font:700 8px monospace;font-style:normal;color:var(--muted) }
.magpie .knobs { display:flex; justify-content:space-around; gap:12px; padding-top:16px; }
.magpie .knob-control { display:grid;justify-items:center;gap:5px;font:700 8px monospace;letter-spacing:.1em }
.magpie .knob { --turn:0deg;display:block;width:66px;height:66px;border:1.5px solid var(--ink);border-radius:50%;position:relative;background:radial-gradient(circle at 42% 35%,#f9f6ee 0 12%,#bcb8ad 78%,#777 80%,#eee 82%);touch-action:none;user-select:none }
.magpie .knob:focus-within { box-shadow:0 0 0 3px var(--acid) }
.magpie .knob:before { content:"";position:absolute;inset:-7px;border-radius:50%;background:repeating-conic-gradient(from -135deg,var(--ink) 0 1deg,transparent 1deg 12deg);mask:radial-gradient(transparent 0 68%,#000 69% 74%,transparent 75%) }
.magpie .knob i { position:absolute;width:2px;height:27px;background:var(--ink);left:calc(50% - 1px);top:5px;transform-origin:1px 28px;transform:rotate(var(--turn));pointer-events:none }
.magpie .knob input { position:absolute;inset:0;opacity:0;width:100%;height:100%;cursor:ns-resize }
.magpie .knob-readout { font-size:7px;color:var(--muted) }
.magpie .flight-path { padding:14px 0 16px; border-bottom:1.5px solid var(--ink); }
.magpie .section-label { display:grid;grid-template-columns:1fr auto auto;gap:20px;align-items:end;margin-bottom:11px }
.magpie .section-label>div:first-child { display:grid;grid-template-columns:30px auto;column-gap:4px }
.magpie .section-label>div:first-child>span { grid-row:1/3 }
.magpie .section-label small { font:700 7px monospace;color:var(--muted);text-align:right }
.magpie .sequence-settings { display:flex!important;gap:7px }
.magpie .sequence-settings label { font:700 7px monospace;color:var(--muted) }
.magpie .sequence-settings select { display:block;margin-top:4px;min-width:98px;border:1px solid var(--ink);border-radius:0;background:transparent;padding:5px 20px 5px 6px;font:800 8px monospace;color:var(--ink) }
.magpie .steps { display:grid; grid-template-columns:repeat(16,1fr); gap:5px; }
.magpie .steps button { height:56px;border:1px solid var(--ink);background:transparent;position:relative;text-align:left;vertical-align:top;padding:5px;font:700 7px monospace;touch-action:none;user-select:none }
.magpie .steps button span { position:absolute;right:5px;top:5px;font-size:8px }
.magpie .steps button i { position:absolute;left:6px;right:6px;bottom:6px;height:5px;background:rgba(29,29,27,.15) }
.magpie .steps button.normal i, .magpie .steps button.accent i { background:var(--ink) }
.magpie .steps button.normal, .magpie .steps button.accent { background:var(--acid) }
.magpie .steps button.accent:after { content:"!";position:absolute;right:5px;bottom:13px;font:900 13px monospace }
.magpie .steps button.current { box-shadow:inset 0 0 0 3px var(--ink) }
.magpie .keyboard-section { display:grid; grid-template-columns:180px 1fr; padding:14px 0 12px; border-bottom:2px solid var(--ink); }
.magpie .keyboard-note { display:flex;flex-direction:column;justify-content:space-between;padding-right:15px }
.magpie .keyboard-note b { font-size:13px }
.magpie .keyboard-note span { display:block;margin-top:4px;font:700 8px monospace;color:var(--muted) }
.magpie .octave { display:flex;align-items:center;border:1px solid var(--ink);width:max-content }
.magpie .octave button { border:0;background:transparent;width:27px;height:25px }
.magpie .octave span { margin:0;border-left:1px solid var(--ink);border-right:1px solid var(--ink);height:25px;padding:8px 8px 0;color:var(--ink) }
.magpie .keyboard { height:100px; position:relative; display:flex; border:1px solid var(--ink); background:var(--ink); gap:1px; touch-action:none;user-select:none }
.magpie .keyboard button { border:0;position:relative }
.magpie .keyboard .white { background:var(--paper-light);flex:1;align-self:stretch;padding:0 }
.magpie .keyboard .black { background:var(--ink);color:var(--paper);width:7%;height:59%;z-index:2;margin:0 -3.5%;padding:0 }
.magpie .keyboard button span { position:absolute;bottom:23px;left:50%;transform:translateX(-50%);font:700 7px monospace;color:var(--muted) }
.magpie .keyboard button b { position:absolute;bottom:7px;left:50%;transform:translateX(-50%);font:700 8px monospace }
.magpie .keyboard button.pressed { background:var(--acid);color:var(--ink) }
.magpie footer { display:flex;justify-content:space-between;padding-top:8px;font:700 7px monospace;color:var(--muted);letter-spacing:.08em }
@media(max-width:900px) {
.magpie { padding:15px }
.magpie .masthead { align-items:flex-start;gap:14px;flex-direction:column }
.magpie .transport { width:100%;overflow-x:auto }
.magpie .transport button, .magpie .tempo { min-width:90px }
.magpie .modules { grid-template-columns:1fr }
.magpie .module, .magpie .module:first-child, .magpie .module:last-child { border-right:0;border-bottom:1px solid var(--ink);padding:14px 0 }
.magpie .observations { grid-template-columns:repeat(2,1fr) }
.magpie .model-strip { grid-template-columns:repeat(2,1fr) }
.magpie .model-strip>b { grid-column:1/-1;border-bottom:1px solid var(--ink) }
.magpie .model-strip button:nth-of-type(odd) { border-left:0 }
.magpie .steps { grid-template-columns:repeat(8,1fr) }
.magpie .section-label { grid-template-columns:1fr auto }
.magpie .section-label small { grid-column:1/-1;text-align:left }
.magpie .keyboard-section { grid-template-columns:1fr }
.magpie .keyboard-note { flex-direction:row;margin-bottom:8px }
.magpie .keyboard { height:85px }
}
@media(max-width:520px) {
.magpie h1 { font-size:58px }
.magpie .transport { display:grid;grid-template-columns:1fr 1fr }
.magpie .scope-head { align-items:flex-start;gap:10px }
.magpie .preset button { min-width:0 }
.magpie .scope-hint span { display:none }
.magpie .observations { grid-template-columns:1fr }
.magpie .observations span { border-right:0;border-bottom:1px solid var(--line) }
.magpie .section-label { grid-template-columns:1fr }
.magpie .sequence-settings { margin-top:8px }
.magpie .steps { grid-template-columns:repeat(4,1fr) }
.magpie .knob { width:58px;height:58px }
.magpie .keyboard { height:76px }
.magpie .keyboard .black { width:10%;margin:0 -5% }
.magpie footer { gap:8px;flex-wrap:wrap }
}
`;
