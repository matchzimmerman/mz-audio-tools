"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  KIT,
  PATTERN,
  randomizePattern,
  randomizeVoice,
  triggerVoice,
  fmtPitch,
} from "../erd-engine";
import type { Chain, Part } from "../erd-engine";

type DeviceType = "audio" | "visual" | "system";
type Device = {
  id: string;
  name: string;
  type: DeviceType;
  href?: string;
  hosted?: boolean;
  subtitle: string;
};

type HostRig = {
  ctx: AudioContext;
  gullBus: GainNode;
  erdBus: GainNode;
  main: GainNode;
  analyser: AnalyserNode;
};

type ErdGraph = {
  chains: Chain[];
  sum: GainNode;
  out: GainNode;
  dly: DelayNode;
  fb: GainNode;
};

type Snapshot = {
  bpm: number;
  root: number;
  scale: string;
  mainLevel: number;
  active: string;
  gullFollow: boolean;
  gullLocalBpm: number;
  gullLocalRoot: number;
  gullLocalScale: string;
  erdTempoFollow: boolean;
  erdPitchFollow: boolean;
  erdLocalBpm: number;
  erdSwing: number;
  erdSteps: number[][];
  erdMutes: boolean[];
  erdParts: Part[];
};

const DEVICES: Device[] = [
  { id: "01", name: "GULL", type: "audio", hosted: true, subtitle: "AVIAN SIGNAL SYNTHESIZER" },
  { id: "02", name: "SERIAL", type: "audio", href: "/serial", subtitle: "SEQUENTIAL EFFECTS LAB" },
  { id: "03", name: "ER·D", type: "audio", hosted: true, subtitle: "SIX-VOICE PERCUSSION SYNTH" },
  { id: "04", name: "COASTS", type: "audio", href: "/coasts", subtitle: "DUAL SYNTHESIS PHILOSOPHY" },
  { id: "07", name: "FIELD CHORUS", type: "audio", href: "/field-chorus", subtitle: "MID-ATLANTIC ECOLOGY MIXER" },
  { id: "08", name: "EMERGENT FIELD", type: "audio", href: "/emergent-field", subtitle: "GENERATIVE MIX-AWARE INSTRUMENT" },
  { id: "05", name: "SPECTRAL PARTICLES", type: "visual", href: "/spectral-particles", subtitle: "FREQUENCY PHYSICS VISUALIZER" },
  { id: "06", name: "VISUAL ENGINE", type: "visual", href: "/visual-engine", subtitle: "MULTI-SEND ORGANIC BIT SYSTEM" },
  { id: "RT", name: "ROUTING", type: "system", hosted: true, subtitle: "SIGNAL + CONTROL GRAPH" },
];

const ROOTS = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
const SCALES: Record<string, number[]> = {
  MAJOR: [0, 2, 4, 5, 7, 9, 11],
  MINOR: [0, 2, 3, 5, 7, 8, 10],
  DORIAN: [0, 2, 3, 5, 7, 9, 10],
  PHRYGIAN: [0, 1, 3, 5, 7, 8, 10],
  PENTATONIC: [0, 2, 4, 7, 9],
};

const midiToHz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);
const hzToMidi = (hz: number) => 69 + 12 * Math.log2(hz / 440);

function snapToScale(hz: number, root: number, scale: string) {
  const midi = hzToMidi(hz);
  const intervals = SCALES[scale] ?? SCALES.DORIAN;
  let best = Math.round(midi);
  let dist = Infinity;
  for (let note = Math.floor(midi) - 6; note <= Math.ceil(midi) + 6; note++) {
    const pc = ((note - root) % 12 + 12) % 12;
    if (!intervals.includes(pc)) continue;
    const d = Math.abs(note - midi);
    if (d < dist) { dist = d; best = note; }
  }
  return midiToHz(best);
}

function makeErdGraph(ctx: AudioContext, destination: AudioNode, parts: Part[]): ErdGraph {
  const out = ctx.createGain();
  out.gain.value = 0.9;
  const sum = ctx.createGain();
  sum.gain.value = 0.42;
  sum.connect(out);
  out.connect(destination);

  const dly = ctx.createDelay(2);
  dly.delayTime.value = 0.24;
  const damp = ctx.createBiquadFilter();
  damp.type = "lowpass";
  damp.frequency.value = 3400;
  const fb = ctx.createGain();
  fb.gain.value = 0.24;
  dly.connect(damp);
  damp.connect(fb);
  fb.connect(dly);
  damp.connect(sum);

  const chains = parts.map((p) => {
    const inG = ctx.createGain();
    inG.gain.value = p.level;
    const shelf = ctx.createBiquadFilter();
    shelf.type = "lowshelf";
    shelf.frequency.value = 150;
    shelf.gain.value = p.low * 15;
    const pan = ctx.createStereoPanner();
    pan.pan.value = p.pan;
    const send = ctx.createGain();
    send.gain.value = p.send * 0.9;
    inG.connect(shelf);
    shelf.connect(pan);
    pan.connect(sum);
    pan.connect(send);
    send.connect(dly);
    return { in: inG, shelf, pan, send };
  });

  return { chains, sum, out, dly, fb };
}

export default function SonicLabHostV02() {
  const [active, setActive] = useState("01");
  const [bpm, setBpm] = useState(112);
  const [root, setRoot] = useState(2);
  const [scale, setScale] = useState("DORIAN");
  const [mainLevel, setMainLevel] = useState(0.72);
  const [running, setRunning] = useState(false);
  const [performance, setPerformance] = useState(false);
  const [status, setStatus] = useState("HOST V02 READY / 2 NATIVE DEVICES ONLINE");
  const [captureMode, setCaptureMode] = useState(false);
  const [snapshots, setSnapshots] = useState<Record<string, Snapshot | null>>({ A: null, B: null, C: null, D: null });

  const [gullFollow, setGullFollow] = useState(true);
  const [gullLocalBpm, setGullLocalBpm] = useState(96);
  const [gullLocalRoot, setGullLocalRoot] = useState(9);
  const [gullLocalScale, setGullLocalScale] = useState("PENTATONIC");
  const [gullDensity, setGullDensity] = useState(0.56);
  const [gullSpace, setGullSpace] = useState(0.38);

  const [erdParts, setErdParts] = useState<Part[]>(() => KIT.map((p) => ({ ...p })));
  const [erdSteps, setErdSteps] = useState<number[][]>(() => PATTERN.map((r) => [...r]));
  const [erdMutes, setErdMutes] = useState<boolean[]>(() => KIT.map(() => false));
  const [erdTempoFollow, setErdTempoFollow] = useState(true);
  const [erdPitchFollow, setErdPitchFollow] = useState(false);
  const [erdLocalBpm, setErdLocalBpm] = useState(96);
  const [erdSwing, setErdSwing] = useState(0.12);
  const [erdSelected, setErdSelected] = useState(0);
  const [erdUiStep, setErdUiStep] = useState(-1);

  const [gullToMain, setGullToMain] = useState(true);
  const [erdToMain, setErdToMain] = useState(true);
  const [analysisOn, setAnalysisOn] = useState(true);

  const rigRef = useRef<HostRig | null>(null);
  const erdGraphRef = useRef<ErdGraph | null>(null);
  const gullTimerRef = useRef<number | null>(null);
  const gullStepRef = useRef(0);
  const erdTimerRef = useRef<number | null>(null);
  const erdRafRef = useRef<number | null>(null);
  const erdStepRef = useRef(0);
  const erdNextRef = useRef(0);
  const erdQueueRef = useRef<[number, number][]>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const selected = useMemo(() => DEVICES.find((d) => d.id === active) ?? DEVICES[0], [active]);
  const effectiveGullBpm = gullFollow ? bpm : gullLocalBpm;
  const effectiveGullRoot = gullFollow ? root : gullLocalRoot;
  const effectiveGullScale = gullFollow ? scale : gullLocalScale;
  const effectiveErdBpm = erdTempoFollow ? bpm : erdLocalBpm;

  const ensureRig = useCallback(async () => {
    if (!rigRef.current) {
      const Ctx = window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      const gullBus = ctx.createGain();
      const erdBus = ctx.createGain();
      const main = ctx.createGain();
      const analyser = ctx.createAnalyser();
      gullBus.gain.value = gullToMain ? 1 : 0;
      erdBus.gain.value = erdToMain ? 1 : 0;
      main.gain.value = mainLevel;
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.8;
      gullBus.connect(main);
      erdBus.connect(main);
      main.connect(analyser);
      analyser.connect(ctx.destination);
      rigRef.current = { ctx, gullBus, erdBus, main, analyser };
    }
    if (rigRef.current.ctx.state === "suspended") await rigRef.current.ctx.resume();
    return rigRef.current;
  }, [erdToMain, gullToMain, mainLevel]);

  const ensureErd = useCallback(async () => {
    const rig = await ensureRig();
    if (!erdGraphRef.current) erdGraphRef.current = makeErdGraph(rig.ctx, rig.erdBus, erdParts);
    return { rig, graph: erdGraphRef.current };
  }, [ensureRig, erdParts]);

  useEffect(() => {
    const rig = rigRef.current;
    if (!rig) return;
    const now = rig.ctx.currentTime;
    rig.main.gain.setTargetAtTime(mainLevel, now, 0.025);
    rig.gullBus.gain.setTargetAtTime(gullToMain ? 1 : 0, now, 0.025);
    rig.erdBus.gain.setTargetAtTime(erdToMain ? 1 : 0, now, 0.025);
  }, [mainLevel, gullToMain, erdToMain]);

  useEffect(() => {
    const graph = erdGraphRef.current;
    const rig = rigRef.current;
    if (!graph || !rig) return;
    const now = rig.ctx.currentTime;
    erdParts.forEach((p, i) => {
      const chain = graph.chains[i];
      chain.in.gain.setTargetAtTime(p.level, now, 0.015);
      chain.shelf.gain.setTargetAtTime(p.low * 15, now, 0.015);
      chain.pan.pan.setTargetAtTime(p.pan, now, 0.015);
      chain.send.gain.setTargetAtTime(p.send * 0.9, now, 0.015);
    });
    graph.dly.delayTime.setTargetAtTime(Math.min(1.9, (60 / effectiveErdBpm / 4) * 3), now, 0.04);
  }, [erdParts, effectiveErdBpm]);

  const gullCall = useCallback(async (accent = false) => {
    const rig = await ensureRig();
    const intervals = SCALES[effectiveGullScale] ?? SCALES.DORIAN;
    const degree = gullStepRef.current++ % intervals.length;
    const midi = 60 + effectiveGullRoot + intervals[degree] + (degree > intervals.length * 0.62 ? 12 : 0);
    const now = rig.ctx.currentTime;
    const osc = rig.ctx.createOscillator();
    const harmonic = rig.ctx.createOscillator();
    const amp = rig.ctx.createGain();
    const pan = rig.ctx.createStereoPanner();
    const flutter = rig.ctx.createOscillator();
    const flutterDepth = rig.ctx.createGain();
    const air = rig.ctx.createBiquadFilter();
    osc.type = "triangle";
    harmonic.type = "sine";
    osc.frequency.value = midiToHz(midi);
    harmonic.frequency.value = midiToHz(midi) * 2.01;
    harmonic.detune.value = Math.random() * 14 - 7;
    flutter.frequency.value = 7 + Math.random() * 9;
    flutterDepth.gain.value = 5 + Math.random() * 18;
    flutter.connect(flutterDepth).connect(osc.frequency);
    air.type = "highpass";
    air.frequency.value = 180 + gullSpace * 900;
    pan.pan.value = Math.max(-0.9, Math.min(0.9, Math.sin(gullStepRef.current * 1.7) * (0.35 + gullSpace * 0.5)));
    amp.gain.setValueAtTime(0.0001, now);
    amp.gain.exponentialRampToValueAtTime(accent ? 0.22 : 0.11 + gullDensity * 0.06, now + 0.018);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + (accent ? 0.72 : 0.36 + gullSpace * 0.35));
    osc.connect(amp);
    harmonic.connect(amp);
    amp.connect(air).connect(pan).connect(rig.gullBus);
    osc.start(now); harmonic.start(now); flutter.start(now);
    osc.stop(now + 0.9); harmonic.stop(now + 0.9); flutter.stop(now + 0.9);
  }, [ensureRig, effectiveGullRoot, effectiveGullScale, gullDensity, gullSpace]);

  const triggerErdPart = useCallback(async (index: number, accent = true) => {
    const { rig, graph } = await ensureErd();
    if (erdMutes[index]) return;
    let part = erdParts[index];
    if (erdPitchFollow && part.osc !== "noise") part = { ...part, pitch: snapToScale(part.pitch, root, scale) };
    triggerVoice(rig.ctx, graph.chains[index], part, rig.ctx.currentTime + 0.012, accent);
  }, [ensureErd, erdMutes, erdParts, erdPitchFollow, root, scale]);

  const startErdClock = useCallback(async () => {
    const { rig, graph } = await ensureErd();
    const ctx = rig.ctx;
    erdNextRef.current = ctx.currentTime + 0.06;
    erdStepRef.current = 0;
    erdQueueRef.current = [];

    if (erdTimerRef.current) window.clearInterval(erdTimerRef.current);
    erdTimerRef.current = window.setInterval(() => {
      const sd = 60 / effectiveErdBpm / 4;
      while (erdNextRef.current < ctx.currentTime + 0.12) {
        const step = erdStepRef.current;
        const off = step % 2 === 1 ? erdSwing * sd * 0.5 : 0;
        const t = erdNextRef.current + off;
        erdSteps.forEach((row, i) => {
          const val = row[step];
          if (!val || erdMutes[i]) return;
          let part = erdParts[i];
          if (erdPitchFollow && part.osc !== "noise") part = { ...part, pitch: snapToScale(part.pitch, root, scale) };
          triggerVoice(ctx, graph.chains[i], part, t, val === 2);
        });
        erdQueueRef.current.push([step, t]);
        erdNextRef.current += sd;
        erdStepRef.current = (step + 1) % 16;
      }
    }, 25);

    const draw = () => {
      let cur: number | null = null;
      while (erdQueueRef.current.length && erdQueueRef.current[0][1] <= ctx.currentTime) cur = erdQueueRef.current.shift()![0];
      if (cur !== null) setErdUiStep(cur);
      erdRafRef.current = requestAnimationFrame(draw);
    };
    erdRafRef.current = requestAnimationFrame(draw);
  }, [ensureErd, effectiveErdBpm, erdSwing, erdSteps, erdMutes, erdParts, erdPitchFollow, root, scale]);

  const stopErdClock = useCallback(() => {
    if (erdTimerRef.current) window.clearInterval(erdTimerRef.current);
    if (erdRafRef.current) cancelAnimationFrame(erdRafRef.current);
    erdTimerRef.current = null;
    erdRafRef.current = null;
    erdQueueRef.current = [];
    setErdUiStep(-1);
  }, []);

  const startGullClock = useCallback(() => {
    if (gullTimerRef.current) window.clearInterval(gullTimerRef.current);
    void gullCall(true);
    const interval = Math.max(90, (60000 / effectiveGullBpm) / 2);
    gullTimerRef.current = window.setInterval(() => {
      if (Math.random() <= 0.35 + gullDensity * 0.65) void gullCall(gullStepRef.current % 4 === 0);
    }, interval);
  }, [effectiveGullBpm, gullCall, gullDensity]);

  const stopGullClock = useCallback(() => {
    if (gullTimerRef.current) window.clearInterval(gullTimerRef.current);
    gullTimerRef.current = null;
  }, []);

  const toggleTransport = async () => {
    await ensureRig();
    const next = !running;
    setRunning(next);
    if (next) {
      startGullClock();
      await startErdClock();
      setStatus("GLOBAL TRANSPORT / RUNNING · GULL + ER·D CLOCKED");
    } else {
      stopGullClock();
      stopErdClock();
      setStatus("GLOBAL TRANSPORT / STOPPED");
    }
  };

  useEffect(() => {
    if (!running) return;
    stopGullClock();
    startGullClock();
  }, [running, effectiveGullBpm, gullDensity, startGullClock, stopGullClock]);

  useEffect(() => {
    if (!running) return;
    stopErdClock();
    void startErdClock();
  }, [running, effectiveErdBpm, erdSwing, erdSteps, erdMutes, erdParts, erdPitchFollow, root, scale, startErdClock, stopErdClock]);

  useEffect(() => () => {
    stopGullClock();
    stopErdClock();
    void rigRef.current?.ctx.close();
  }, [stopErdClock, stopGullClock]);

  useEffect(() => {
    const raw = window.localStorage.getItem("mzcmg-sonic-lab-v02-snapshots");
    if (!raw) return;
    try { setSnapshots(JSON.parse(raw)); } catch { /* ignore malformed prior state */ }
  }, []);

  useEffect(() => {
    let frame = 0;
    const draw = () => {
      const canvas = canvasRef.current;
      const analyser = rigRef.current?.analyser;
      if (canvas && analyser && analysisOn) {
        const rect = canvas.getBoundingClientRect();
        const ratio = window.devicePixelRatio || 1;
        const width = Math.max(1, Math.floor(rect.width * ratio));
        const height = Math.max(1, Math.floor(rect.height * ratio));
        if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
        const ctx = canvas.getContext("2d");
        if (ctx) {
          const data = new Uint8Array(analyser.frequencyBinCount);
          analyser.getByteFrequencyData(data);
          ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
          ctx.clearRect(0, 0, rect.width, rect.height);
          const bars = 64;
          for (let i = 0; i < bars; i++) {
            const v = data[Math.floor((i / bars) * data.length * 0.48)] / 255;
            ctx.fillStyle = i % 4 === 0 ? "#b06ab3" : "#1d1d1b";
            const w = rect.width / bars;
            ctx.fillRect(i * w, rect.height - v * rect.height, Math.max(1, w - 1), v * rect.height);
          }
        }
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [analysisOn]);

  const cycleErdStep = (row: number, col: number) => {
    setErdSteps((current) => current.map((r, ri) => ri === row ? r.map((v, ci) => ci === col ? (v + 1) % 3 : v) : [...r]));
    if (!running && erdSteps[row][col] === 0) void triggerErdPart(row, true);
  };

  const randomizeSelectedVoice = () => {
    setErdParts((current) => current.map((p, i) => i === erdSelected ? randomizeVoice(p.name, !erdPitchFollow) : p));
    window.setTimeout(() => { void triggerErdPart(erdSelected, true); }, 35);
  };

  const makeSnapshot = (): Snapshot => ({
    bpm, root, scale, mainLevel, active,
    gullFollow, gullLocalBpm, gullLocalRoot, gullLocalScale,
    erdTempoFollow, erdPitchFollow, erdLocalBpm, erdSwing,
    erdSteps: erdSteps.map((r) => [...r]),
    erdMutes: [...erdMutes],
    erdParts: erdParts.map((p) => ({ ...p })),
  });

  const handleSnapshot = (slot: string) => {
    if (captureMode || !snapshots[slot]) {
      const next = { ...snapshots, [slot]: makeSnapshot() };
      setSnapshots(next);
      window.localStorage.setItem("mzcmg-sonic-lab-v02-snapshots", JSON.stringify(next));
      setCaptureMode(false);
      setStatus(`SNAPSHOT ${slot} / CAPTURED`);
      return;
    }
    const s = snapshots[slot];
    if (!s) return;
    setBpm(s.bpm); setRoot(s.root); setScale(s.scale); setMainLevel(s.mainLevel); setActive(s.active);
    setGullFollow(s.gullFollow); setGullLocalBpm(s.gullLocalBpm); setGullLocalRoot(s.gullLocalRoot); setGullLocalScale(s.gullLocalScale);
    setErdTempoFollow(s.erdTempoFollow); setErdPitchFollow(s.erdPitchFollow); setErdLocalBpm(s.erdLocalBpm); setErdSwing(s.erdSwing);
    setErdSteps(s.erdSteps.map((r) => [...r])); setErdMutes([...s.erdMutes]); setErdParts(s.erdParts.map((p) => ({ ...p })));
    setStatus(`SNAPSHOT ${slot} / RECALLED`);
  };

  const setDevice = (id: string) => {
    setActive(id);
    const d = DEVICES.find((x) => x.id === id);
    if (d) setStatus(`${d.hosted ? "NATIVE DEVICE" : "ADAPTER DEVICE"} / ${d.name}`);
  };

  return (
    <main className={`sl2 ${performance ? "perform" : ""}`}>
      <style>{STYLES}</style>

      <header className="sl2-top">
        <div className="sl2-brand">
          <strong>MZCMG // SONIC LAB</strong>
          <span>HOST V02 · INTERCONNECTED AUDIO + VISUAL FIELD SYSTEM</span>
        </div>
        <button className={`transport ${running ? "on" : ""}`} onClick={() => void toggleTransport()}>{running ? "■ STOP" : "▶ RUN"}</button>
        <div className="global-controls">
          <label><span>BPM</span><input type="number" min="40" max="220" value={bpm} onChange={(e) => setBpm(Math.max(40, Math.min(220, Number(e.target.value))))} /></label>
          <label><span>KEY</span><select value={root} onChange={(e) => setRoot(Number(e.target.value))}>{ROOTS.map((n, i) => <option key={n} value={i}>{n}</option>)}</select></label>
          <label><span>SCALE</span><select value={scale} onChange={(e) => setScale(e.target.value)}>{Object.keys(SCALES).map((n) => <option key={n}>{n}</option>)}</select></label>
          <label className="main-level"><span>MAIN</span><input type="range" min="0" max="1" step="0.01" value={mainLevel} onChange={(e) => setMainLevel(Number(e.target.value))} /><b>{Math.round(mainLevel * 100)}</b></label>
        </div>
        <button className={`perform-btn ${performance ? "on" : ""}`} onClick={() => setPerformance((v) => !v)}>{performance ? "EDIT" : "PERFORM"}</button>
      </header>

      <div className="sl2-subbar">
        <div className="snapshots"><b>SNAPSHOTS</b>{["A", "B", "C", "D"].map((slot) => <button key={slot} className={snapshots[slot] ? "saved" : ""} onClick={() => handleSnapshot(slot)}>{slot}</button>)}<button className={captureMode ? "capture on" : "capture"} onClick={() => setCaptureMode((v) => !v)}>{captureMode ? "CHOOSE SLOT" : "CAPTURE"}</button></div>
        <div className="context"><i className={running ? "live" : ""} /> {status}</div>
        <div className="taxonomy"><span>AUDIO / ACID</span><span className="visual">VISUAL / PURPLE</span><span>SYSTEM / NEUTRAL</span></div>
      </div>

      <section className="sl2-body">
        <aside className="device-rail">
          <div className="rail-title"><b>FIELD INDEX</b><span>DEVICE LIBRARY</span></div>
          {DEVICES.map((d) => (
            <button key={d.id} onClick={() => setDevice(d.id)} className={`${d.type} ${active === d.id ? "active" : ""}`}>
              <i>{d.id}</i><span><b>{d.name}</b><small>{d.subtitle}</small></span><em>{d.hosted ? "NATIVE" : "ADAPTER"}</em>
            </button>
          ))}
        </aside>

        <section className="workbench">
          <div className="device-header">
            <div><small>{selected.type.toUpperCase()} DEVICE / {selected.hosted ? "HOSTED NATIVE" : "EMBEDDED ADAPTER"}</small><h1>{selected.name}</h1><p>{selected.subtitle}</p></div>
            <div className="device-id"><span>MZCMG_SL-{selected.id}</span><b>{selected.hosted ? "CONNECTED" : "MIGRATION QUEUE"}</b></div>
          </div>

          {selected.id === "01" && (
            <div className="native-device gull-device">
              <div className="control-strip">
                <div className="mode-block"><small>MUSICAL CONTEXT</small><strong>{ROOTS[effectiveGullRoot]} / {effectiveGullScale}</strong><button className={gullFollow ? "follow on" : "follow"} onClick={() => setGullFollow((v) => !v)}>{gullFollow ? "FOLLOW GLOBAL" : "LOCAL"}</button></div>
                {!gullFollow && <><label><span>LOCAL BPM</span><input type="number" min="40" max="220" value={gullLocalBpm} onChange={(e) => setGullLocalBpm(Number(e.target.value))} /></label><label><span>LOCAL KEY</span><select value={gullLocalRoot} onChange={(e) => setGullLocalRoot(Number(e.target.value))}>{ROOTS.map((n, i) => <option key={n} value={i}>{n}</option>)}</select></label><label><span>LOCAL SCALE</span><select value={gullLocalScale} onChange={(e) => setGullLocalScale(e.target.value)}>{Object.keys(SCALES).map((n) => <option key={n}>{n}</option>)}</select></label></>}
                <button className="big-trigger" onClick={() => void gullCall(true)}>TRIGGER CALL</button>
              </div>
              <div className="gull-grid">
                <label className="macro"><span>DENSITY</span><input type="range" min="0" max="1" step="0.01" value={gullDensity} onChange={(e) => setGullDensity(Number(e.target.value))} /><b>{Math.round(gullDensity * 100)}</b><small>EVENT PROBABILITY / PHRASE ACTIVITY</small></label>
                <label className="macro"><span>SPACE</span><input type="range" min="0" max="1" step="0.01" value={gullSpace} onChange={(e) => setGullSpace(Number(e.target.value))} /><b>{Math.round(gullSpace * 100)}</b><small>STEREO WIDTH / AIR / DECAY</small></label>
                <article><small>CLOCK SOURCE</small><strong>{gullFollow ? "GLOBAL" : "LOCAL"}</strong><p>{effectiveGullBpm} BPM · HALF-BEAT EVENT GRID</p></article>
                <article><small>OUTPUT BUS</small><strong>GULL OUT</strong><p>{gullToMain ? "CONNECTED → MAIN" : "MUTED AT ROUTER"}</p><button onClick={() => setActive("RT")}>OPEN ROUTING →</button></article>
              </div>
            </div>
          )}

          {selected.id === "03" && (
            <div className="native-device erd-device">
              <div className="erd-context">
                <div><small>TEMPO</small><strong>{effectiveErdBpm} BPM</strong><button className={erdTempoFollow ? "follow on" : "follow"} onClick={() => setErdTempoFollow((v) => !v)}>{erdTempoFollow ? "FOLLOW GLOBAL" : "LOCAL"}</button>{!erdTempoFollow && <input type="number" min="40" max="220" value={erdLocalBpm} onChange={(e) => setErdLocalBpm(Number(e.target.value))} />}</div>
                <div><small>PITCH MAP</small><strong>{erdPitchFollow ? `${ROOTS[root]} / ${scale}` : "D / PHRYGIAN"}</strong><button className={erdPitchFollow ? "follow on" : "follow"} onClick={() => setErdPitchFollow((v) => !v)}>{erdPitchFollow ? "FOLLOW GLOBAL" : "LOCAL"}</button></div>
                <label><small>SWING</small><strong>{Math.round(erdSwing * 100)}%</strong><input type="range" min="0" max="0.7" step="0.01" value={erdSwing} onChange={(e) => setErdSwing(Number(e.target.value))} /></label>
                <button onClick={() => setErdSteps(randomizePattern())}>RANDOMIZE PATTERN</button>
              </div>

              <div className="erd-seq">
                {erdParts.map((part, row) => (
                  <div className={`erd-row ${erdSelected === row ? "selected" : ""}`} key={part.name}>
                    <button className="voice-name" onClick={() => { setErdSelected(row); void triggerErdPart(row, true); }}><b>{part.name}</b><small>{part.osc.toUpperCase()} · {fmtPitch(erdPitchFollow && part.osc !== "noise" ? snapToScale(part.pitch, root, scale) : part.pitch, part.osc)}</small></button>
                    <button className={`mute ${erdMutes[row] ? "on" : ""}`} onClick={() => setErdMutes((m) => m.map((v, i) => i === row ? !v : v))}>M</button>
                    <div className="steps">{erdSteps[row].map((value, col) => <button key={col} className={`${value === 1 ? "hit" : value === 2 ? "accent" : ""} ${erdUiStep === col ? "play" : ""}`} onClick={() => cycleErdStep(row, col)}><span>{col + 1}</span></button>)}</div>
                  </div>
                ))}
              </div>

              <div className="erd-editor">
                <div><small>SELECTED VOICE</small><h2>{erdParts[erdSelected].name}</h2><p>{erdParts[erdSelected].osc.toUpperCase()} / {erdParts[erdSelected].mod.toUpperCase()}</p><button onClick={randomizeSelectedVoice}>DICE VOICE</button></div>
                <label><span>PITCH</span><input type="range" min="40" max="1800" step="1" value={Math.min(1800, erdParts[erdSelected].pitch)} onChange={(e) => setErdParts((ps) => ps.map((p, i) => i === erdSelected ? { ...p, pitch: Number(e.target.value) } : p))} /><b>{fmtPitch(erdParts[erdSelected].pitch, erdParts[erdSelected].osc)}</b></label>
                <label><span>DECAY</span><input type="range" min="0.02" max="1.3" step="0.01" value={erdParts[erdSelected].decay} onChange={(e) => setErdParts((ps) => ps.map((p, i) => i === erdSelected ? { ...p, decay: Number(e.target.value) } : p))} /><b>{Math.round(erdParts[erdSelected].decay * 1000)}ms</b></label>
                <label><span>LEVEL</span><input type="range" min="0" max="1" step="0.01" value={erdParts[erdSelected].level} onChange={(e) => setErdParts((ps) => ps.map((p, i) => i === erdSelected ? { ...p, level: Number(e.target.value) } : p))} /><b>{Math.round(erdParts[erdSelected].level * 100)}</b></label>
                <label><span>DELAY SEND</span><input type="range" min="0" max="1" step="0.01" value={erdParts[erdSelected].send} onChange={(e) => setErdParts((ps) => ps.map((p, i) => i === erdSelected ? { ...p, send: Number(e.target.value) } : p))} /><b>{Math.round(erdParts[erdSelected].send * 100)}</b></label>
              </div>
            </div>
          )}

          {selected.id === "RT" && (
            <div className="native-device routing-device">
              <div className="route-board">
                <div className="route-row"><div className="node source"><small>AUDIO DEVICE 01</small><b>GULL</b><span>STEREO OUT</span></div><span className="arrow">→</span><button className={`node switch ${gullToMain ? "enabled" : ""}`} onClick={() => setGullToMain((v) => !v)}><small>AUDIO ROUTE</small><b>{gullToMain ? "CONNECTED" : "MUTED"}</b><span>TO MAIN BUS</span></button><span className="arrow">→</span><div className="node main-node"><small>OUTPUT</small><b>MAIN</b><span>{Math.round(mainLevel * 100)}%</span></div></div>
                <div className="route-row"><div className="node source"><small>AUDIO DEVICE 03</small><b>ER·D</b><span>STEREO OUT</span></div><span className="arrow">→</span><button className={`node switch ${erdToMain ? "enabled" : ""}`} onClick={() => setErdToMain((v) => !v)}><small>AUDIO ROUTE</small><b>{erdToMain ? "CONNECTED" : "MUTED"}</b><span>TO MAIN BUS</span></button><span className="arrow">→</span><div className="node main-node"><small>OUTPUT</small><b>MAIN</b><span>{Math.round(mainLevel * 100)}%</span></div></div>
                <div className="route-row"><div className="node source combined"><small>ANALYSIS TAP</small><b>MAIN BUS</b><span>POST LEVEL</span></div><span className="arrow">→</span><button className={`node switch visual-route ${analysisOn ? "enabled" : ""}`} onClick={() => setAnalysisOn((v) => !v)}><small>DATA ROUTE</small><b>{analysisOn ? "ANALYSIS ON" : "ANALYSIS OFF"}</b><span>FFT / ENERGY BUS</span></button><span className="arrow">→</span><div className="node visual-node"><small>VISUAL DESTINATION</small><b>SPECTRAL BUS</b><span>SHARED SIGNAL</span></div></div>
              </div>
              <div className="analysis-panel"><div><small>LIVE SHARED ANALYSIS BUS</small><strong>MAIN → FFT / 64 BANDS</strong><p>This is the first common data surface. Future devices can subscribe to transient, band-energy, envelope, clock, note and modulation channels.</p></div><canvas ref={canvasRef} /></div>
              <div className="route-legend"><span><b>AUDIO</b> sound signal</span><span><b>CONTROL</b> clock / note / envelope</span><span><b>DATA</b> analysis → visual systems</span></div>
            </div>
          )}

          {!selected.hosted && selected.href && (
            <div className="adapter-device">
              <div className="adapter-note"><div><b>EMBEDDED ADAPTER</b><span>This device remains fully usable inside the SONIC LAB shell while its audio/control endpoints are migrated into the native host graph.</span></div><div><strong>PHASE 02</strong><span>GLOBAL FOLLOW + ROUTABLE I/O</span></div></div>
              <iframe title={selected.name} src={selected.href} className="device-frame" />
            </div>
          )}
        </section>
      </section>

      <footer className="sl2-foot"><span>MZCMG // SONIC LAB · HOST V02</span><span>2 NATIVE DEVICES / 6 EMBEDDED ADAPTERS / SHARED AUDIO + ANALYSIS GRAPH</span><span>MATCH ZIMMERMAN CREATIVE MEDIA GROUP</span></footer>
    </main>
  );
}

const STYLES = `
:root{--visual:#b06ab3;--sl2h:58px}.sl2{min-height:100vh;background:var(--paper);color:var(--ink);font-family:Arial,Helvetica,sans-serif}.sl2 *{box-sizing:border-box}.sl2 button,.sl2 input,.sl2 select{font-family:inherit}.sl2-top{position:sticky;top:0;z-index:200;min-height:var(--sl2h);display:grid;grid-template-columns:minmax(260px,1fr) auto minmax(460px,1.4fr) auto;align-items:stretch;border-bottom:2px solid var(--ink);background:var(--paper)}.sl2-brand{display:flex;flex-direction:column;justify-content:center;padding:9px 16px;background:var(--ink);color:var(--acid)}.sl2-brand strong{font:950 13px/1 var(--mono);letter-spacing:.06em}.sl2-brand span{margin-top:5px;font:700 7px/1 var(--mono);letter-spacing:.08em;color:var(--paper)}.transport,.perform-btn{border:0;border-right:1px solid var(--ink);background:var(--acid);padding:0 18px;font:950 10px/1 var(--mono);letter-spacing:.08em}.transport.on{background:var(--ink);color:var(--acid)}.perform-btn{border-left:1px solid var(--ink);border-right:0;background:var(--paper-light)}.perform-btn.on{background:var(--visual);color:white}.global-controls{display:flex;align-items:stretch;min-width:0}.global-controls label{display:flex;align-items:center;gap:6px;padding:7px 10px;border-right:1px solid var(--line);font:800 8px/1 var(--mono);letter-spacing:.06em}.global-controls label span{color:var(--muted)}.global-controls input[type=number],.global-controls select{width:60px;border:1px solid var(--ink);background:var(--paper-light);padding:6px;font:900 10px/1 var(--mono)}.global-controls select{width:82px}.global-controls .main-level{flex:1;min-width:140px}.global-controls .main-level input{width:100%;accent-color:var(--ink)}.global-controls b{font:900 9px/1 var(--mono)}.sl2-subbar{display:grid;grid-template-columns:auto 1fr auto;align-items:center;min-height:36px;border-bottom:1px solid var(--ink);background:var(--paper-light);font:800 7px/1 var(--mono);letter-spacing:.07em}.snapshots{display:flex;align-items:center;gap:4px;padding:5px 8px;border-right:1px solid var(--ink)}.snapshots>b{margin-right:4px}.snapshots button{width:28px;height:24px;border:1px solid var(--ink);background:var(--paper);font:950 8px/1 var(--mono)}.snapshots button.saved{background:var(--ink);color:var(--acid)}.snapshots .capture{width:auto;padding:0 8px}.snapshots .capture.on{background:var(--acid);color:var(--ink)}.context{padding:0 12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.context i{display:inline-block;width:7px;height:7px;border:1px solid var(--ink);border-radius:50%;margin-right:5px}.context i.live{background:var(--acid);box-shadow:0 0 0 2px rgba(223,255,0,.22)}.taxonomy{display:flex;gap:12px;padding:0 10px;color:var(--muted)}.taxonomy .visual{color:var(--visual)}.sl2-body{display:grid;grid-template-columns:218px minmax(0,1fr);min-height:calc(100vh - 126px)}.device-rail{border-right:1px solid var(--ink);background:var(--paper-light)}.rail-title{display:flex;justify-content:space-between;align-items:end;padding:13px 11px;border-bottom:1px solid var(--ink);font:900 7px/1 var(--mono);letter-spacing:.08em}.rail-title span{color:var(--muted)}.device-rail>button{width:100%;display:grid;grid-template-columns:30px minmax(0,1fr) auto;align-items:center;gap:8px;text-align:left;border:0;border-bottom:1px solid var(--line);background:transparent;padding:11px 9px;color:var(--ink)}.device-rail>button i{width:27px;height:27px;display:grid;place-items:center;border:1px solid var(--ink);background:var(--acid);font:900 8px/1 var(--mono);font-style:normal}.device-rail>button.visual i{background:var(--visual);color:white}.device-rail>button.system i{background:var(--paper-deep)}.device-rail>button span{display:flex;min-width:0;flex-direction:column;gap:3px}.device-rail>button b{font:950 11px/1 Arial;letter-spacing:-.02em}.device-rail>button small{font:700 6px/1.2 var(--mono);letter-spacing:.05em;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.device-rail>button em{font:800 6px/1 var(--mono);font-style:normal;color:var(--muted);transform:rotate(-90deg)}.device-rail>button.active{background:var(--ink);color:var(--paper)}.device-rail>button.active i{color:var(--ink)}.device-rail>button.visual.active{background:var(--visual)}.device-rail>button.system.active{background:var(--paper-deep);color:var(--ink)}.workbench{min-width:0;overflow:hidden}.device-header{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;padding:17px 22px 16px;border-bottom:2px solid var(--ink)}.device-header small,.device-header p{font:800 7px/1 var(--mono);letter-spacing:.09em;color:var(--muted)}.device-header h1{margin:4px 0 5px;font-size:clamp(38px,5vw,72px);font-weight:950;letter-spacing:-.065em;line-height:.78}.device-header p{margin:0}.device-id{display:flex;flex-direction:column;align-items:flex-end;gap:6px}.device-id span{border:1px solid var(--ink);background:var(--acid);padding:6px 8px;font:950 8px/1 var(--mono)}.device-id b{font:800 6px/1 var(--mono);letter-spacing:.09em;color:var(--muted)}.native-device{padding:18px 22px 26px}.control-strip{display:flex;align-items:stretch;gap:8px;border:1px solid var(--ink);background:var(--paper-light);padding:8px}.control-strip>label,.mode-block{min-width:120px;display:flex;flex-direction:column;justify-content:center;gap:5px;padding:7px 10px;border-right:1px solid var(--line)}.control-strip span,.mode-block small{font:800 7px/1 var(--mono);letter-spacing:.08em;color:var(--muted)}.control-strip input,.control-strip select{border:1px solid var(--ink);background:var(--paper);padding:6px;font:900 10px/1 var(--mono)}.mode-block strong{font:950 15px/1 Arial}.follow{border:1px solid var(--ink);background:var(--paper);padding:6px;font:900 7px/1 var(--mono);letter-spacing:.06em}.follow.on{background:var(--acid)}.big-trigger{margin-left:auto;min-width:160px;border:0;background:var(--ink);color:var(--acid);font:950 10px/1 var(--mono);letter-spacing:.08em}.gull-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:10px}.gull-grid>label,.gull-grid>article{min-height:145px;border:1px solid var(--ink);background:var(--paper-light);padding:14px}.macro{display:grid;grid-template-columns:1fr auto;grid-template-rows:auto 1fr auto;gap:8px}.macro span,.gull-grid article small{font:900 8px/1 var(--mono);letter-spacing:.08em}.macro input{grid-column:1/-1;width:100%;accent-color:var(--ink)}.macro b{font:950 34px/1 Arial;letter-spacing:-.05em}.macro small,.gull-grid article p{font:700 8px/1.4 var(--mono);letter-spacing:.04em;color:var(--muted)}.gull-grid article strong{display:block;margin:15px 0 5px;font-size:24px;letter-spacing:-.04em}.gull-grid article button{margin-top:8px;border:1px solid var(--ink);background:var(--acid);padding:7px;font:900 7px/1 var(--mono)}.erd-context{display:grid;grid-template-columns:1.1fr 1.2fr 1fr auto;border:1px solid var(--ink);background:var(--paper-light)}.erd-context>div,.erd-context>label{display:flex;align-items:center;gap:8px;padding:10px;border-right:1px solid var(--line)}.erd-context small{font:900 7px/1 var(--mono);color:var(--muted)}.erd-context strong{font:950 12px/1 Arial}.erd-context input[type=number]{width:64px;border:1px solid var(--ink);background:var(--paper);padding:5px;font:900 9px/1 var(--mono)}.erd-context input[type=range]{width:90px;accent-color:var(--ink)}.erd-context>button{border:0;background:var(--ink);color:var(--acid);padding:0 14px;font:950 8px/1 var(--mono);letter-spacing:.06em}.erd-seq{margin-top:10px;border:1px solid var(--ink);background:var(--paper-light)}.erd-row{display:grid;grid-template-columns:105px 32px minmax(0,1fr);min-height:48px;border-bottom:1px solid var(--line)}.erd-row:last-child{border-bottom:0}.erd-row.selected{box-shadow:inset 4px 0 0 var(--acid)}.voice-name{display:flex;flex-direction:column;justify-content:center;gap:4px;text-align:left;border:0;border-right:1px solid var(--line);background:transparent;padding:7px 10px}.voice-name b{font:950 12px/1 Arial}.voice-name small{font:800 6px/1 var(--mono);color:var(--muted)}.mute{border:0;border-right:1px solid var(--line);background:transparent;font:950 8px/1 var(--mono)}.mute.on{background:var(--ink);color:var(--paper)}.steps{display:grid;grid-template-columns:repeat(16,1fr);gap:2px;padding:6px}.steps button{position:relative;min-width:0;border:1px solid var(--line);background:var(--paper);aspect-ratio:1/1}.steps button:nth-child(4n+1){border-left:2px solid var(--ink)}.steps button.hit{background:var(--acid)}.steps button.accent{background:var(--ink);box-shadow:inset 0 0 0 3px var(--acid)}.steps button.play{outline:2px solid var(--visual);outline-offset:-2px}.steps span{position:absolute;right:2px;bottom:2px;font:700 5px/1 var(--mono);color:var(--muted)}.steps button.accent span{color:var(--paper)}.erd-editor{display:grid;grid-template-columns:1.1fr repeat(4,1fr);margin-top:10px;border:1px solid var(--ink);background:var(--paper-light)}.erd-editor>div,.erd-editor>label{display:flex;min-width:0;flex-direction:column;justify-content:center;gap:7px;padding:12px;border-right:1px solid var(--line)}.erd-editor>label:last-child{border-right:0}.erd-editor small,.erd-editor label span{font:900 7px/1 var(--mono);letter-spacing:.07em;color:var(--muted)}.erd-editor h2{margin:0;font-size:28px;line-height:.8;letter-spacing:-.05em}.erd-editor p{margin:0;font:800 7px/1 var(--mono);color:var(--muted)}.erd-editor button{align-self:flex-start;border:1px solid var(--ink);background:var(--acid);padding:6px 8px;font:900 7px/1 var(--mono)}.erd-editor input{width:100%;accent-color:var(--ink)}.erd-editor label b{font:950 11px/1 var(--mono)}.routing-device{padding-top:14px}.route-board{display:flex;flex-direction:column;gap:8px}.route-row{display:grid;grid-template-columns:minmax(145px,1fr) 32px minmax(160px,1fr) 32px minmax(145px,1fr);align-items:center}.arrow{text-align:center;font:950 20px/1 var(--mono)}.node{min-height:94px;display:flex;flex-direction:column;justify-content:center;gap:7px;border:1px solid var(--ink);background:var(--paper-light);padding:12px;text-align:left}.node small{font:900 7px/1 var(--mono);letter-spacing:.07em;color:var(--muted)}.node b{font-size:18px;letter-spacing:-.03em}.node span{font:800 7px/1 var(--mono);color:var(--muted)}button.node{cursor:pointer}.source{border-left:8px solid var(--acid)}.main-node{background:var(--ink);color:var(--paper)}.main-node small,.main-node span{color:var(--paper-deep)}.switch.enabled{background:var(--acid)}.visual-route.enabled{background:rgba(176,106,179,.16);border-color:var(--visual);box-shadow:inset 7px 0 0 var(--visual)}.visual-node{border-left:8px solid var(--visual)}.analysis-panel{display:grid;grid-template-columns:1fr 1.4fr;gap:12px;margin-top:12px;border:1px solid var(--ink);background:var(--paper-light);padding:14px}.analysis-panel div{padding:4px}.analysis-panel small{font:900 7px/1 var(--mono);color:var(--muted)}.analysis-panel strong{display:block;margin:12px 0 7px;font-size:18px}.analysis-panel p{max-width:520px;margin:0;font:700 8px/1.5 var(--mono);color:var(--muted)}.analysis-panel canvas{width:100%;height:140px;border:1px solid var(--ink);background:var(--paper)}.route-legend{display:flex;gap:16px;margin-top:9px;font:800 7px/1 var(--mono);color:var(--muted)}.route-legend b{color:var(--ink)}.adapter-device{padding:0 0 20px}.adapter-note{display:flex;justify-content:space-between;gap:15px;padding:9px 14px;border-bottom:1px solid var(--ink);background:var(--paper-light)}.adapter-note>div{display:flex;align-items:center;gap:9px}.adapter-note b,.adapter-note strong{font:950 7px/1 var(--mono);letter-spacing:.08em}.adapter-note span{font:700 7px/1.3 var(--mono);color:var(--muted)}.device-frame{display:block;width:100%;height:calc(100vh - 215px);min-height:620px;border:0;background:var(--paper)}.sl2-foot{display:flex;justify-content:space-between;gap:10px;border-top:1px solid var(--ink);padding:9px 12px;font:800 6px/1 var(--mono);letter-spacing:.07em;color:var(--muted)}.perform .sl2-subbar,.perform .device-rail,.perform .device-header,.perform .sl2-foot{display:none}.perform .sl2-body{display:block;min-height:calc(100vh - var(--sl2h))}.perform .native-device{padding:18px;min-height:calc(100vh - var(--sl2h))}.perform .device-frame{height:calc(100vh - var(--sl2h));min-height:0}.perform .sl2-top{grid-template-columns:minmax(220px,1fr) auto minmax(430px,1.5fr) auto}.perform .gull-grid{grid-template-columns:repeat(2,1fr)}.perform .gull-grid>label,.perform .gull-grid>article{min-height:230px}.perform .steps button{min-height:42px;aspect-ratio:auto}
@media(max-width:1100px){.sl2-top{grid-template-columns:1fr auto}.sl2-brand{grid-column:1}.transport{grid-column:2;grid-row:1}.global-controls{grid-column:1/-1;border-top:1px solid var(--ink)}.perform-btn{position:absolute;right:0;bottom:-37px;height:36px;z-index:4}.sl2-subbar{grid-template-columns:auto 1fr}.taxonomy{display:none}.sl2-body{grid-template-columns:176px minmax(0,1fr)}.device-rail>button{grid-template-columns:28px 1fr}.device-rail>button em{display:none}.erd-context{grid-template-columns:1fr 1fr}.erd-context>button{min-height:42px}.erd-editor{grid-template-columns:1fr 1fr 1fr}.erd-editor>div{grid-row:span 2}.steps{overflow-x:auto;grid-template-columns:repeat(16,30px)}}
@media(max-width:720px){.sl2-subbar{display:none}.sl2-body{display:block}.device-rail{display:flex;overflow-x:auto;border-right:0;border-bottom:1px solid var(--ink)}.rail-title{display:none}.device-rail>button{flex:0 0 126px;grid-template-columns:25px 1fr;padding:8px}.device-rail>button small{display:none}.device-header{padding:14px}.device-id{display:none}.native-device{padding:10px}.control-strip{flex-wrap:wrap}.big-trigger{min-height:48px;width:100%}.gull-grid{grid-template-columns:1fr}.erd-context{grid-template-columns:1fr}.erd-context>div,.erd-context>label{border-right:0;border-bottom:1px solid var(--line)}.erd-row{grid-template-columns:76px 28px minmax(400px,1fr);overflow-x:auto}.erd-seq{overflow-x:auto}.steps{grid-template-columns:repeat(16,28px);overflow:visible}.erd-editor{grid-template-columns:1fr 1fr}.route-row{grid-template-columns:1fr}.arrow{transform:rotate(90deg);padding:5px}.analysis-panel{grid-template-columns:1fr}.sl2-foot{flex-direction:column}.adapter-note{display:none}.device-frame{height:calc(100vh - 150px);min-height:560px}.perform .sl2-top{grid-template-columns:1fr auto}.perform .global-controls{display:none}}
@media(prefers-reduced-motion:reduce){.sl2 *{transition:none!important}}
`;
