"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import {
  DEFAULT_PARAMS,
  DEFAULT_STEPS,
  PRESETS,
  ROOTS,
  SUB_LABELS,
  buildBangerGraph,
  encodeWav,
  rootHz,
  scheduleBangerStep,
  triggerBanger,
} from "../banger-engine";
import type {
  BangerGraph,
  BangerParams,
  BangerSnapshot,
  BangerStep,
  FollowMode,
  KickStep,
  SubStep,
  TriggerTelemetry,
} from "../banger-engine";

type Engine = { ctx: AudioContext; graph: BangerGraph };
type BounceResult = { url: string; name: string; size: string; dur: string; peak: string };

type KnobProps = {
  label: string;
  value: number;
  onChange: (v: number) => void;
  size?: number;
  format?: (v: number) => string;
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const pct = (v: number) => `${Math.round(v * 100)}%`;

function Knob({ label, value, onChange, size = 64, format = pct }: KnobProps) {
  const drag = useRef<{ y: number; v: number } | null>(null);
  const v = clamp01(value);
  const a0 = -135;
  const a1 = 135;
  const ang = a0 + (a1 - a0) * v;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 6;
  const pt = (deg: number, rr: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return [cx + rr * Math.cos(rad), cy + rr * Math.sin(rad)] as const;
  };
  const arc = (from: number, to: number, rr: number) => {
    const [x0, y0] = pt(from, rr);
    const [x1, y1] = pt(to, rr);
    return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${rr} ${rr} 0 ${to - from > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  };
  const [ix, iy] = pt(ang, r * .42);
  const [ox, oy] = pt(ang, r * .9);

  const down = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drag.current = { y: e.clientY, v };
  };
  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    onChange(clamp01(drag.current.v + (drag.current.y - e.clientY) / 170));
  };
  const up = (e: ReactPointerEvent<HTMLDivElement>) => {
    drag.current = null;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };
  const key = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowUp" || e.key === "ArrowRight") { onChange(clamp01(v + (e.shiftKey ? .01 : .04))); e.preventDefault(); }
    if (e.key === "ArrowDown" || e.key === "ArrowLeft") { onChange(clamp01(v - (e.shiftKey ? .01 : .04))); e.preventDefault(); }
    if (e.key === "Home") { onChange(0); e.preventDefault(); }
    if (e.key === "End") { onChange(1); e.preventDefault(); }
  };

  return (
    <div className="bng-knobwrap">
      <div
        className="bng-knob"
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(v * 100)}
        aria-valuetext={format(v)}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onKeyDown={key}
        style={{ width: size, height: size }}
      >
        <svg width={size} height={size} aria-hidden="true">
          <circle cx={cx} cy={cy} r={r - 1} className="bng-kbody" />
          <path d={arc(a0, a1, r)} className="bng-ktrack" />
          {[-135, -67.5, 0, 67.5, 135].map((tick) => {
            const [x0, y0] = pt(tick, r + 2);
            const [x1, y1] = pt(tick, r + 5);
            return <line key={tick} x1={x0} y1={y0} x2={x1} y2={y1} className="bng-ktick" />;
          })}
          {v > .001 && <path d={arc(a0, ang, r)} className="bng-kval" />}
          <line x1={ix} y1={iy} x2={ox} y2={oy} className="bng-kptr" />
          <circle cx={cx} cy={cy} r={1.8} className="bng-kdot" />
        </svg>
      </div>
      <div className="bng-klabel">{label}</div>
      <div className="bng-kread">{format(v)}</div>
    </div>
  );
}

function stepClass(base: string, on: boolean, accent: boolean, head: boolean, beat: boolean) {
  return [base, on ? "on" : "", accent ? "accent" : "", head ? "head" : "", beat ? "beat" : ""].filter(Boolean).join(" ");
}

export default function BangerPage() {
  const [params, setParams] = useState<BangerParams>({ ...DEFAULT_PARAMS });
  const [steps, setSteps] = useState<BangerStep[]>(() => DEFAULT_STEPS.map((s) => ({ ...s })));
  const [bpm, setBpm] = useState(132);
  const [swing, setSwing] = useState(.08);
  const [root, setRoot] = useState(0);
  const [octave, setOctave] = useState<1 | 2>(1);
  const [follow, setFollow] = useState<FollowMode>("KICK");
  const [main] = useState(.78);
  const [playing, setPlaying] = useState(false);
  const [uiStep, setUiStep] = useState(-1);
  const [preset, setPreset] = useState("CLUB");
  const [telemetry, setTelemetry] = useState<TriggerTelemetry | null>(null);
  const [lowEnergy, setLowEnergy] = useState(0);
  const [reduction, setReduction] = useState(0);
  const [bars, setBars] = useState(2);
  const [bounceStatus, setBounceStatus] = useState("");
  const [result, setResult] = useState<BounceResult | null>(null);

  const engineRef = useRef<Engine | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const snapshotRef = useRef<BangerSnapshot>({ bpm, swing, root, octave, follow, params, steps, main });
  const queueRef = useRef<Array<{ step: number; time: number; telemetry: TriggerTelemetry | null }>>([]);

  useEffect(() => {
    snapshotRef.current = { bpm, swing, root, octave, follow, params, steps, main };
  }, [bpm, swing, root, octave, follow, params, steps, main]);

  const ensure = useCallback(async () => {
    if (!engineRef.current) {
      const W = window as typeof window & { webkitAudioContext?: typeof AudioContext };
      const Ctx = window.AudioContext ?? W.webkitAudioContext;
      if (!Ctx) return null;
      const ctx = new Ctx();
      const graph = buildBangerGraph(ctx, ctx.destination, main);
      engineRef.current = { ctx, graph };
    }
    if (engineRef.current.ctx.state === "suspended") await engineRef.current.ctx.resume();
    return engineRef.current;
  }, [main]);

  useEffect(() => {
    if (!playing) return;
    let cancelled = false;
    let timer = 0;
    let raf = 0;
    let next = 0;
    let step = 0;

    void (async () => {
      const eng = await ensure();
      if (!eng || cancelled) return;
      next = eng.ctx.currentTime + .08;
      queueRef.current = [];

      timer = window.setInterval(() => {
        const s = snapshotRef.current;
        const stepDur = 60 / s.bpm / 4;
        while (next < eng.ctx.currentTime + .13) {
          const off = step % 2 === 1 ? s.swing * stepDur * .5 : 0;
          const at = next + off;
          const t = scheduleBangerStep(eng.ctx, eng.graph, s, step, at);
          queueRef.current.push({ step, time: at, telemetry: t });
          next += stepDur;
          step = (step + 1) % 16;
        }
      }, 25);

      const updateHead = () => {
        const now = eng.ctx.currentTime;
        while (queueRef.current.length && queueRef.current[0].time <= now) {
          const q = queueRef.current.shift()!;
          setUiStep(q.step);
          if (q.telemetry) setTelemetry(q.telemetry);
        }
        raf = requestAnimationFrame(updateHead);
      };
      raf = requestAnimationFrame(updateHead);
    })();

    return () => {
      cancelled = true;
      if (timer) window.clearInterval(timer);
      if (raf) cancelAnimationFrame(raf);
      queueRef.current = [];
      setUiStep(-1);
    };
  }, [playing, ensure]);

  useEffect(() => {
    let raf = 0;
    let frame = 0;
    const draw = () => {
      const canvas = canvasRef.current;
      const eng = engineRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const w = Math.max(320, Math.round(rect.width * dpr));
        const h = Math.max(190, Math.round(rect.height * dpr));
        if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
        const c = canvas.getContext("2d");
        if (c) {
          c.clearRect(0, 0, w, h);
          c.fillStyle = "#faf6eb";
          c.fillRect(0, 0, w, h);
          c.strokeStyle = "rgba(29,29,27,.18)";
          c.lineWidth = 1 * dpr;
          for (let i = 1; i < 8; i++) {
            const x = (i / 8) * w;
            c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke();
          }
          for (let i = 1; i < 5; i++) {
            const y = (i / 5) * h;
            c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke();
          }

          c.font = `${8 * dpr}px ui-monospace, monospace`;
          c.fillStyle = "#77756e";
          c.fillText("20 HZ", 8 * dpr, 13 * dpr);
          c.fillText("200 HZ", w - 48 * dpr, 13 * dpr);

          if (eng) {
            const data = new Float32Array(eng.graph.analyser.frequencyBinCount);
            eng.graph.analyser.getFloatFrequencyData(data);
            const nyq = eng.ctx.sampleRate / 2;
            const binHz = nyq / data.length;
            const loBin = Math.max(1, Math.floor(20 / binHz));
            const hiBin = Math.min(data.length - 1, Math.ceil(200 / binHz));
            let energy = 0;
            let count = 0;

            c.beginPath();
            let started = false;
            for (let b = loBin; b <= hiBin; b++) {
              const hz = b * binHz;
              const db = Number.isFinite(data[b]) ? data[b] : -120;
              const norm = clamp01((db + 92) / 78);
              energy += norm;
              count++;
              const x = ((hz - 20) / 180) * w;
              const y = h * .73 - norm * h * .56;
              if (!started) { c.moveTo(x, y); started = true; } else c.lineTo(x, y);
            }
            c.strokeStyle = "#1d1d1b";
            c.lineWidth = 2 * dpr;
            c.stroke();

            const avg = count ? energy / count : 0;
            const now = eng.ctx.currentTime;
            let impact = 0;
            let weight = 0;
            if (telemetry && now >= telemetry.when) {
              const elapsed = now - telemetry.when;
              const handoff = telemetry.handoffMs / 1000;
              if (elapsed < handoff * 1.25) impact = clamp01(1 - elapsed / (handoff * 1.12));
              if (elapsed >= Math.max(0, telemetry.subEntry - telemetry.when - .02)) {
                weight = clamp01((elapsed - (telemetry.subEntry - telemetry.when - .02)) / .06);
                weight *= clamp01(1 - Math.max(0, elapsed - .55) / .38);
              }
            }

            const barY = h * .82;
            const barH = 14 * dpr;
            const half = w / 2;
            c.fillStyle = "rgba(29,29,27,.16)";
            c.fillRect(0, barY, half - 3 * dpr, barH);
            c.fillRect(half + 3 * dpr, barY, half - 3 * dpr, barH);
            c.fillStyle = "#1d1d1b";
            c.fillRect(0, barY, (half - 3 * dpr) * impact, barH);
            c.fillStyle = "#dfff00";
            c.fillRect(half + 3 * dpr, barY, (half - 3 * dpr) * weight, barH);
            c.fillStyle = "#1d1d1b";
            c.font = `${8 * dpr}px ui-monospace, monospace`;
            c.fillText("IMPACT", 6 * dpr, barY + 11 * dpr);
            c.fillText("WEIGHT", half + 9 * dpr, barY + 11 * dpr);

            if (++frame % 8 === 0) {
              setLowEnergy(avg);
              setReduction(Math.abs(eng.graph.compressor.reduction || 0));
            }
          } else {
            c.fillStyle = "#77756e";
            c.font = `700 ${10 * dpr}px ui-monospace, monospace`;
            c.fillText("PRESS HIT BANGER OR PLAY TO ENERGIZE LOW-FREQUENCY TRACE", 14 * dpr, h * .5);
          }
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [telemetry]);

  useEffect(() => () => { if (result?.url) URL.revokeObjectURL(result.url); }, [result]);

  const setParam = (key: keyof BangerParams, value: number) => {
    setParams((p) => ({ ...p, [key]: clamp01(value) }));
    setPreset("CUSTOM");
  };

  const loadPreset = (name: string) => {
    const p = PRESETS.find((x) => x.name === name);
    if (!p) return;
    setPreset(p.name);
    setBpm(p.bpm);
    setFollow(p.follow);
    setParams({ ...p.params });
    setSteps(p.steps.map((s) => ({ ...s })));
  };

  const audition = async () => {
    const eng = await ensure();
    if (!eng) return;
    const s = snapshotRef.current;
    const when = eng.ctx.currentTime + .018;
    const t = triggerBanger(eng.ctx, eng.graph, s, when, 2, 1, 60 / s.bpm / 4);
    if (t) setTelemetry(t);
  };

  const cycleKick = (i: number) => {
    setSteps((old) => old.map((s, n) => n === i ? { ...s, kick: ((s.kick + 1) % 3) as KickStep } : s));
    setPreset("CUSTOM");
  };

  const cycleSub = (i: number) => {
    setSteps((old) => old.map((s, n) => n === i ? { ...s, sub: ((s.sub + 1) % 4) as SubStep } : s));
    setPreset("CUSTOM");
  };

  const clearPattern = () => {
    setSteps(Array.from({ length: 16 }, () => ({ kick: 0 as KickStep, sub: 0 as SubStep })));
    setPreset("CUSTOM");
  };

  const doBounce = async () => {
    const Offline = window.OfflineAudioContext;
    if (!Offline) { setBounceStatus("OFFLINE AUDIO IS NOT AVAILABLE IN THIS BROWSER."); return; }
    setBounceStatus("RENDERING…");
    if (result?.url) URL.revokeObjectURL(result.url);
    setResult(null);
    try {
      const s = snapshotRef.current;
      const sampleRate = 44100;
      const stepDur = 60 / s.bpm / 4;
      const loopLen = bars * 16 * stepDur;
      const tailLen = 2.4;
      const ctx = new Offline(2, Math.ceil((loopLen + tailLen) * sampleRate), sampleRate);
      const graph = buildBangerGraph(ctx, ctx.destination, s.main);
      for (let bar = 0; bar < bars; bar++) {
        for (let step = 0; step < 16; step++) {
          const base = (bar * 16 + step) * stepDur;
          const off = step % 2 === 1 ? s.swing * stepDur * .5 : 0;
          scheduleBangerStep(ctx, graph, s, step, base + off);
        }
      }
      const rendered = await ctx.startRendering();
      const frames = Math.round(loopLen * sampleRate);
      const wrap = Math.min(rendered.length - frames, Math.round(Math.min(tailLen, loopLen) * sampleRate));
      const channels: Float32Array[] = [];
      let peak = 0;
      for (let ch = 0; ch < 2; ch++) {
        const src = rendered.getChannelData(ch);
        const dst = new Float32Array(frames);
        for (let i = 0; i < frames; i++) dst[i] = src[i];
        for (let i = 0; i < wrap; i++) dst[i] += src[frames + i];
        for (let i = 0; i < frames; i++) peak = Math.max(peak, Math.abs(dst[i]));
        channels.push(dst);
      }
      const trim = peak > .97 ? .97 / peak : 1;
      const wav = encodeWav(channels, sampleRate, trim);
      const blob = new Blob([wav], { type: "audio/wav" });
      const name = `banger-${Math.round(s.bpm)}bpm-${bars}bar-${ROOTS[s.root].replace("♯", "s")}.wav`;
      const url = URL.createObjectURL(blob);
      const finalPeak = Math.max(peak * trim, 1e-6);
      setResult({ url, name, size: (blob.size / 1048576).toFixed(2), dur: loopLen.toFixed(2), peak: (20 * Math.log10(finalPeak)).toFixed(1) });
      setBounceStatus("");

      const file = new File([blob], name, { type: "audio/wav" });
      if (navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file], title: name }); } catch { /* user dismissed */ }
      }
    } catch (error) {
      setBounceStatus(`RENDER FAILED / ${error instanceof Error ? error.message : "UNKNOWN ERROR"}`);
    }
  };

  const note = rootHz(root, octave);
  const handoff = telemetry?.handoffMs ?? (126 + (42 - 126) * params.nest);
  const activeHits = steps.reduce((n, s) => n + (s.kick ? 1 : 0), 0);
  const activeSubs = follow === "KICK" ? activeHits : steps.reduce((n, s) => n + (s.sub ? 1 : 0), 0);
  const selectedPreset = PRESETS.find((p) => p.name === preset);
  const css = useMemo(() => STYLES, []);

  return (
    <main className="bng">
      <style>{css}</style>

      <header className="bng-masthead">
        <div className="bng-identity">
          <div className="bng-plate">MZCMG_SL—09</div>
          <div>
            <h1>BANGER</h1>
            <p>KICK × SUB NESTING ENGINE</p>
          </div>
        </div>
        <div className="bng-brand">MZCMG + MATCH ZIMMERMAN CREATIVE MEDIA GROUP</div>
      </header>

      <section className="bng-transport" aria-label="Transport and tuning">
        <button className={`bng-play ${playing ? "on" : ""}`} onClick={() => setPlaying((v) => !v)}>
          <span>{playing ? "■" : "▶"}</span>{playing ? "STOP" : "PLAY"}
        </button>
        <button className="bng-audition" onClick={audition}>HIT BANGER</button>
        <label className="bng-number">
          <span>BPM</span>
          <input type="number" min={50} max={220} value={bpm} onChange={(e) => setBpm(Math.max(50, Math.min(220, Number(e.target.value) || 50)))} />
        </label>
        <label className="bng-number">
          <span>SWING</span>
          <input type="number" min={0} max={50} value={Math.round(swing * 100)} onChange={(e) => setSwing(clamp01((Number(e.target.value) || 0) / 100) * .5)} />
          <i>%</i>
        </label>
        <div className="bng-segwrap bng-tune">
          <span>ROOT</span>
          <select aria-label="Sub root note" value={root} onChange={(e) => setRoot(Number(e.target.value))}>
            {ROOTS.map((r, i) => <option key={r} value={i}>{r}</option>)}
          </select>
        </div>
        <div className="bng-segwrap bng-oct">
          <span>OCTAVE</span>
          <div className="bng-seg">
            {([1, 2] as const).map((o) => <button key={o} className={octave === o ? "on" : ""} onClick={() => setOctave(o)}>{o}</button>)}
          </div>
        </div>
        <div className="bng-segwrap bng-follow">
          <span>FOLLOW</span>
          <div className="bng-seg">
            {(["KICK", "BASS"] as const).map((m) => <button key={m} className={follow === m ? "on" : ""} onClick={() => setFollow(m)}>{m}</button>)}
          </div>
        </div>
      </section>

      <section className="bng-observe" aria-label="Low frequency observation">
        <div className="bng-module-title"><span>00</span><div><h2>LOW FIELD</h2><p>ACTUAL OUTPUT / 20–200 HZ</p></div><i>LF</i></div>
        <canvas ref={canvasRef} className="bng-scope" aria-label="Live low-frequency spectrum and kick-to-sub handoff trace" />
        <div className="bng-register">
          <div><span>FUNDAMENTAL</span><b>{note.toFixed(1)} HZ</b></div>
          <div><span>NEST HANDOFF</span><b>{Math.round(handoff)} MS</b></div>
          <div><span>LOW ENERGY</span><b>{Math.round(lowEnergy * 100)}%</b></div>
          <div><span>GAIN REDUCTION</span><b>{reduction.toFixed(1)} DB</b></div>
          <div><span>TRANSLATION</span><b>{params.system < .35 ? "PHONE" : params.system > .68 ? "SYSTEM" : "HYBRID"}</b></div>
        </div>
      </section>

      <section className="bng-section">
        <div className="bng-module-title"><span>01</span><div><h2>ARCHITECTURE</h2><p>LOW-END PERSONALITIES</p></div><i>ARC</i></div>
        <div className="bng-presets">
          {PRESETS.map((p) => (
            <button key={p.name} className={preset === p.name ? "on" : ""} onClick={() => loadPreset(p.name)}>
              <b>{p.name}</b><span>{p.subtitle}</span>
            </button>
          ))}
        </div>
        <div className="bng-preset-note">
          <b>{preset}</b>
          <span>{selectedPreset?.subtitle ?? "MANUAL LOW-END ARCHITECTURE"}</span>
        </div>
      </section>

      <section className="bng-section bng-macro-section">
        <div className="bng-module-title"><span>02</span><div><h2>NEST</h2><p>IMPACT → WEIGHT COORDINATION</p></div><i>NST</i></div>
        <div className="bng-macros">
          <div className="bng-banger-macro">
            <Knob label="BANGER" value={params.banger} onChange={(v) => setParam("banger", v)} size={128} />
            <p>NONLINEAR MASTER MACRO<br />TRANSIENT · DRIVE · MASS · HANDOFF</p>
          </div>
          <div className="bng-knobgrid">
            <Knob label="BUMP" value={params.bump} onChange={(v) => setParam("bump", v)} />
            <Knob label="WEIGHT" value={params.weight} onChange={(v) => setParam("weight", v)} />
            <Knob label="KNOCK" value={params.knock} onChange={(v) => setParam("knock", v)} />
            <Knob label="DEPTH" value={params.depth} onChange={(v) => setParam("depth", v)} />
            <Knob label="TAIL" value={params.tail} onChange={(v) => setParam("tail", v)} />
            <Knob label="NEST" value={params.nest} onChange={(v) => setParam("nest", v)} />
            <Knob label="GRIT" value={params.grit} onChange={(v) => setParam("grit", v)} />
            <Knob label="SPACE" value={params.space} onChange={(v) => setParam("space", v)} />
          </div>
        </div>
        <div className="bng-system">
          <div className="bng-system-head"><span>PHONE</span><b>TRANSLATION</b><span>SYSTEM</span></div>
          <input aria-label="Phone to system translation" type="range" min={0} max={100} value={Math.round(params.system * 100)} onChange={(e) => setParam("system", Number(e.target.value) / 100)} />
          <p>PHONE ADDS RELATED UPPER HARMONICS · SYSTEM RESTORES TRUE FUNDAMENTAL WEIGHT</p>
        </div>
      </section>

      <section className="bng-section">
        <div className="bng-module-title"><span>03</span><div><h2>SEQUENCE</h2><p>KICK / SUB RELATIONSHIP GRID</p></div><i>SEQ</i></div>
        <div className="bng-seq-actions">
          <span>{activeHits} KICKS / {activeSubs} SUB EVENTS</span>
          <button onClick={clearPattern}>CLEAR</button>
        </div>
        <div className="bng-ruler"><div>STEP</div><div className="bng-grid">{Array.from({ length: 16 }, (_, i) => <span key={i}>{i % 4 === 0 ? i / 4 + 1 : "·"}</span>)}</div></div>
        <div className="bng-seqrow">
          <div className="bng-rowlabel"><b>KICK</b><span>OFF → HIT → ACC</span></div>
          <div className="bng-grid">
            {steps.map((s, i) => (
              <button
                key={i}
                className={stepClass("bng-cell", s.kick > 0, s.kick === 2, uiStep === i, i % 4 === 0)}
                onClick={() => cycleKick(i)}
                aria-label={`Kick step ${i + 1}: ${s.kick === 2 ? "accent" : s.kick === 1 ? "hit" : "off"}`}
              >{s.kick === 2 ? "▲" : s.kick === 1 ? "•" : ""}</button>
            ))}
          </div>
        </div>
        <div className={`bng-seqrow ${follow === "KICK" ? "auto" : ""}`}>
          <div className="bng-rowlabel"><b>SUB</b><span>{follow === "KICK" ? "AUTO FROM KICK" : "OFF → ROOT → 5TH → 8VE"}</span></div>
          <div className="bng-grid">
            {steps.map((s, i) => (
              <button
                key={i}
                className={stepClass("bng-cell bng-subcell", s.sub > 0, s.sub === 3, uiStep === i, i % 4 === 0)}
                onClick={() => cycleSub(i)}
                aria-label={`Sub step ${i + 1}: ${SUB_LABELS[s.sub]}`}
                title={SUB_LABELS[s.sub]}
              >{s.sub ? SUB_LABELS[s.sub].slice(0, 1) : ""}</button>
            ))}
          </div>
        </div>
        <p className="bng-hint"><b>FOLLOW KICK</b> turns every kick into one fused IMPACT→WEIGHT event. <b>FOLLOW BASS</b> lets the lower lane become an independent ROOT / 5TH / OCTAVE bass sequence while kicks tune themselves toward the active low-note architecture.</p>
      </section>

      <section className="bng-section bng-section-last">
        <div className="bng-module-title"><span>04</span><div><h2>BOUNCE</h2><p>OFFLINE LOOP RENDER</p></div><i>WAV</i></div>
        <div className="bng-bounce-row">
          <div className="bng-seg bng-bars">
            {[1, 2, 4].map((n) => <button key={n} className={bars === n ? "on" : ""} onClick={() => setBars(n)}>{n} BAR{n > 1 ? "S" : ""}</button>)}
          </div>
          <button className="bng-bounce" onClick={doBounce} disabled={bounceStatus === "RENDERING…" || activeHits + activeSubs === 0}>{bounceStatus === "RENDERING…" ? "RENDERING…" : "BOUNCE BANGER"}</button>
        </div>
        {bounceStatus && bounceStatus !== "RENDERING…" && <p className="bng-error">{bounceStatus}</p>}
        {result && (
          <div className="bng-result">
            <div className="bng-register">
              <div><span>DURATION</span><b>{result.dur} S</b></div>
              <div><span>SIZE</span><b>{result.size} MB</b></div>
              <div><span>PEAK</span><b>{result.peak} DBFS</b></div>
              <div><span>FORMAT</span><b>44.1K / 16-BIT</b></div>
            </div>
            <audio controls src={result.url} />
            <a className="bng-save" href={result.url} download={result.name}>SAVE {result.name}</a>
            <p className="bng-hint">TAIL ENERGY IS FOLDED BACK ONTO THE LOOP HEAD FOR A CLEANER REPEAT.</p>
          </div>
        )}
      </section>

      <footer className="bng-foot">
        <span>MZCMG // SONIC LAB</span>
        <span>KICK × SUB / IMPACT → WEIGHT</span>
        <span>FIELD UNIT № 09</span>
      </footer>
    </main>
  );
}

const STYLES = `
.bng{ --paper:#eee9dc; --paper-deep:#d5d0c4; --paper-light:#faf6eb; --ink:#1d1d1b; --acid:#dfff00; --muted:#77756e; --line:rgba(29,29,27,.32); --danger:#b82618;
  width:min(100%,1120px); min-height:100vh; margin:0 auto; padding:24px 24px 18px; color:var(--ink); background:var(--paper); font-family:Arial,Helvetica,sans-serif; }
.bng *{ box-sizing:border-box; }
.bng button,.bng input,.bng select{ font:inherit; color:inherit; }
.bng button{ cursor:pointer; }
.bng button:focus-visible,.bng input:focus-visible,.bng select:focus-visible,.bng a:focus-visible,.bng [role=slider]:focus-visible{ outline:3px solid var(--acid); outline-offset:2px; }

.bng-masthead{ display:flex; justify-content:space-between; gap:24px; align-items:flex-end; border-top:2px solid var(--ink); border-bottom:2px solid var(--ink); padding:12px 0 15px; }
.bng-identity{ display:flex; gap:14px; align-items:stretch; }
.bng-plate{ writing-mode:vertical-rl; transform:rotate(180deg); background:var(--ink); color:var(--paper); padding:7px 6px; font:800 9px/1 ui-monospace,monospace; letter-spacing:.11em; }
.bng h1{ margin:0; font-size:clamp(58px,9vw,112px); line-height:.72; letter-spacing:-.078em; font-weight:900; }
.bng-masthead p{ margin:10px 0 0 3px; font:800 10px/1 ui-monospace,monospace; letter-spacing:.15em; }
.bng-brand{ max-width:260px; text-align:right; font:800 8px/1.35 ui-monospace,monospace; letter-spacing:.12em; color:var(--muted); }

.bng-transport{ display:grid; grid-template-columns:1.1fr 1.1fr .8fr .8fr .8fr .9fr 1.2fr; gap:5px; padding:10px 0; border-bottom:2px solid var(--ink); }
.bng-play,.bng-audition,.bng-number,.bng-segwrap{ min-height:58px; border:1.5px solid var(--ink); background:transparent; }
.bng-play,.bng-audition{ display:flex; align-items:center; justify-content:center; gap:8px; font:900 10px/1 ui-monospace,monospace; letter-spacing:.08em; }
.bng-play:hover,.bng-play.on,.bng-audition:hover{ background:var(--acid); }
.bng-audition{ background:var(--ink); color:var(--paper); }
.bng-audition:hover{ color:var(--ink); }
.bng-number{ position:relative; padding:7px 8px; display:grid; grid-template-columns:1fr auto; align-items:end; }
.bng-number span,.bng-segwrap>span{ grid-column:1/-1; font:800 8px/1 ui-monospace,monospace; color:var(--muted); letter-spacing:.11em; }
.bng-number input{ width:100%; border:0; border-bottom:1px dashed var(--line); background:transparent; font:900 18px/1 ui-monospace,monospace; outline:0; }
.bng-number i{ font:800 9px/1 ui-monospace,monospace; font-style:normal; color:var(--muted); }
.bng-segwrap{ padding:7px; display:flex; flex-direction:column; gap:6px; }
.bng-seg{ display:grid; grid-auto-flow:column; grid-auto-columns:1fr; border:1px solid var(--ink); min-height:30px; }
.bng-seg button{ border:0; border-right:1px solid var(--ink); background:transparent; font:800 8px/1 ui-monospace,monospace; letter-spacing:.06em; min-width:0; }
.bng-seg button:last-child{ border-right:0; }
.bng-seg button:hover,.bng-seg button.on{ background:var(--acid); }
.bng-tune select{ flex:1; border:1px solid var(--ink); border-radius:0; background:var(--paper-light); font:900 13px/1 ui-monospace,monospace; padding:0 5px; }

.bng-observe,.bng-section{ padding:17px 0; border-bottom:1.5px solid var(--ink); }
.bng-section-last{ border-bottom:2px solid var(--ink); }
.bng-module-title{ display:grid; grid-template-columns:30px 1fr auto; gap:0; align-items:start; border-bottom:1px solid var(--line); padding-bottom:8px; margin-bottom:14px; }
.bng-module-title>span{ width:23px; height:23px; display:grid; place-items:center; background:var(--acid); border:1px solid var(--ink); font:900 8px/1 ui-monospace,monospace; }
.bng-module-title h2{ margin:0; font-size:19px; line-height:1; letter-spacing:-.035em; }
.bng-module-title p{ margin:4px 0 0; color:var(--muted); font:800 8px/1 ui-monospace,monospace; letter-spacing:.1em; }
.bng-module-title i{ font:800 8px/1 ui-monospace,monospace; color:var(--muted); font-style:normal; }

.bng-scope{ display:block; width:100%; height:260px; border:1.5px solid var(--ink); background:var(--paper-light); }
.bng-register{ display:grid; grid-template-columns:repeat(5,1fr); border:1px solid var(--ink); border-top:0; }
.bng-register>div{ padding:9px 10px; border-right:1px solid var(--line); min-width:0; }
.bng-register>div:last-child{ border-right:0; }
.bng-register span{ display:block; color:var(--muted); font:800 7.5px/1 ui-monospace,monospace; letter-spacing:.1em; margin-bottom:5px; }
.bng-register b{ display:block; font:900 12px/1 ui-monospace,monospace; white-space:nowrap; }

.bng-presets{ display:grid; grid-template-columns:repeat(7,1fr); border:1px solid var(--ink); }
.bng-presets button{ min-height:72px; padding:9px 8px; border:0; border-right:1px solid var(--ink); background:transparent; text-align:left; }
.bng-presets button:last-child{ border-right:0; }
.bng-presets button:hover,.bng-presets button.on{ background:var(--acid); }
.bng-presets b{ display:block; font:900 10px/1 ui-monospace,monospace; letter-spacing:.05em; }
.bng-presets span{ display:block; margin-top:7px; color:var(--muted); font:800 7px/1.25 ui-monospace,monospace; letter-spacing:.06em; }
.bng-presets button.on span{ color:var(--ink); }
.bng-preset-note{ display:flex; justify-content:space-between; gap:10px; padding:7px 0 0; font:800 8px/1 ui-monospace,monospace; letter-spacing:.08em; }
.bng-preset-note span{ color:var(--muted); }

.bng-macros{ display:grid; grid-template-columns:220px 1fr; gap:10px; align-items:stretch; }
.bng-banger-macro{ border:2px solid var(--ink); min-height:235px; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:14px; background:var(--paper-light); }
.bng-banger-macro p{ text-align:center; margin:10px 0 0; font:800 7.5px/1.45 ui-monospace,monospace; color:var(--muted); letter-spacing:.08em; }
.bng-knobgrid{ display:grid; grid-template-columns:repeat(4,1fr); border-top:1px solid var(--ink); border-left:1px solid var(--ink); }
.bng-knobwrap{ min-height:112px; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:9px 4px; border-right:1px solid var(--ink); border-bottom:1px solid var(--ink); }
.bng-banger-macro .bng-knobwrap{ border:0; min-height:0; padding:0; }
.bng-knob{ touch-action:none; user-select:none; cursor:ns-resize; }
.bng-knob svg{ overflow:visible; }
.bng-kbody{ fill:var(--paper); stroke:var(--ink); stroke-width:1.5; }
.bng-ktrack{ fill:none; stroke:rgba(29,29,27,.26); stroke-width:3; stroke-linecap:square; }
.bng-kval{ fill:none; stroke:var(--acid); stroke-width:4; stroke-linecap:square; }
.bng-ktick{ stroke:var(--ink); stroke-width:1; }
.bng-kptr{ stroke:var(--ink); stroke-width:2.5; }
.bng-kdot{ fill:var(--ink); }
.bng-klabel{ margin-top:5px; font:900 8px/1 ui-monospace,monospace; letter-spacing:.09em; }
.bng-kread{ margin-top:4px; font:800 8px/1 ui-monospace,monospace; color:var(--muted); }
.bng-banger-macro .bng-klabel{ font-size:12px; }
.bng-banger-macro .bng-kread{ font-size:12px; color:var(--ink); }
.bng-system{ margin-top:10px; border:1px solid var(--ink); padding:10px 12px; }
.bng-system-head{ display:flex; justify-content:space-between; align-items:center; font:900 8px/1 ui-monospace,monospace; letter-spacing:.1em; }
.bng-system-head b{ font-size:10px; }
.bng-system input[type=range]{ width:100%; accent-color:var(--ink); margin:9px 0 4px; }
.bng-system p{ margin:0; text-align:center; color:var(--muted); font:800 7px/1 ui-monospace,monospace; letter-spacing:.08em; }

.bng-seq-actions{ display:flex; justify-content:space-between; align-items:center; margin-bottom:7px; font:800 8px/1 ui-monospace,monospace; color:var(--muted); }
.bng-seq-actions button{ min-height:34px; border:1px solid var(--ink); background:transparent; padding:0 12px; font:800 8px/1 ui-monospace,monospace; }
.bng-seq-actions button:hover{ background:var(--acid); }
.bng-ruler,.bng-seqrow{ display:grid; grid-template-columns:120px 1fr; gap:6px; align-items:center; }
.bng-ruler{ margin-bottom:5px; color:var(--muted); font:800 7.5px/1 ui-monospace,monospace; }
.bng-ruler>div:first-child{ padding-left:7px; }
.bng-grid{ display:grid; grid-template-columns:repeat(16,1fr); gap:2px; }
.bng-ruler .bng-grid span{ text-align:center; }
.bng-seqrow{ margin-bottom:5px; }
.bng-rowlabel{ min-height:42px; border:1px solid var(--ink); padding:7px; display:flex; flex-direction:column; justify-content:center; }
.bng-rowlabel b{ font:900 10px/1 ui-monospace,monospace; }
.bng-rowlabel span{ margin-top:4px; color:var(--muted); font:800 6.5px/1 ui-monospace,monospace; letter-spacing:.04em; }
.bng-cell{ height:42px; border:1px solid var(--line); background:var(--paper-light); font:900 10px/1 ui-monospace,monospace; position:relative; }
.bng-cell.beat{ border-left:1.5px solid var(--ink); }
.bng-cell:hover{ border-color:var(--ink); }
.bng-cell.on{ background:var(--ink); color:var(--paper); border-color:var(--ink); }
.bng-cell.accent{ background:var(--acid); color:var(--ink); }
.bng-cell.head{ box-shadow:inset 0 -4px 0 var(--acid); }
.bng-cell.accent.head{ box-shadow:inset 0 -4px 0 var(--ink); }
.bng-subcell.on{ background:rgba(29,29,27,.14); color:var(--ink); }
.bng-subcell.accent{ background:var(--acid); }
.bng-seqrow.auto .bng-subcell{ opacity:.42; }
.bng-hint{ margin:9px 0 0; color:var(--muted); font:700 9px/1.45 ui-monospace,monospace; }
.bng-hint b{ color:var(--ink); }

.bng-bounce-row{ display:flex; gap:8px; }
.bng-bars{ min-height:50px; width:280px; }
.bng-bounce{ flex:1; min-height:50px; border:1.5px solid var(--ink); background:var(--ink); color:var(--paper); font:900 10px/1 ui-monospace,monospace; letter-spacing:.09em; }
.bng-bounce:hover:not(:disabled){ background:var(--acid); color:var(--ink); }
.bng-bounce:disabled{ opacity:.35; cursor:not-allowed; }
.bng-error{ color:var(--danger); font:900 8px/1.3 ui-monospace,monospace; letter-spacing:.06em; }
.bng-result{ margin-top:12px; border-top:1px solid var(--ink); padding-top:12px; display:grid; gap:8px; }
.bng-result .bng-register{ border-top:1px solid var(--ink); grid-template-columns:repeat(4,1fr); }
.bng-result audio{ width:100%; }
.bng-save{ min-height:46px; display:grid; place-items:center; background:var(--acid); border:1.5px solid var(--ink); color:var(--ink); text-decoration:none; font:900 9px/1 ui-monospace,monospace; letter-spacing:.06em; }

.bng-foot{ display:flex; justify-content:space-between; gap:8px; flex-wrap:wrap; padding-top:9px; color:var(--muted); font:800 7.5px/1 ui-monospace,monospace; letter-spacing:.09em; }

@media(max-width:900px){
  .bng{ padding:18px 15px 14px; }
  .bng-transport{ grid-template-columns:repeat(4,1fr); }
  .bng-follow{ grid-column:span 2; }
  .bng-presets{ grid-template-columns:repeat(4,1fr); }
  .bng-presets button:nth-child(4){ border-right:0; }
  .bng-presets button:nth-child(-n+4){ border-bottom:1px solid var(--ink); }
  .bng-macros{ grid-template-columns:180px 1fr; }
  .bng-knobgrid{ grid-template-columns:repeat(3,1fr); }
  .bng-register{ grid-template-columns:repeat(2,1fr); }
  .bng-register>div{ border-bottom:1px solid var(--line); }
  .bng-register>div:nth-child(2n){ border-right:0; }
}
@media(max-width:620px){
  .bng-masthead{ align-items:flex-start; }
  .bng-brand{ display:none; }
  .bng h1{ font-size:clamp(54px,20vw,88px); }
  .bng-transport{ grid-template-columns:repeat(2,1fr); }
  .bng-play,.bng-audition{ min-height:58px; }
  .bng-follow{ grid-column:auto; }
  .bng-scope{ height:220px; }
  .bng-register{ grid-template-columns:1fr; }
  .bng-register>div{ border-right:0; }
  .bng-presets{ grid-template-columns:repeat(2,1fr); }
  .bng-presets button{ border-bottom:1px solid var(--ink); }
  .bng-presets button:nth-child(2n){ border-right:0; }
  .bng-presets button:last-child{ border-bottom:0; }
  .bng-macros{ grid-template-columns:1fr; }
  .bng-banger-macro{ min-height:205px; }
  .bng-knobgrid{ grid-template-columns:repeat(2,1fr); }
  .bng-ruler,.bng-seqrow{ grid-template-columns:1fr; gap:3px; }
  .bng-ruler>div:first-child{ display:none; }
  .bng-rowlabel{ min-height:35px; flex-direction:row; justify-content:space-between; align-items:center; }
  .bng-cell{ height:46px; }
  .bng-grid{ grid-template-columns:repeat(8,1fr); gap:3px; }
  .bng-ruler .bng-grid span:nth-child(n+9){ display:none; }
  .bng-seqrow .bng-grid{ row-gap:3px; }
  .bng-bounce-row{ flex-direction:column; }
  .bng-bars{ width:100%; }
  .bng-foot{ flex-direction:column; }
}
@media(prefers-reduced-motion:reduce){ .bng *{ transition:none!important; scroll-behavior:auto!important; } }
`;
