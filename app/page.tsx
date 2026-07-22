"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import { MagpieEngine } from "./magpie-engine";
import type { CallModel, EngineParams } from "./magpie-engine";

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
    <main>
      <header className="masthead">
        <div><span className="plate">MZ–02</span><h1>MAGPIE</h1><p>AVIAN SIGNAL SYNTHESIZER</p></div>
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
