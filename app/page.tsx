"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import {
  EFFECTS,
  SignalChainEngine,
  makeEffect,
  type EffectModule,
  type EffectType,
  type Waveform,
} from "./signal-chain-engine";

type SourceState = { waveform: Waveform; frequency: number; level: number };
type DragState = {
  origin: "library" | "chain";
  type?: EffectType;
  moduleId?: string;
  label: string;
  x: number;
  y: number;
  startX: number;
  startY: number;
  snapIndex: number | null;
};
type Preset = { name: string; source: SourceState; modules: EffectModule[] };

const effectTypes: EffectType[] = ["filter", "drive", "tremolo", "delay", "reverb"];
const waveforms: Waveform[] = ["sine", "triangle", "sawtooth", "square"];
const noteNames = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];

const presets: Preset[] = [
  { name: "DIRECT", source: { waveform: "triangle", frequency: 110, level: 58 }, modules: [] },
  {
    name: "WARM ECHO",
    source: { waveform: "sawtooth", frequency: 110, level: 50 },
    modules: [
      { ...makeEffect("filter", "warm-filter"), params: { cutoff: 54, resonance: 20 } },
      { ...makeEffect("delay", "warm-delay"), params: { time: 37, feedback: 42, mix: 34 } },
    ],
  },
  {
    name: "MOVING ROOM",
    source: { waveform: "triangle", frequency: 146.8, level: 62 },
    modules: [
      { ...makeEffect("tremolo", "room-tremolo"), params: { rate: 31, depth: 68 } },
      { ...makeEffect("reverb", "room-reverb"), params: { space: 68, mix: 42 } },
    ],
  },
  {
    name: "BENT REPEATS",
    source: { waveform: "square", frequency: 82.4, level: 43 },
    modules: [
      { ...makeEffect("delay", "bent-delay"), params: { time: 29, feedback: 55, mix: 38 } },
      { ...makeEffect("drive", "bent-drive"), params: { gain: 46, tone: 48 } },
      { ...makeEffect("filter", "bent-filter"), params: { cutoff: 67, resonance: 34 } },
    ],
  },
];

const cloneModules = (modules: EffectModule[]) => modules.map((module) => ({ ...module, params: { ...module.params } }));
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function noteFromFrequency(frequency: number) {
  const midi = Math.round(69 + 12 * Math.log2(frequency / 440));
  return `${noteNames[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}

function Knob({ label, value, min = 0, max = 100, step = 1, readout, onChange }: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  readout: string;
  onChange: (value: number) => void;
}) {
  const normalized = (value - min) / (max - min);
  return (
    <label className="knob-control">
      <span className="knob" style={{ "--turn": `${-132 + normalized * 264}deg` } as CSSProperties}>
        <input
          type="range"
          aria-label={label}
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <i />
      </span>
      <b>{label}</b>
      <output>{readout}</output>
    </label>
  );
}

function SectionTitle({ index, title, subtitle, code }: { index: string; title: string; subtitle: string; code: string }) {
  return (
    <div className="section-title">
      <span>{index}</span>
      <div><h2>{title}</h2><p>{subtitle}</p></div>
      <i>{code}</i>
    </div>
  );
}

export default function Home() {
  const [source, setSource] = useState<SourceState>({ ...presets[1].source });
  const [modules, setModules] = useState<EffectModule[]>(() => cloneModules(presets[1].modules));
  const [signalOn, setSignalOn] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  const [activePreset, setActivePreset] = useState<number | null>(1);
  const [selectedId, setSelectedId] = useState<string | null>(presets[1].modules[0].id);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [meter, setMeter] = useState(0);
  const [announcement, setAnnouncement] = useState("Warm Echo chain loaded. Start the signal when ready.");
  const engineRef = useRef<SignalChainEngine | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chainRef = useRef<HTMLDivElement>(null);
  const sourceRef = useRef(source);
  const modulesRef = useRef(modules);
  const dragRef = useRef<DragState | null>(null);
  const meterLastUpdate = useRef(0);

  useEffect(() => { sourceRef.current = source; }, [source]);
  useEffect(() => { modulesRef.current = modules; }, [modules]);

  const ensureAudio = useCallback(async () => {
    if (!engineRef.current) {
      const AudioCtor = window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const engine = new SignalChainEngine(new AudioCtor());
      engine.setSource(sourceRef.current.waveform, sourceRef.current.frequency, sourceRef.current.level);
      engine.setChain(modulesRef.current);
      engineRef.current = engine;
    }
    if (engineRef.current.context.state === "suspended") await engineRef.current.context.resume();
    setAudioReady(true);
    return engineRef.current;
  }, []);

  useEffect(() => {
    engineRef.current?.setSource(source.waveform, source.frequency, source.level);
  }, [source]);

  useEffect(() => {
    engineRef.current?.setChain(modules);
  }, [modules]);

  useEffect(() => () => engineRef.current?.dispose(), []);

  useEffect(() => {
    let frame = 0;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const draw = (time: number) => {
      const ratio = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(1, rect.width);
      const height = Math.max(1, rect.height);
      if (canvas.width !== Math.floor(width * ratio) || canvas.height !== Math.floor(height * ratio)) {
        canvas.width = Math.floor(width * ratio);
        canvas.height = Math.floor(height * ratio);
      }
      const context = canvas.getContext("2d");
      if (!context) return;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);
      context.strokeStyle = "rgba(29,29,27,.14)";
      context.lineWidth = 1;
      for (let x = 0; x <= width; x += 40) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, height); context.stroke(); }
      for (let y = 0; y <= height; y += 28) { context.beginPath(); context.moveTo(0, y); context.lineTo(width, y); context.stroke(); }

      const analyser = engineRef.current?.analyser;
      let rms = 0;
      context.beginPath();
      context.strokeStyle = "#1d1d1b";
      context.lineWidth = 2;
      if (analyser && signalOn) {
        const wave = new Uint8Array(analyser.fftSize);
        analyser.getByteTimeDomainData(wave);
        for (let x = 0; x < width; x++) {
          const sample = (wave[Math.floor((x / width) * wave.length)] - 128) / 128;
          rms += sample * sample;
          const y = height / 2 + sample * height * 0.42;
          if (x === 0) context.moveTo(x, y); else context.lineTo(x, y);
        }
        rms = Math.sqrt(rms / width);
      } else {
        context.moveTo(0, height / 2);
        context.lineTo(width, height / 2);
      }
      context.stroke();

      if (time - meterLastUpdate.current > 110) {
        setMeter(clamp(rms * 4.2, 0, 1));
        meterLastUpdate.current = time;
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [signalOn]);

  const markChanged = () => setActivePreset(null);

  const updateSource = (patch: Partial<SourceState>) => {
    setSource((current) => ({ ...current, ...patch }));
    markChanged();
  };

  const updateModule = (id: string, patch: Partial<EffectModule>) => {
    setModules((current) => current.map((module) => module.id === id ? { ...module, ...patch } : module));
    markChanged();
  };

  const updateParam = (id: string, key: string, value: number) => {
    setModules((current) => current.map((module) => module.id === id ? { ...module, params: { ...module.params, [key]: value } } : module));
    markChanged();
  };

  const addEffect = useCallback((type: EffectType, index = modulesRef.current.length) => {
    const created = makeEffect(type);
    setModules((current) => {
      const next = [...current];
      next.splice(clamp(index, 0, next.length), 0, created);
      return next;
    });
    setSelectedId(created.id);
    setActivePreset(null);
    setAnnouncement(`${EFFECTS[type].name} snapped into position ${index + 1}.`);
  }, []);

  const moveModule = useCallback((id: string, snapIndex: number) => {
    setModules((current) => {
      const from = current.findIndex((module) => module.id === id);
      if (from < 0) return current;
      const next = [...current];
      const [moved] = next.splice(from, 1);
      const target = clamp(snapIndex > from ? snapIndex - 1 : snapIndex, 0, next.length);
      next.splice(target, 0, moved);
      setAnnouncement(`${EFFECTS[moved.type].name} moved to position ${target + 1}.`);
      return next;
    });
    setActivePreset(null);
  }, []);

  const moveBy = (id: string, delta: number) => {
    const current = modulesRef.current;
    const from = current.findIndex((module) => module.id === id);
    if (from < 0) return;
    const to = clamp(from + delta, 0, current.length - 1);
    if (from === to) return;
    const next = [...current];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setModules(next);
    setActivePreset(null);
    setAnnouncement(`${EFFECTS[moved.type].name} moved to position ${to + 1}.`);
  };

  const removeModule = (id: string) => {
    const removed = modulesRef.current.find((module) => module.id === id);
    if (!removed) return;
    setModules((current) => current.filter((module) => module.id !== id));
    if (selectedId === id) setSelectedId(null);
    setActivePreset(null);
    setAnnouncement(`${EFFECTS[removed.type].name} removed from the chain.`);
  };

  const beginDrag = (event: ReactPointerEvent<HTMLButtonElement>, initial: Omit<DragState, "x" | "y" | "startX" | "startY" | "snapIndex">) => {
    event.preventDefault();
    const next: DragState = { ...initial, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, snapIndex: initial.origin === "chain" ? modulesRef.current.findIndex((module) => module.id === initial.moduleId) : null };
    dragRef.current = next;
    setDrag(next);
  };

  const dragging = drag !== null;
  useEffect(() => {
    if (!dragging) return;
    const pointerMove = (event: PointerEvent) => {
      const rack = chainRef.current;
      const current = dragRef.current;
      if (!rack || !current) return;
      const rackRect = rack.getBoundingClientRect();
      const inside = event.clientX >= rackRect.left - 64 && event.clientX <= rackRect.right + 64 && event.clientY >= rackRect.top - 64 && event.clientY <= rackRect.bottom + 64;
      let snapIndex: number | null = null;
      if (inside) {
        let distance = Number.POSITIVE_INFINITY;
        rack.querySelectorAll<HTMLElement>("[data-snap-index]").forEach((slot) => {
          const rect = slot.getBoundingClientRect();
          const candidate = Math.hypot(event.clientX - (rect.left + rect.width / 2), event.clientY - (rect.top + rect.height / 2));
          if (candidate < distance) { distance = candidate; snapIndex = Number(slot.dataset.snapIndex); }
        });
      }
      const next = { ...current, x: event.clientX, y: event.clientY, snapIndex };
      dragRef.current = next;
      setDrag(next);
    };
    const pointerUp = () => {
      const current = dragRef.current;
      if (current?.snapIndex !== null && current?.snapIndex !== undefined) {
        if (current.origin === "library" && current.type) addEffect(current.type, current.snapIndex);
        if (current.origin === "chain" && current.moduleId) moveModule(current.moduleId, current.snapIndex);
      } else if (current) {
        setAnnouncement(`${current.label} returned to its previous position.`);
      }
      dragRef.current = null;
      setDrag(null);
    };
    window.addEventListener("pointermove", pointerMove, { passive: true });
    window.addEventListener("pointerup", pointerUp, { once: true });
    window.addEventListener("pointercancel", pointerUp, { once: true });
    return () => {
      window.removeEventListener("pointermove", pointerMove);
      window.removeEventListener("pointerup", pointerUp);
      window.removeEventListener("pointercancel", pointerUp);
    };
  }, [dragging, addEffect, moveModule]);

  const loadPreset = (index: number) => {
    const preset = presets[index];
    const next = cloneModules(preset.modules);
    setSource({ ...preset.source });
    setModules(next);
    setSelectedId(next[0]?.id ?? null);
    setActivePreset(index);
    setAnnouncement(`${preset.name} chain loaded with ${next.length} effect${next.length === 1 ? "" : "s"}.`);
  };

  const toggleSignal = async () => {
    const next = !signalOn;
    const engine = await ensureAudio();
    engine.setSounding(next, sourceRef.current.level);
    setSignalOn(next);
    setAnnouncement(next ? "Signal running. Adjust or reorder any effect." : "Signal stopped.");
  };

  const reverseChain = () => {
    if (modules.length < 2) return;
    setModules((current) => [...current].reverse());
    setActivePreset(null);
    setAnnouncement("Effect order reversed. Listen for what changed.");
  };

  const clearChain = () => {
    setModules([]);
    setSelectedId(null);
    setActivePreset(0);
    setAnnouncement("Effects cleared. The generator now runs directly to output.");
  };

  const moduleKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, id: string) => {
    if (["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown", "Delete", "Backspace"].includes(event.key)) event.preventDefault();
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") moveBy(id, -1);
    if (event.key === "ArrowRight" || event.key === "ArrowDown") moveBy(id, 1);
    if (event.key === "Delete" || event.key === "Backspace") removeModule(id);
  };

  const selectedModule = modules.find((module) => module.id === selectedId) ?? null;
  const chainNames = modules.map((module) => EFFECTS[module.type].name);
  const activeCount = modules.filter((module) => module.enabled).length;
  const orderText = modules.length === 0
    ? "With no effects, the source reaches the output unchanged. Add one module to begin the experiment."
    : modules.length === 1
      ? `${chainNames[0]} receives the raw source. Add a second effect, then reverse the pair to hear why sequence matters.`
      : `${chainNames[0]} changes the source first; ${chainNames[1]} processes that changed signal next. Use REVERSE ORDER for an immediate comparison.`;

  return (
    <main className="serial-app">
      <header className="masthead">
        <div className="identity"><span className="plate">MZ–03</span><h1>SERIAL</h1><p>SEQUENTIAL EFFECTS LAB</p></div>
        <div className="transport" aria-label="Global signal controls">
          <button className={signalOn ? "active" : ""} onClick={() => { void toggleSignal(); }}><span className="power-dot" />{signalOn ? "STOP SIGNAL" : "START SIGNAL"}</button>
          <button onClick={reverseChain} disabled={modules.length < 2}>⇄ REVERSE ORDER</button>
          <button onClick={clearChain} disabled={modules.length === 0}>CLEAR FX</button>
        </div>
      </header>

      <div className="intro-line">
        <p>Build a sound one stage at a time. Drag an effect onto the rail, then move it to hear how <strong>order changes the result.</strong></p>
        <span>DRAG · SNAP · LISTEN · REORDER</span>
      </div>

      <section className="route-section" aria-labelledby="route-title">
        <div className="section-title route-title">
          <span>01</span><div><h2 id="route-title">SIGNAL ROUTE</h2><p>LEFT-TO-RIGHT AUDIO PATH</p></div><i>RTE</i>
        </div>
        <div className="preset-strip" aria-label="Example chains">
          <b>EXAMPLE CHAINS</b>
          {presets.map((preset, index) => <button key={preset.name} className={activePreset === index ? "selected" : ""} onClick={() => loadPreset(index)}>{String(index + 1).padStart(2, "0")} / {preset.name}</button>)}
        </div>

        <div className="rack-scroll">
          <div className="signal-rail">
            <article className="source-module instrument-module">
              <header><span>GEN</span><div><b>SIGNAL GENERATOR</b><small>CONTINUOUS SOURCE</small></div><i className={signalOn ? "live" : ""}>{signalOn ? "LIVE" : "IDLE"}</i></header>
              <div className="wave-strip" aria-label="Waveform">
                {waveforms.map((waveform) => <button key={waveform} aria-pressed={source.waveform === waveform} onClick={() => updateSource({ waveform })}>{waveform.slice(0, 3).toUpperCase()}</button>)}
              </div>
              <div className="module-knobs source-knobs">
                <Knob label="PITCH" min={55} max={440} step={0.1} value={source.frequency} readout={`${noteFromFrequency(source.frequency)} / ${Math.round(source.frequency)} Hz`} onChange={(frequency) => updateSource({ frequency })} />
                <Knob label="LEVEL" value={source.level} readout={`${Math.round(source.level)}%`} onChange={(level) => updateSource({ level })} />
              </div>
            </article>

            <div className="cable" aria-hidden="true"><span>OUT</span><i>→</i></div>

            <div className={`effect-chain ${modules.length === 0 ? "empty" : ""}`} ref={chainRef} aria-label="Effect chain">
              {modules.length === 0 && !drag && <p className="empty-message"><b>EMPTY RAIL</b><span>Drag an effect here or use its ADD button.</span></p>}
              <div className={`snap-slot ${drag?.snapIndex === 0 ? "target" : ""}`} data-snap-index="0" aria-hidden="true"><span>+</span></div>
              {modules.map((module, index) => {
                const definition = EFFECTS[module.type];
                return (
                  <div className="chain-pair" key={module.id}>
                    <article className={`effect-module instrument-module ${module.enabled ? "enabled" : "bypassed"} ${selectedId === module.id ? "selected" : ""}`} onPointerDown={() => setSelectedId(module.id)}>
                      <header>
                        <span>{String(index + 1).padStart(2, "0")}</span>
                        <div><b>{definition.name}</b><small>{definition.verb}</small></div>
                        <button
                          className="drag-handle"
                          aria-label={`Move ${definition.name}, position ${index + 1}. Drag or use arrow keys; delete key removes.`}
                          onPointerDown={(event) => beginDrag(event, { origin: "chain", moduleId: module.id, label: definition.name })}
                          onKeyDown={(event) => moduleKeyDown(event, module.id)}
                        >↕</button>
                      </header>
                      <div className="module-knobs">
                        {definition.controls.map((control) => <Knob key={control.key} label={control.label} value={module.params[control.key]} readout={control.format(module.params[control.key])} onChange={(value) => updateParam(module.id, control.key, value)} />)}
                      </div>
                      <footer>
                        <button aria-pressed={module.enabled} className="footswitch" onClick={() => { updateModule(module.id, { enabled: !module.enabled }); setAnnouncement(`${definition.name} ${module.enabled ? "bypassed" : "activated"}.`); }}>{module.enabled ? "ON" : "BYPASS"}</button>
                        <button className="remove" onClick={() => removeModule(module.id)} aria-label={`Remove ${definition.name}`}>REMOVE</button>
                      </footer>
                    </article>
                    <div className={`snap-slot ${drag?.snapIndex === index + 1 ? "target" : ""}`} data-snap-index={index + 1} aria-hidden="true"><span>+</span></div>
                  </div>
                );
              })}
            </div>

            <div className="cable" aria-hidden="true"><span>FINAL</span><i>→</i></div>
            <article className="output-module instrument-module">
              <header><span>OUT</span><div><b>MONITOR</b><small>PROTECTED OUTPUT</small></div></header>
              <div className="meter" aria-label={`Output level ${Math.round(meter * 100)} percent`}><i style={{ height: `${Math.max(2, meter * 100)}%` }} /></div>
              <b className="meter-value">{signalOn ? `${Math.round(meter * 100)}%` : "—"}</b>
              <small>{audioReady ? "ENGINE ONLINE" : "AWAITING START"}</small>
            </article>
          </div>
        </div>

        <div className="scope-panel">
          <div><b>OUTPUT TRACE</b><span>ACTUAL POST-CHAIN WAVEFORM</span></div>
          <canvas ref={canvasRef} aria-label="Live output waveform" />
          <span className="scope-axis">−1&nbsp;&nbsp; 0&nbsp;&nbsp; +1</span>
        </div>

        <div className="observations" aria-label="Signal observations">
          <span><b>SOURCE</b>{source.waveform.toUpperCase()} / {noteFromFrequency(source.frequency)}</span>
          <span><b>CHAIN LENGTH</b>{modules.length} MODULE{modules.length === 1 ? "" : "S"}</span>
          <span><b>ACTIVE PATH</b>{activeCount} PROCESSING</span>
          <span><b>ORDER</b>{chainNames.length ? chainNames.join(" → ") : "GEN → OUT"}</span>
          <span><b>SIGNAL</b>{signalOn ? "RUNNING" : "STOPPED"}</span>
        </div>
      </section>

      <section className="fx-section" aria-labelledby="fx-title">
        <SectionTitle index="02" title="EFFECT BAY" subtitle="DRAG A MODULE FROM STORAGE" code="FXB" />
        <div className="fx-library">
          {effectTypes.map((type, index) => {
            const definition = EFFECTS[type];
            return (
              <article className="library-module" key={type}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div><b>{definition.name}</b><small>{definition.description}</small></div>
                <button className="library-grab" onPointerDown={(event) => beginDrag(event, { origin: "library", type, label: definition.name })} aria-label={`Drag ${definition.name} into the signal chain`}>DRAG ↕</button>
                <button className="library-add" onClick={() => addEffect(type)} aria-label={`Add ${definition.name} to end of chain`}>+ ADD</button>
              </article>
            );
          })}
        </div>
      </section>

      <section className="listen-section" aria-labelledby="listen-title">
        <SectionTitle index="03" title="LISTENING NOTES" subtitle="WHAT TO NOTICE" code="EDU" />
        <div className="lesson-grid">
          <div><span>SELECTED MODULE</span><h3>{selectedModule ? EFFECTS[selectedModule.type].name : "SIGNAL SOURCE"}</h3><p>{selectedModule ? EFFECTS[selectedModule.type].listenFor : "Choose a waveform, then adjust PITCH and LEVEL. Rich waveforms such as square and sawtooth make filtering and distortion easier to hear."}</p></div>
          <div><span>WHY ORDER MATTERS</span><h3>{modules.length > 1 ? `${chainNames[0]} BEFORE ${chainNames[1]}` : "BUILD A PAIR"}</h3><p>{orderText}</p></div>
          <div><span>QUICK EXPERIMENT</span><h3>BYPASS / MOVE / RESTORE</h3><p>Turn one module off without removing it. Move it earlier or later, then turn it back on. Change one thing at a time so your ears can follow the cause.</p></div>
        </div>
      </section>

      {drag && <div className={`drag-ghost ${drag.snapIndex !== null ? "magnetized" : ""}`} style={{ left: drag.x, top: drag.y }} aria-hidden="true"><b>{drag.label}</b><span>{drag.snapIndex !== null ? `SNAP ${drag.snapIndex + 1}` : "MOVE TO RAIL"}</span></div>}
      <p className="sr-only" aria-live="polite">{announcement}</p>

      <footer className="site-footer"><span>SERIAL SIGNAL LABORATORY</span><span>5 EFFECT TYPES / LIVE WEB AUDIO / SAFE OUTPUT</span><span>FIELD UNIT № 03</span></footer>
    </main>
  );
}
