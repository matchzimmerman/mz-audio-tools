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
} from "../serial-engine";

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
      <style>{STYLES}</style>
      <header className="masthead">
        <div className="identity"><span className="plate">MZ–02</span><h1>SERIAL</h1><p>SEQUENTIAL EFFECTS LAB</p></div>
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

      <footer className="site-footer"><span>SERIAL SIGNAL LABORATORY</span><span>5 EFFECT TYPES / LIVE WEB AUDIO / SAFE OUTPUT</span><span>FIELD UNIT № 02</span></footer>
    </main>
  );
}

/* ============================================================
   STYLES — scoped under .serial-app so this instrument never
   leaks into or depends on another tool's global classes.
   ============================================================ */
const STYLES = `
.serial-app { width: min(100%, 1720px); min-height: 100vh; margin: 0 auto; padding: 24px 30px 14px; overflow: hidden; }
.serial-app .masthead { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; border-top: 2px solid var(--ink); border-bottom: 2px solid var(--ink); padding: 12px 0 14px; }
.serial-app .identity { display: grid; grid-template-columns: auto auto; align-items: end; column-gap: 14px; }
.serial-app .plate { grid-row: 1 / 3; align-self: stretch; padding: 7px 6px; background: var(--ink); color: var(--paper); font: 800 10px/1 var(--mono); letter-spacing: 0.08em; writing-mode: vertical-rl; transform: rotate(180deg); }
.serial-app h1 { margin: 0; font-size: clamp(52px, 7vw, 104px); font-weight: 900; line-height: 0.7; letter-spacing: -0.08em; }
.serial-app .identity p { margin: 10px 0 0 4px; font: 800 10px/1 var(--mono); letter-spacing: 0.16em; }
.serial-app .transport { display: flex; gap: 7px; }
.serial-app .transport button { min-width: 126px; min-height: 52px; border: 1.5px solid var(--ink); background: transparent; padding: 8px 12px; font: 800 9px/1 var(--mono); letter-spacing: 0.07em; transition: background 140ms ease; }
.serial-app .transport button:hover:not(:disabled), .serial-app .transport button.active { background: var(--acid); }
.serial-app .power-dot { display: inline-block; width: 8px; height: 8px; margin-right: 8px; border: 1px solid var(--ink); border-radius: 50%; background: var(--muted); }
.serial-app .transport .active .power-dot { background: var(--acid); box-shadow: 0 0 0 2px var(--ink); }
.serial-app .intro-line { display: flex; align-items: center; justify-content: space-between; gap: 24px; padding: 13px 0; border-bottom: 1px solid var(--ink); }
.serial-app .intro-line p { max-width: 760px; margin: 0; font-size: 15px; line-height: 1.35; }
.serial-app .intro-line > span { flex: none; color: var(--muted); font: 800 8px/1 var(--mono); letter-spacing: 0.12em; }
.serial-app .route-section, .serial-app .fx-section, .serial-app .listen-section { padding-top: 14px; border-bottom: 2px solid var(--ink); }
.serial-app .section-title { display: grid; grid-template-columns: 28px 1fr auto; align-items: start; gap: 0; margin-bottom: 10px; }
.serial-app .section-title > span { display: grid; width: 24px; height: 24px; place-items: center; border: 1px solid var(--ink); background: var(--acid); font: 800 8px/1 var(--mono); }
.serial-app .section-title h2 { margin: 0; font-size: 19px; font-weight: 900; line-height: 1; letter-spacing: -0.035em; }
.serial-app .section-title p { margin: 4px 0 0; color: var(--muted); font: 800 8px/1 var(--mono); letter-spacing: 0.1em; }
.serial-app .section-title > i { color: var(--muted); font: 800 8px/1 var(--mono); font-style: normal; }
.serial-app .preset-strip { display: grid; grid-template-columns: 138px repeat(4, minmax(130px, 1fr)); min-height: 42px; border: 1px solid var(--ink); border-bottom: 0; }
.serial-app .preset-strip > b { display: flex; align-items: center; padding: 8px 10px; font: 800 8px/1 var(--mono); letter-spacing: 0.08em; }
.serial-app .preset-strip button { border: 0; border-left: 1px solid var(--line); background: transparent; padding: 8px 10px; text-align: left; font: 800 9px/1 var(--mono); transition: background 140ms ease; }
.serial-app .preset-strip button:hover, .serial-app .preset-strip button.selected { background: var(--acid); }
.serial-app .rack-scroll { overflow-x: auto; border: 1.5px solid var(--ink); }
.serial-app .signal-rail { display: flex; width: max-content; min-width: 100%; min-height: 276px; align-items: center; padding: 18px 14px; background-image: linear-gradient(var(--line) 1px, transparent 1px), linear-gradient(90deg, var(--line) 1px, transparent 1px); background-size: 32px 32px; }
.serial-app .instrument-module { position: relative; flex: none; min-height: 226px; border: 1.5px solid var(--ink); background: var(--paper); }
.serial-app .instrument-module > header { display: grid; grid-template-columns: 28px 1fr auto; min-height: 47px; align-items: center; border-bottom: 1px solid var(--ink); }
.serial-app .instrument-module > header > span { display: grid; align-self: stretch; place-items: center; border-right: 1px solid var(--ink); background: var(--ink); color: var(--paper); font: 800 8px/1 var(--mono); }
.serial-app .instrument-module > header b { display: block; padding: 0 9px; font: 900 11px/1 var(--mono); letter-spacing: 0.04em; }
.serial-app .instrument-module > header small { display: block; margin-top: 4px; padding: 0 9px; color: var(--muted); font: 800 7px/1 var(--mono); letter-spacing: 0.09em; }
.serial-app .instrument-module > header > i { margin-right: 8px; color: var(--muted); font: 800 7px/1 var(--mono); font-style: normal; }
.serial-app .instrument-module > header > i.live { color: var(--ink); background: var(--acid); padding: 4px 5px; }
.serial-app .source-module { width: 268px; }
.serial-app .effect-module { width: 232px; transition: box-shadow 140ms ease, opacity 140ms ease; }
.serial-app .effect-module.selected { box-shadow: inset 0 0 0 3px var(--acid); }
.serial-app .effect-module.enabled::before { position: absolute; top: 0; right: 0; left: 0; height: 4px; background: var(--acid); content: ""; }
.serial-app .effect-module.bypassed { opacity: 0.58; }
.serial-app .drag-handle { align-self: stretch; min-width: 44px; border: 0; border-left: 1px solid var(--ink); background: transparent; font: 900 17px/1 var(--mono); touch-action: none; }
.serial-app .drag-handle:hover { background: var(--acid); }
.serial-app .wave-strip { display: grid; grid-template-columns: repeat(4, 1fr); margin: 10px; border: 1px solid var(--ink); }
.serial-app .wave-strip button { min-height: 44px; border: 0; border-left: 1px solid var(--line); background: transparent; font: 800 8px/1 var(--mono); }
.serial-app .wave-strip button:first-child { border-left: 0; }
.serial-app .wave-strip button:hover, .serial-app .wave-strip button[aria-pressed="true"] { background: var(--acid); }
.serial-app .module-knobs { display: flex; min-height: 127px; align-items: flex-start; justify-content: space-evenly; gap: 9px; padding: 18px 8px 10px; }
.serial-app .source-knobs { padding-top: 10px; }
.serial-app .knob-control { display: grid; width: 64px; justify-items: center; gap: 5px; font-family: var(--mono); }
.serial-app .knob { --turn: 0deg; position: relative; display: block; width: 54px; height: 54px; border: 1.5px solid var(--ink); border-radius: 50%; background: var(--paper-light); touch-action: none; }
.serial-app .knob::before { position: absolute; inset: -6px; border-radius: 50%; background: repeating-conic-gradient(from -135deg, var(--ink) 0 1deg, transparent 1deg 15deg); content: ""; mask: radial-gradient(transparent 0 70%, #000 71% 76%, transparent 77%); }
.serial-app .knob i { position: absolute; top: 4px; left: calc(50% - 1px); width: 2px; height: 22px; background: var(--ink); pointer-events: none; transform: rotate(var(--turn)); transform-origin: 1px 23px; }
.serial-app .knob input { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; cursor: ns-resize; opacity: 0; }
.serial-app .knob-control > b { font: 800 8px/1 var(--mono); letter-spacing: 0.08em; }
.serial-app .knob-control output { min-height: 20px; color: var(--muted); font: 800 7px/1.2 var(--mono); text-align: center; }
.serial-app .effect-module > footer { display: grid; grid-template-columns: 1fr 1fr; border-top: 1px solid var(--ink); }
.serial-app .effect-module > footer button { min-height: 44px; border: 0; background: transparent; font: 800 8px/1 var(--mono); letter-spacing: 0.06em; }
.serial-app .effect-module > footer button + button { border-left: 1px solid var(--ink); }
.serial-app .effect-module > footer .footswitch[aria-pressed="true"] { background: var(--acid); }
.serial-app .effect-module > footer .remove:hover { color: var(--danger); }
.serial-app .effect-chain { display: flex; min-width: 58px; align-items: center; align-self: stretch; }
.serial-app .effect-chain.empty { position: relative; min-width: 260px; }
.serial-app .chain-pair { display: flex; align-items: center; }
.serial-app .snap-slot { display: grid; width: 24px; height: 76px; flex: none; place-items: center; border-top: 1px solid var(--ink); border-bottom: 1px solid var(--ink); transition: width 120ms ease, background 120ms ease; }
.serial-app .snap-slot span { opacity: 0; font: 900 18px/1 var(--mono); }
.serial-app .snap-slot.target { width: 54px; border: 1.5px dashed var(--ink); background: var(--acid); box-shadow: inset 0 0 0 3px var(--paper); }
.serial-app .snap-slot.target span { opacity: 1; }
.serial-app .empty-message { position: absolute; top: 50%; left: 50%; width: 190px; margin: 0; text-align: center; transform: translate(-50%, -50%); }
.serial-app .empty-message b { display: block; font: 900 13px/1 var(--mono); }
.serial-app .empty-message span { display: block; margin-top: 7px; color: var(--muted); font: 700 9px/1.35 var(--mono); }
.serial-app .cable { display: flex; width: 58px; flex: none; align-items: center; justify-content: center; gap: 5px; border-top: 1px solid var(--ink); font: 800 7px/1 var(--mono); }
.serial-app .cable i { font-size: 15px; font-style: normal; }
.serial-app .output-module { display: grid; width: 146px; min-height: 226px; grid-template-columns: 1fr 1fr; align-items: end; padding-bottom: 12px; }
.serial-app .output-module > header { grid-column: 1 / -1; align-self: start; }
.serial-app .meter { position: relative; width: 24px; height: 115px; margin: 13px auto 0; border: 1px solid var(--ink); background-image: repeating-linear-gradient(to top, transparent 0 10px, var(--line) 10px 11px); }
.serial-app .meter i { position: absolute; right: 3px; bottom: 3px; left: 3px; min-height: 2px; background: var(--acid); border-top: 2px solid var(--ink); transition: height 90ms linear; }
.serial-app .meter-value { align-self: center; font: 900 17px/1 var(--mono); }
.serial-app .output-module > small { grid-column: 1 / -1; margin-top: 8px; color: var(--muted); font: 800 7px/1 var(--mono); text-align: center; }
.serial-app .scope-panel { position: relative; display: grid; grid-template-columns: 165px minmax(0, 1fr); grid-template-rows: minmax(0, 1fr); height: 100px; border: 1px solid var(--ink); border-top: 0; overflow: hidden; }
.serial-app .scope-panel > div { display: flex; flex-direction: column; justify-content: center; min-height: 0; padding: 12px; border-right: 1px solid var(--ink); }
.serial-app .scope-panel > div b { font: 900 10px/1 var(--mono); }
.serial-app .scope-panel > div span { margin-top: 6px; color: var(--muted); font: 800 7px/1.2 var(--mono); }
.serial-app .scope-panel canvas { display: block; width: 100%; height: 100%; min-height: 0; }
.serial-app .scope-axis { position: absolute; right: 7px; bottom: 5px; color: var(--muted); font: 700 7px/1 var(--mono); pointer-events: none; }
.serial-app .observations { display: grid; grid-template-columns: repeat(5, 1fr); border: 1px solid var(--ink); border-top: 0; }
.serial-app .observations > span { min-width: 0; padding: 8px 10px; border-right: 1px solid var(--line); overflow: hidden; font: 800 9px/1.2 var(--mono); text-overflow: ellipsis; white-space: nowrap; }
.serial-app .observations > span:last-child { border-right: 0; }
.serial-app .observations b { display: block; margin-bottom: 5px; color: var(--muted); font-size: 7px; letter-spacing: 0.08em; }
.serial-app .fx-section { padding-bottom: 14px; }
.serial-app .fx-library { display: grid; grid-template-columns: repeat(5, 1fr); border: 1px solid var(--ink); }
.serial-app .library-module { display: grid; min-height: 142px; grid-template-columns: 30px 1fr 58px; grid-template-rows: 1fr 44px; border-right: 1px solid var(--ink); background: var(--paper); }
.serial-app .library-module:last-child { border-right: 0; }
.serial-app .library-module > span { display: grid; grid-row: 1 / 3; place-items: center; border-right: 1px solid var(--ink); background: var(--acid); font: 900 8px/1 var(--mono); writing-mode: vertical-rl; }
.serial-app .library-module > div { grid-column: 2 / 4; padding: 12px; }
.serial-app .library-module > div b { display: block; font: 900 14px/1 var(--mono); }
.serial-app .library-module > div small { display: block; margin-top: 8px; color: var(--muted); font-size: 10px; line-height: 1.35; }
.serial-app .library-module > button { min-height: 44px; border: 0; border-top: 1px solid var(--ink); background: transparent; font: 800 8px/1 var(--mono); letter-spacing: 0.06em; }
.serial-app .library-module > .library-grab { grid-column: 2; border-right: 1px solid var(--ink); touch-action: none; }
.serial-app .library-module > .library-add { grid-column: 3; }
.serial-app .library-module > button:hover { background: var(--acid); }
.serial-app .listen-section { padding-bottom: 14px; }
.serial-app .lesson-grid { display: grid; grid-template-columns: repeat(3, 1fr); border: 1px solid var(--ink); }
.serial-app .lesson-grid > div { min-height: 132px; padding: 14px 16px; border-right: 1px solid var(--ink); }
.serial-app .lesson-grid > div:last-child { border-right: 0; }
.serial-app .lesson-grid span { color: var(--muted); font: 800 8px/1 var(--mono); letter-spacing: 0.09em; }
.serial-app .lesson-grid h3 { margin: 9px 0 7px; font-size: 18px; line-height: 1; letter-spacing: -0.03em; }
.serial-app .lesson-grid p { max-width: 520px; margin: 0; font-size: 12px; line-height: 1.45; }
.serial-app .drag-ghost { position: fixed; z-index: 30; display: flex; width: 156px; min-height: 58px; flex-direction: column; justify-content: center; border: 1.5px solid var(--ink); background: var(--paper); padding: 9px 12px; pointer-events: none; transform: translate(-50%, -50%) rotate(-1deg); }
.serial-app .drag-ghost.magnetized { background: var(--acid); box-shadow: inset 0 0 0 3px var(--paper); }
.serial-app .drag-ghost b { font: 900 12px/1 var(--mono); }
.serial-app .drag-ghost span { margin-top: 6px; font: 800 7px/1 var(--mono); letter-spacing: 0.08em; }
.serial-app .site-footer { display: flex; justify-content: space-between; gap: 16px; padding-top: 9px; color: var(--muted); font: 800 7px/1 var(--mono); letter-spacing: 0.08em; }
.serial-app .sr-only { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0, 0, 0, 0); border: 0; white-space: nowrap; }
@media (max-width: 1100px) {
.serial-app .masthead { align-items: flex-start; flex-direction: column; }
.serial-app .transport { width: 100%; }
.serial-app .transport button { flex: 1; }
.serial-app .fx-library { grid-template-columns: repeat(2, 1fr); }
.serial-app .library-module { border-bottom: 1px solid var(--ink); }
.serial-app .library-module:nth-child(2n) { border-right: 0; }
.serial-app .library-module:last-child { border-bottom: 0; border-right: 1px solid var(--ink); }
}
@media (max-width: 760px) {
.serial-app { padding: 15px; }
.serial-app .transport { display: grid; grid-template-columns: 1fr 1fr; }
.serial-app .transport button:first-child { grid-column: 1 / -1; }
.serial-app .intro-line { align-items: flex-start; flex-direction: column; gap: 8px; }
.serial-app .preset-strip { grid-template-columns: repeat(2, 1fr); }
.serial-app .preset-strip > b { grid-column: 1 / -1; min-height: 38px; border-bottom: 1px solid var(--ink); }
.serial-app .preset-strip button:nth-child(even) { border-left: 0; }
.serial-app .rack-scroll { overflow: visible; }
.serial-app .signal-rail { width: 100%; min-height: 0; flex-direction: column; padding: 14px; background-size: 28px 28px; }
.serial-app .source-module, .serial-app .effect-module, .serial-app .output-module { width: min(100%, 340px); }
.serial-app .effect-chain, .serial-app .chain-pair { width: 100%; flex-direction: column; }
.serial-app .effect-chain.empty { width: 100%; min-width: 0; min-height: 160px; }
.serial-app .snap-slot { width: min(100%, 340px); height: 28px; border: 0; border-right: 1px solid var(--ink); border-left: 1px solid var(--ink); }
.serial-app .snap-slot.target { width: min(100%, 340px); height: 56px; }
.serial-app .cable { width: 1px; height: 54px; flex-direction: column; border-top: 0; border-left: 1px solid var(--ink); }
.serial-app .cable i { transform: rotate(90deg); }
.serial-app .scope-panel { grid-template-columns: 120px 1fr; }
.serial-app .observations { grid-template-columns: 1fr 1fr; }
.serial-app .observations > span { border-bottom: 1px solid var(--line); }
.serial-app .observations > span:nth-child(even) { border-right: 0; }
.serial-app .observations > span:last-child { grid-column: 1 / -1; border-bottom: 0; }
.serial-app .lesson-grid { grid-template-columns: 1fr; }
.serial-app .lesson-grid > div { min-height: 0; border-right: 0; border-bottom: 1px solid var(--ink); }
.serial-app .lesson-grid > div:last-child { border-bottom: 0; }
}
@media (max-width: 520px) {
.serial-app h1 { font-size: 58px; }
.serial-app .transport { grid-template-columns: 1fr; }
.serial-app .transport button:first-child { grid-column: auto; }
.serial-app .preset-strip { grid-template-columns: 1fr; }
.serial-app .preset-strip button { min-height: 44px; border-top: 1px solid var(--line); border-left: 0; }
.serial-app .scope-panel { height: 132px; grid-template-columns: 1fr; grid-template-rows: 44px 1fr; }
.serial-app .scope-panel > div { border-right: 0; border-bottom: 1px solid var(--ink); padding: 8px; }
.serial-app .scope-panel > div span { margin-top: 3px; }
.serial-app .observations { grid-template-columns: 1fr; }
.serial-app .observations > span { border-right: 0; }
.serial-app .observations > span:last-child { grid-column: auto; }
.serial-app .fx-library { grid-template-columns: 1fr; }
.serial-app .library-module, .serial-app .library-module:nth-child(2n), .serial-app .library-module:last-child { border-right: 0; border-bottom: 1px solid var(--ink); }
.serial-app .library-module:last-child { border-bottom: 0; }
.serial-app .library-module > .library-grab { grid-row: 2; }
.serial-app .library-module > .library-add { grid-row: 2; border-left: 1px solid var(--ink); }
.serial-app .site-footer { flex-wrap: wrap; }
}
@media (prefers-reduced-motion: reduce) {
.serial-app *, .serial-app *::before, .serial-app *::after { scroll-behavior: auto !important; transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; }
}
`;
