"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Params = {
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

const initialParams: Params = { call: 62, tone: 74, grain: 26, glide: 44, flutter: 18, scatter: 36, space: 52, delay: 28, field: 20 };
const notes = [
  { name: "C", midi: 60, key: "A" }, { name: "C♯", midi: 61, key: "W", black: true },
  { name: "D", midi: 62, key: "S" }, { name: "D♯", midi: 63, key: "E", black: true },
  { name: "E", midi: 64, key: "D" }, { name: "F", midi: 65, key: "F" },
  { name: "F♯", midi: 66, key: "T", black: true }, { name: "G", midi: 67, key: "G" },
  { name: "G♯", midi: 68, key: "Y", black: true }, { name: "A", midi: 69, key: "H" },
  { name: "A♯", midi: 70, key: "U", black: true }, { name: "B", midi: 71, key: "J" },
  { name: "C", midi: 72, key: "K" },
];
const presets = ["HEDGEROW", "DAWN CHORUS", "TIN ROOF", "MURMURATION"];

function Knob({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="knob-control">
      <span className="knob" style={{ "--turn": `${-132 + value * 2.64}deg` } as React.CSSProperties}>
        <input aria-label={label} type="range" min="0" max="100" value={value} onChange={(e) => onChange(Number(e.target.value))} />
        <i />
      </span>
      <span className="knob-readout">{String(value).padStart(3, "0")}</span>
      <b>{label}</b>
    </label>
  );
}

export default function Home() {
  const [params, setParams] = useState(initialParams);
  const [steps, setSteps] = useState([true, false, false, true, false, true, false, false, true, false, true, false, false, true, false, false]);
  const [playing, setPlaying] = useState(false);
  const [recording, setRecording] = useState(false);
  const [bpm, setBpm] = useState(112);
  const [currentStep, setCurrentStep] = useState(-1);
  const [activeNotes, setActiveNotes] = useState<number[]>([]);
  const [preset, setPreset] = useState(0);
  const [audioReady, setAudioReady] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const delayRef = useRef<DelayNode | null>(null);
  const feedbackRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const paramsRef = useRef(params);
  const stepRef = useRef(steps);
  const noteTimers = useRef<Map<number, number>>(new Map());

  useEffect(() => { paramsRef.current = params; }, [params]);
  useEffect(() => { stepRef.current = steps; }, [steps]);

  const ensureAudio = useCallback(() => {
    if (!audioRef.current) {
      const AudioCtor = window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtor();
      const master = ctx.createGain();
      const delay = ctx.createDelay(1);
      const feedback = ctx.createGain();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      master.gain.value = 0.68;
      delay.delayTime.value = 0.22;
      feedback.gain.value = 0.25;
      master.connect(analyser); analyser.connect(ctx.destination);
      master.connect(delay); delay.connect(feedback); feedback.connect(delay); delay.connect(analyser);
      audioRef.current = ctx; masterRef.current = master; delayRef.current = delay; feedbackRef.current = feedback; analyserRef.current = analyser;
    }
    if (audioRef.current.state === "suspended") audioRef.current.resume();
    setAudioReady(true);
    return audioRef.current;
  }, []);

  const sound = useCallback((midi: number, duration = 0.32) => {
    const ctx = ensureAudio();
    const master = masterRef.current!;
    const p = paramsRef.current;
    const now = ctx.currentTime;
    const base = 440 * Math.pow(2, (midi - 69) / 12);
    const osc = ctx.createOscillator();
    const harmonic = ctx.createOscillator();
    const gain = ctx.createGain();
    const harmonicGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    osc.type = p.grain > 55 ? "square" : p.tone > 55 ? "triangle" : "sine";
    harmonic.type = "sine";
    const startFreq = base * (0.65 + p.glide / 160);
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(base * (1.2 + p.call / 180), now + duration * 0.32);
    osc.frequency.exponentialRampToValueAtTime(base, now + duration);
    harmonic.frequency.setValueAtTime(base * 2.01, now);
    harmonic.frequency.linearRampToValueAtTime(base * (2.4 + p.flutter / 180), now + duration * 0.5);
    filter.type = "bandpass"; filter.frequency.value = 750 + p.tone * 42; filter.Q.value = 2 + p.grain / 12;
    gain.gain.setValueAtTime(0.0001, now); gain.gain.exponentialRampToValueAtTime(0.22, now + 0.018); gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    harmonicGain.gain.setValueAtTime(0.0001, now); harmonicGain.gain.exponentialRampToValueAtTime(0.06 + p.flutter / 900, now + 0.012); harmonicGain.gain.exponentialRampToValueAtTime(0.0001, now + duration * 0.75);
    osc.connect(filter); harmonic.connect(harmonicGain); harmonicGain.connect(filter); filter.connect(gain); gain.connect(master);
    osc.start(now); harmonic.start(now); osc.stop(now + duration + 0.03); harmonic.stop(now + duration + 0.03);
    if (Math.random() * 100 < p.scatter) {
      const echo = ctx.createOscillator(); const eg = ctx.createGain();
      echo.type = "sine"; echo.frequency.value = base * (1.5 + Math.random());
      eg.gain.setValueAtTime(0.0001, now + duration * 0.45); eg.gain.exponentialRampToValueAtTime(0.07, now + duration * 0.5); eg.gain.exponentialRampToValueAtTime(0.0001, now + duration * 0.85);
      echo.connect(eg); eg.connect(master); echo.start(now + duration * 0.42); echo.stop(now + duration);
    }
  }, [ensureAudio]);

  const trigger = useCallback((midi: number) => {
    sound(midi, 0.28 + paramsRef.current.space / 130);
    setActiveNotes((n) => n.includes(midi) ? n : [...n, midi]);
    const existing = noteTimers.current.get(midi); if (existing) window.clearTimeout(existing);
    noteTimers.current.set(midi, window.setTimeout(() => setActiveNotes((n) => n.filter((v) => v !== midi)), 180));
  }, [sound]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.repeat) return; const n = notes.find((x) => x.key.toLowerCase() === e.key.toLowerCase()); if (n) { e.preventDefault(); trigger(n.midi); } };
    window.addEventListener("keydown", down); return () => window.removeEventListener("keydown", down);
  }, [trigger]);

  useEffect(() => {
    if (!playing) { setCurrentStep(-1); return; }
    ensureAudio(); let i = -1;
    const tick = () => { i = (i + 1) % 16; setCurrentStep(i); if (stepRef.current[i]) trigger(67 + [0, 3, 7, 5][i % 4]); };
    tick(); const id = window.setInterval(tick, 60000 / bpm / 4); return () => window.clearInterval(id);
  }, [playing, bpm, ensureAudio, trigger]);

  useEffect(() => {
    let raf = 0; const canvas = canvasRef.current; if (!canvas) return;
    const draw = () => {
      const dpr = window.devicePixelRatio || 1; const rect = canvas.getBoundingClientRect();
      if (canvas.width !== rect.width * dpr) { canvas.width = rect.width * dpr; canvas.height = rect.height * dpr; }
      const c = canvas.getContext("2d")!; c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, rect.width, rect.height);
      c.strokeStyle = "rgba(29,29,27,.12)"; c.lineWidth = 1;
      for (let x = 0; x < rect.width; x += 32) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, rect.height); c.stroke(); }
      for (let y = 0; y < rect.height; y += 32) { c.beginPath(); c.moveTo(0, y); c.lineTo(rect.width, y); c.stroke(); }
      let data: Uint8Array<ArrayBuffer> | null = null;
      if (analyserRef.current) { data = new Uint8Array(analyserRef.current.fftSize); analyserRef.current.getByteTimeDomainData(data); }
      c.beginPath(); c.strokeStyle = audioReady ? "#1d1d1b" : "#77756e"; c.lineWidth = 2;
      const len = data?.length || 512;
      for (let x = 0; x < rect.width; x++) { const idx = Math.floor((x / rect.width) * len); const idle = Math.sin(x * 0.036 + Date.now() / 900) * 0.04; const v = data ? (data[idx] - 128) / 128 : idle; const y = rect.height / 2 + v * rect.height * .38; x === 0 ? c.moveTo(x, y) : c.lineTo(x, y); } c.stroke();
      raf = requestAnimationFrame(draw);
    }; draw(); return () => cancelAnimationFrame(raf);
  }, [audioReady]);

  const change = (key: keyof Params) => (value: number) => {
    setParams((p) => ({ ...p, [key]: value }));
    if (key === "delay" && delayRef.current) delayRef.current.delayTime.value = 0.04 + value / 190;
    if (key === "space" && feedbackRef.current) feedbackRef.current.gain.value = Math.min(.72, value / 135);
  };
  const randomize = () => { setParams(Object.fromEntries(Object.keys(params).map((k) => [k, 12 + Math.floor(Math.random() * 77)])) as Params); setSteps(Array.from({ length: 16 }, () => Math.random() > .57)); setPreset((p) => (p + 1) % presets.length); };

  return (
    <main>
      <header className="masthead">
        <div><span className="plate">MZ–01</span><h1>MAGPIE</h1><p>AVIAN SIGNAL SYNTHESIZER</p></div>
        <div className="transport" aria-label="Transport controls">
          <label className="tempo"><span>TEMPO / BPM</span><input aria-label="Tempo" type="number" min="60" max="180" value={bpm} onChange={(e) => setBpm(Math.max(60, Math.min(180, Number(e.target.value))))} /></label>
          <button className={playing ? "active" : ""} onClick={() => setPlaying(!playing)}><span className="play-icon">{playing ? "Ⅱ" : "▶"}</span>{playing ? "STOP" : "FLY"}</button>
          <button className={recording ? "recording" : ""} onClick={() => { ensureAudio(); setRecording(!recording); }}><span className="rec-dot" />{recording ? "ARMED" : "REC"}</button>
          <button onClick={randomize}>↝ MUTATE</button>
        </div>
      </header>

      <section className="scope-section">
        <div className="scope-head"><div><span>OBSERVATION 01</span><strong>LIVE SIGNAL / {audioReady ? "ACTIVE" : "AWAITING INPUT"}</strong></div><div className="preset"><span>FIELD PRESET</span><button onClick={() => setPreset((preset + 1) % presets.length)}>{String(preset + 1).padStart(2, "0")} — {presets[preset]} <i>↕</i></button></div></div>
        <div className="scope"><canvas ref={canvasRef} /><div className="axis left">+1<br /><span>0</span><br />−1</div><div className="axis bottom">0.00s <span>0.25</span><span>0.50</span><span>0.75</span> 1.00s</div><div className="scope-status"><i className={audioReady ? "on" : ""} /> AUDIO ENGINE {audioReady ? "ONLINE" : "STANDBY"}</div></div>
        <div className="observations"><span><b>FUNDAMENTAL</b>{activeNotes.length ? `${Math.round(440 * Math.pow(2, (activeNotes[0] - 69) / 12))} Hz` : "— Hz"}</span><span><b>HARMONICS</b>{params.tone}%</span><span><b>MIGRATION</b>{params.glide}%</span><span><b>AIR DENSITY</b>{params.field}%</span><span><b>SPECIMEN</b>Corvidae / synthetic</span></div>
      </section>

      <section className="modules">
        <div className="module"><div className="module-title"><span>01</span><div><h2>VOICE</h2><p>VOCAL MORPHOLOGY</p></div><i>VCE</i></div><div className="knobs"><Knob label="CALL" value={params.call} onChange={change("call")} /><Knob label="TONE" value={params.tone} onChange={change("tone")} /><Knob label="GRAIN" value={params.grain} onChange={change("grain")} /></div></div>
        <div className="module"><div className="module-title"><span>02</span><div><h2>FLIGHT</h2><p>MOTION &amp; MODULATION</p></div><i>FLT</i></div><div className="knobs"><Knob label="GLIDE" value={params.glide} onChange={change("glide")} /><Knob label="FLUTTER" value={params.flutter} onChange={change("flutter")} /><Knob label="SCATTER" value={params.scatter} onChange={change("scatter")} /></div></div>
        <div className="module"><div className="module-title"><span>03</span><div><h2>HABITAT</h2><p>ACOUSTIC ENVIRONMENT</p></div><i>HBT</i></div><div className="knobs"><Knob label="SPACE" value={params.space} onChange={change("space")} /><Knob label="DELAY" value={params.delay} onChange={change("delay")} /><Knob label="FIELD" value={params.field} onChange={change("field")} /></div></div>
      </section>

      <section className="flight-path">
        <div className="section-label"><div><span>04</span><h2>FLIGHT PATH</h2><p>16–STEP CALL SEQUENCE</p></div><small>CLICK CELLS TO ALTER MIGRATION</small></div>
        <div className="steps">{steps.map((on, i) => <button key={i} aria-label={`Step ${i + 1}`} aria-pressed={on} className={`${on ? "on" : ""} ${currentStep === i ? "current" : ""}`} onClick={() => setSteps((s) => s.map((v, x) => x === i ? !v : v))}><b>{String(i + 1).padStart(2, "0")}</b><i /></button>)}</div>
      </section>

      <section className="keyboard-section">
        <div className="keyboard-note"><b>MANUAL CALL</b><span>KEYBOARD INPUT / A–K</span></div>
        <div className="keyboard">{notes.map((n) => <button key={`${n.midi}`} className={`${n.black ? "black" : "white"} ${activeNotes.includes(n.midi) ? "pressed" : ""}`} onPointerDown={() => trigger(n.midi)} aria-label={`${n.name} note`}><span>{n.key}</span><b>{n.name}{n.midi === 60 || n.midi === 72 ? (n.midi === 60 ? "4" : "5") : ""}</b></button>)}</div>
      </section>
      <footer><span>MAGPIE SIGNAL LABORATORY</span><span>WEB AUDIO / POLYPHONIC / GENERATIVE</span><span>FIELD UNIT № 01</span></footer>
    </main>
  );
}
