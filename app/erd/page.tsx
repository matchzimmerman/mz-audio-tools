"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import {
  KIT, PATTERN, SPEC, OSCS, OSC_LABEL, MODS, MOD_LABEL,
  toNorm, fromNorm, clamp01, snapHz,
  fmtPitch, fmtHz, fmtMs, fmtPct, fmtPan, fmtBend,
  buildGraph, triggerVoice, scheduleStep, encodeWav,
  randomizeVoice, randomizePattern,
} from "../erd-engine";
import type { Part, Spec, EngineSnapshot, Graph } from "../erd-engine";

/* ============================================================
   KNOB — ink track, acid-yellow value arc, ARIA slider semantics
   ============================================================ */
function Knob({
  label, value, spec, onChange, onRelease, format, size = 56, dflt,
}: {
  label: string; value: number; spec: Spec; onChange: (v: number) => void;
  onRelease?: () => void; format: (v: number) => string; size?: number; dflt?: number;
}) {
  const norm = clamp01(toNorm(value, spec));
  const drag = useRef<{ y: number; n: number } | null>(null);
  const lastTap = useRef(0);

  const down = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drag.current = { y: e.clientY, n: norm };
    const now = Date.now();
    if (now - lastTap.current < 280 && dflt !== undefined) {
      onChange(dflt);
      drag.current = { y: e.clientY, n: clamp01(toNorm(dflt, spec)) };
    }
    lastTap.current = now;
  };
  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const dy = drag.current.y - e.clientY;
    onChange(fromNorm(clamp01(drag.current.n + dy / 170), spec));
  };
  const up = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    drag.current = null;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    onRelease?.();
  };
  const key = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const st = e.shiftKey ? 0.005 : 0.03;
    if (e.key === "ArrowUp" || e.key === "ArrowRight") { onChange(fromNorm(clamp01(norm + st), spec)); e.preventDefault(); }
    if (e.key === "ArrowDown" || e.key === "ArrowLeft") { onChange(fromNorm(clamp01(norm - st), spec)); e.preventDefault(); }
    if (e.key === "Enter" || e.key === " ") { onRelease?.(); e.preventDefault(); }
  };

  const cx = size / 2, cy = size / 2, r = size / 2 - 5;
  const A0 = -135, A1 = 135;
  const ang = A0 + (A1 - A0) * norm;
  const pt = (deg: number, rr: number): [number, number] => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return [cx + rr * Math.cos(rad), cy + rr * Math.sin(rad)];
  };
  const arc = (from: number, to: number, rr: number) => {
    const [x0, y0] = pt(from, rr);
    const [x1, y1] = pt(to, rr);
    return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${rr} ${rr} 0 ${to - from > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  };
  const [ix, iy] = pt(ang, r * 0.5);
  const [ox, oy] = pt(ang, r * 0.92);

  return (
    <div className="erd-knobwrap">
      <div
        className="erd-knob"
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(norm * 100)}
        aria-valuetext={format(value)}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onKeyDown={key}
        style={{ width: size, height: size }}
      >
        <svg width={size} height={size}>
          <circle cx={cx} cy={cy} r={r - 1} className="erd-kbody" />
          <path d={arc(A0, A1, r)} className="erd-ktrack" />
          {[A0, 0, A1].map((tickAngle) => {
            const [tx0, ty0] = pt(tickAngle, r + 2);
            const [tx1, ty1] = pt(tickAngle, r + 5);
            return <line key={tickAngle} x1={tx0} y1={ty0} x2={tx1} y2={ty1} className="erd-ktick" />;
          })}
          {norm > 0.001 && <path d={arc(A0, ang, r)} className="erd-kval" />}
          <line x1={ix} y1={iy} x2={ox} y2={oy} className="erd-kptr" />
          <circle cx={cx} cy={cy} r={1.6} className="erd-kdot" />
        </svg>
      </div>
      <div className="erd-klabel">{label}</div>
      <div className="erd-kval-text">{format(value)}</div>
    </div>
  );
}

/* ============================================================
   MAIN
   ============================================================ */
export default function ErdPage() {
  const [parts, setParts] = useState<Part[]>(() => KIT.map((p) => ({ ...p })));
  const [steps, setSteps] = useState<number[][]>(() => PATTERN.map((r) => [...r]));
  const [mutes, setMutes] = useState<boolean[]>(() => KIT.map(() => false));
  const [bpm, setBpm] = useState(96);
  const [swing, setSwing] = useState(0.12);
  const [dlyTime, setDlyTime] = useState(3);
  const [dlyFb, setDlyFb] = useState(0.32);
  const [master, setMaster] = useState(0.85);
  const [snap, setSnap] = useState(true);
  const [sel, setSel] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [uiStep, setUiStep] = useState(-1);
  const [bars, setBars] = useState(2);
  const [status, setStatus] = useState("");
  const [result, setResult] = useState<{ url: string; name: string; size: string; dur: string; peak: string } | null>(null);

  const engRef = useRef<{ ctx: AudioContext } & Graph | null>(null);
  const snapRef = useRef<EngineSnapshot>({ parts, steps, mutes, bpm, swing, dlyTime, dlyFb, master });
  useEffect(() => {
    snapRef.current = { parts, steps, mutes, bpm, swing, dlyTime, dlyFb, master };
  });

  const p = parts[sel];
  const stepDur = 60 / bpm / 4;

  const ensure = useCallback(() => {
    if (!engRef.current) {
      const AC = window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      const ctx = new AC();
      engRef.current = { ctx, ...buildGraph(ctx, snapRef.current) };
    }
    if (engRef.current.ctx.state === "suspended") engRef.current.ctx.resume();
    return engRef.current;
  }, []);

  useEffect(() => {
    const eng = engRef.current;
    if (!eng) return;
    const now = eng.ctx.currentTime;
    parts.forEach((pt2, i) => {
      const c = eng.chains[i];
      c.in.gain.setTargetAtTime(pt2.level, now, 0.012);
      c.shelf.gain.setTargetAtTime(pt2.low * 15, now, 0.012);
      c.pan.pan.setTargetAtTime(pt2.pan, now, 0.012);
      c.send.gain.setTargetAtTime(pt2.send * 0.9, now, 0.012);
    });
    eng.out.gain.setTargetAtTime(master, now, 0.012);
    eng.fb.gain.setTargetAtTime(dlyFb * 0.75, now, 0.02);
    eng.dly.delayTime.setTargetAtTime(Math.min(1.9, (60 / bpm / 4) * dlyTime), now, 0.06);
  }, [parts, master, dlyFb, dlyTime, bpm]);

  useEffect(() => {
    if (!playing) return;
    const eng = ensure();
    if (!eng) return;
    const ctx = eng.ctx;
    let next = ctx.currentTime + 0.08;
    let step = 0;
    const queue: [number, number][] = [];

    const id = window.setInterval(() => {
      const s = snapRef.current;
      const sd = 60 / s.bpm / 4;
      while (next < ctx.currentTime + 0.12) {
        const off = step % 2 === 1 ? s.swing * sd * 0.5 : 0;
        scheduleStep(ctx, eng.chains, s, step, next + off);
        queue.push([step, next + off]);
        next += sd;
        step = (step + 1) % 16;
      }
    }, 25);

    let raf: number;
    const draw = () => {
      let cur: number | null = null;
      while (queue.length && queue[0][1] <= ctx.currentTime) cur = queue.shift()![0];
      if (cur !== null) setUiStep(cur);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      window.clearInterval(id);
      cancelAnimationFrame(raf);
      setUiStep(-1);
    };
  }, [playing, ensure]);

  useEffect(() => () => { if (result?.url) URL.revokeObjectURL(result.url); }, [result]);

  const setParam = (k: keyof Part, v: number) => {
    setParts((ps) => {
      const n = ps.map((x) => ({ ...x }));
      if (k === "pitch" && snap && n[sel].osc !== "noise") v = snapHz(v);
      n[sel] = { ...n[sel], [k]: v };
      return n;
    });
  };

  const audition = (i = sel) => {
    const eng = ensure();
    if (!eng) return;
    triggerVoice(eng.ctx, eng.chains[i], snapRef.current.parts[i], eng.ctx.currentTime + 0.02, true);
  };

  const cycleStep = (row: number, col: number) => {
    setSteps((st) => {
      const n = st.map((r) => [...r]);
      n[row][col] = (n[row][col] + 1) % 3;
      return n;
    });
    if (!playing && steps[row][col] === 0) audition(row);
  };

  const diceVoice = () => {
    const v = randomizeVoice(parts[sel].name, snap);
    setParts((ps) => ps.map((x, i) => (i === sel ? v : x)));
    setTimeout(() => audition(sel), 30);
  };

  const dicePattern = () => setSteps(randomizePattern());

  const clearRow = () => setSteps((st) => st.map((r, i) => (i === sel ? r.map(() => 0) : r)));

  const doBounce = async () => {
    const OC = window.OfflineAudioContext || (window as typeof window & { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext;
    if (!OC) { setStatus("This browser can't render offline audio."); return; }
    setStatus("Rendering…");
    if (result?.url) URL.revokeObjectURL(result.url);
    setResult(null);
    try {
      const s = snapRef.current;
      const sr = 44100;
      const sd = 60 / s.bpm / 4;
      const loopLen = bars * 16 * sd;
      const tailLen = 2.2;
      const ctx = new OC(2, Math.ceil((loopLen + tailLen) * sr), sr);
      const g = buildGraph(ctx, s);

      for (let b = 0; b < bars; b++) {
        for (let st = 0; st < 16; st++) {
          const base = (b * 16 + st) * sd;
          const off = st % 2 === 1 ? s.swing * sd * 0.5 : 0;
          scheduleStep(ctx, g.chains, s, st, base + off);
        }
      }

      const rendered = await ctx.startRendering();
      const n = Math.round(loopLen * sr);
      const wrap = Math.min(rendered.length - n, n);
      const chans: Float32Array[] = [];
      let peak = 0;
      for (let c = 0; c < 2; c++) {
        const src = rendered.getChannelData(c);
        const dst = new Float32Array(n);
        for (let i = 0; i < n; i++) dst[i] = src[i];
        for (let i = 0; i < wrap; i++) dst[i] += src[n + i];
        for (let i = 0; i < n; i++) { const a = Math.abs(dst[i]); if (a > peak) peak = a; }
        chans.push(dst);
      }
      const trim = peak > 0.995 ? 0.995 / peak : 1;
      const wav = encodeWav(chans, sr, trim);
      const blob = new Blob([wav], { type: "audio/wav" });
      const name = `erd-${Math.round(bpm)}bpm-${bars}bar.wav`;
      const url = URL.createObjectURL(blob);
      const dbfs = 20 * Math.log10(Math.max(peak * trim, 1e-6));
      setResult({
        url, name,
        size: (blob.size / 1048576).toFixed(2),
        dur: loopLen.toFixed(2),
        peak: dbfs.toFixed(1),
      });
      setStatus("");

      const file = new File([blob], name, { type: "audio/wav" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], title: name }); } catch { /* dismissed */ }
      }
    } catch (err) {
      setStatus("Render failed: " + (err instanceof Error ? err.message : "unknown error") + ". Try fewer bars.");
    }
  };

  const bpmDrag = useRef<{ y: number; v: number } | null>(null);
  const bpmDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    bpmDrag.current = { y: e.clientY, v: bpm };
  };
  const bpmMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!bpmDrag.current) return;
    const dy = bpmDrag.current.y - e.clientY;
    setBpm(Math.max(40, Math.min(240, Math.round(bpmDrag.current.v + dy / 3))));
  };
  const bpmUp = (e: ReactPointerEvent<HTMLDivElement>) => { bpmDrag.current = null; e.currentTarget.releasePointerCapture?.(e.pointerId); };

  const css = useMemo(() => STYLES, []);
  const total = steps.reduce((a, r) => a + r.filter(Boolean).length, 0);

  return (
    <main className="erd">
      <style>{css}</style>

      <header className="erd-masthead">
        <div>
          <span className="erd-plate">MZ–03</span>
          <h1>ER·D</h1>
          <p>SIX VOICES · ONE DECAY EACH · D PHRYGIAN</p>
        </div>
        <div className="erd-transport" aria-label="Transport controls">
          <button
            className={"erd-play" + (playing ? " on" : "")}
            onClick={() => { ensure(); setPlaying((v) => !v); }}
            aria-label={playing ? "Stop" : "Run"}
          >
            <span className="erd-play-icon">{playing ? "■" : "▶"}</span>{playing ? "STOP" : "RUN"}
          </button>
          <div className="erd-bpmgroup">
            <button className="erd-stepbtn" onClick={() => setBpm((v) => Math.max(40, v - 1))} aria-label="Slower">–</button>
            <div className="erd-tempo">
              <span>TEMPO / BPM</span>
              <div
                className="erd-bpmval"
                role="slider"
                tabIndex={0}
                aria-label="Tempo"
                aria-valuenow={bpm}
                aria-valuemin={40}
                aria-valuemax={240}
                onPointerDown={bpmDown}
                onPointerMove={bpmMove}
                onPointerUp={bpmUp}
                onPointerCancel={bpmUp}
                onKeyDown={(e) => { if (e.key === "ArrowUp") setBpm((v) => Math.min(240, v + 1)); if (e.key === "ArrowDown") setBpm((v) => Math.max(40, v - 1)); }}
              >
                {String(bpm).padStart(3, "0")}
              </div>
            </div>
            <button className="erd-stepbtn" onClick={() => setBpm((v) => Math.min(240, v + 1))} aria-label="Faster">+</button>
          </div>
          <div className="erd-swing"><Knob label="SWING" value={swing} spec={SPEC.swing} dflt={0} onChange={setSwing} format={fmtPct} size={46} /></div>
        </div>
      </header>

      {/* SEQUENCE */}
      <section className="erd-section">
        <div className="erd-module-title"><span>01</span><div><h2>SEQUENCE</h2><p>16-STEP PATTERN / SIX VOICES</p></div><i>SEQ</i></div>
        <div className="erd-acts">
          <button className="erd-chip" onClick={dicePattern}>ROLL PATTERN</button>
          <button className="erd-chip" onClick={clearRow}>CLEAR {p.name}</button>
        </div>

        <div className="erd-seqrow erd-ruler">
          <div /><div />
          <div className="erd-grid">
            {Array.from({ length: 16 }, (_, i) => (
              <div key={i} className="erd-tick" style={{ gridColumn: i + 1 }}>{i % 4 === 0 ? i / 4 + 1 : "·"}</div>
            ))}
          </div>
        </div>

        {parts.map((pt2, row) => {
          const spanN = Math.max(1, Math.min(16, Math.ceil(pt2.decay / stepDur)));
          return (
            <div key={row} className={"erd-seqrow" + (row === sel ? " is-sel" : "")}>
              <button className={"erd-rowname" + (row === sel ? " on" : "")} onClick={() => { setSel(row); audition(row); }}>
                {pt2.name}
              </button>
              <button className={"erd-mute" + (mutes[row] ? " on" : "")}
                      onClick={() => setMutes((m) => m.map((x, i) => (i === row ? !x : x)))}
                      aria-label={`Mute ${pt2.name}`}>
                {mutes[row] ? "MUTE" : "•"}
              </button>
              <div className="erd-grid" style={{ opacity: mutes[row] ? 0.35 : 1 }}>
                {steps[row].map((v, col) =>
                  v ? (
                    <div key={"t" + col} className={"erd-tail" + (v === 2 ? " acc" : "")}
                         style={{ gridColumn: `${col + 1} / span ${Math.min(spanN, 16 - col)}`, gridRow: 1 }} />
                  ) : null
                )}
                {steps[row].map((v, col) => (
                  <button key={col}
                    className={"erd-cell" + (col % 4 === 0 ? " beat" : "") + (v === 1 ? " on" : "") + (v === 2 ? " accent" : "") + (uiStep === col ? " head" : "")}
                    style={{ gridColumn: col + 1, gridRow: 1 }}
                    onClick={() => cycleStep(row, col)}
                    aria-label={`${pt2.name} step ${col + 1}: ${v === 2 ? "accent" : v === 1 ? "on" : "off"}`} />
                ))}
              </div>
            </div>
          );
        })}
        <p className="erd-hint">Tap a step to cycle <b>on → accent → off</b>. The trace behind each hit is its decay.</p>
      </section>

      {/* VOICE */}
      <section className="erd-section">
        <div className="erd-module-title"><span>02</span><div><h2>VOICE</h2><p>SOURCE, MODULATOR &amp; ENVELOPE</p></div><i>VCE</i></div>
        <div className="erd-acts">
          <button className={"erd-chip" + (snap ? " on" : "")} onClick={() => setSnap((v) => !v)}>SNAP TO SCALE</button>
          <button className="erd-chip" onClick={diceVoice}>ROLL {p.name}</button>
        </div>

        <div className="erd-tabs">
          {parts.map((pt2, i) => (
            <button key={i} className={"erd-tab" + (i === sel ? " on" : "")} onClick={() => { setSel(i); audition(i); }}>
              {pt2.name}
            </button>
          ))}
        </div>

        <div className="erd-selectors">
          <div className="erd-segwrap">
            <div className="erd-seglabel">Source</div>
            <div className="erd-seg">
              {OSCS.map((o) => (
                <button key={o} className={"erd-segbtn" + (p.osc === o ? " on" : "")}
                        onClick={() => { setParts((ps) => ps.map((x, i) => (i === sel ? { ...x, osc: o } : x))); setTimeout(() => audition(sel), 20); }}>
                  {OSC_LABEL[o]}
                </button>
              ))}
            </div>
          </div>
          <div className="erd-segwrap">
            <div className="erd-seglabel">Modulator</div>
            <div className="erd-seg">
              {MODS.map((m) => (
                <button key={m} className={"erd-segbtn" + (p.mod === m ? " on" : "")}
                        onClick={() => { setParts((ps) => ps.map((x, i) => (i === sel ? { ...x, mod: m } : x))); setTimeout(() => audition(sel), 20); }}>
                  {MOD_LABEL[m]}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="erd-knobs">
          <Knob label="PITCH" value={p.pitch} spec={SPEC.pitch} onChange={(v) => setParam("pitch", v)} onRelease={() => audition()} format={(v) => fmtPitch(v, p.osc)} />
          <Knob label="BEND"  value={p.bend}  spec={SPEC.bend}  dflt={0} onChange={(v) => setParam("bend", v)} onRelease={() => audition()} format={fmtBend} />
          <Knob label="DECAY" value={p.decay} spec={SPEC.decay} onChange={(v) => setParam("decay", v)} onRelease={() => audition()} format={fmtMs} />
          <Knob label="LEVEL" value={p.level} spec={SPEC.level} dflt={0.8} onChange={(v) => setParam("level", v)} onRelease={() => audition()} format={fmtPct} />
          <Knob label="M·SPD" value={p.modSpeed} spec={SPEC.modSpeed} onChange={(v) => setParam("modSpeed", v)} onRelease={() => audition()} format={fmtHz} />
          <Knob label="M·DEP" value={p.modDepth} spec={SPEC.modDepth} dflt={0} onChange={(v) => setParam("modDepth", v)} onRelease={() => audition()} format={fmtPct} />
          <Knob label="LOW"   value={p.low}   spec={SPEC.low}   dflt={0} onChange={(v) => setParam("low", v)} onRelease={() => audition()} format={fmtPct} />
          <Knob label="PAN"   value={p.pan}   spec={SPEC.pan}   dflt={0} onChange={(v) => setParam("pan", v)} onRelease={() => audition()} format={fmtPan} />
        </div>
      </section>

      {/* MACHINE */}
      <section className="erd-section">
        <div className="erd-module-title"><span>03</span><div><h2>MACHINE</h2><p>SEND, DELAY &amp; MASTER</p></div><i>MCH</i></div>
        <div className="erd-knobs four">
          <Knob label="SEND" value={p.send} spec={SPEC.send} dflt={0} onChange={(v) => setParam("send", v)} onRelease={() => audition()} format={fmtPct} size={48} />
          <Knob label="DLY·T" value={dlyTime} spec={SPEC.dlyTime} onChange={(v) => setDlyTime(Math.round(v))} format={(v) => Math.round(v) + "/16"} size={48} />
          <Knob label="DLY·FB" value={dlyFb} spec={SPEC.dlyFb} dflt={0.3} onChange={setDlyFb} format={fmtPct} size={48} />
          <Knob label="MASTER" value={master} spec={SPEC.master} dflt={0.85} onChange={setMaster} format={fmtPct} size={48} />
        </div>
        <p className="erd-hint"><b>SEND</b> feeds {p.name} into the delay. Delay time follows the tempo.</p>
      </section>

      {/* BOUNCE */}
      <section className="erd-section erd-section--last">
        <div className="erd-module-title"><span>04</span><div><h2>BOUNCE</h2><p>OFFLINE RENDER &amp; EXPORT</p></div><i>WAV</i></div>
        <div className="erd-bounce">
          <div className="erd-seg erd-bars">
            {[1, 2, 4].map((b) => (
              <button key={b} className={"erd-segbtn" + (bars === b ? " on" : "")} onClick={() => setBars(b)}>{b} BAR{b > 1 ? "S" : ""}</button>
            ))}
          </div>
          <button className="erd-bigbtn" onClick={doBounce} disabled={status === "Rendering…" || total === 0}>
            {status === "Rendering…" ? "RENDERING…" : "BOUNCE LOOP"}
          </button>
        </div>

        {total === 0 && <p className="erd-hint">Nothing scheduled yet. Tap the grid, then bounce.</p>}
        {status && status !== "Rendering…" && <p className="erd-err">{status}</p>}

        {result && (
          <div className="erd-result">
            <div className="erd-readout">
              <span><b>DURATION</b>{result.dur}s</span>
              <span><b>SIZE</b>{result.size} MB</span>
              <span><b>PEAK</b>{result.peak} dBFS</span>
              <span><b>FORMAT</b>44.1k · 16-bit</span>
            </div>
            <audio controls src={result.url} className="erd-aud" />
            <a className="erd-bigbtn" href={result.url} download={result.name}>SAVE {result.name}</a>
            <p className="erd-hint">The decay tail is folded back onto the head, so the file loops without a seam.</p>
          </div>
        )}
      </section>

      <footer className="erd-foot">
        <span>ER·D SIGNAL LABORATORY</span>
        <span>ONE OSC · ONE MOD · ONE DECAY PER VOICE</span>
        <span>FIELD UNIT № 03</span>
      </footer>
    </main>
  );
}

/* ============================================================
   STYLES — Field Specimen tokens (bone paper / ink / acid signal)
   ============================================================ */
const STYLES = `
/* This page is intentionally self-contained: every rule below is scoped
   under erd-* classes (or the .erd root) rather than the bare/shared
   selectors in globals.css, since this repo may have more than one
   instrument route mutating that shared stylesheet concurrently. */
.erd{ width:min(100%, 720px); min-height:100vh; margin:0 auto; padding:24px 20px 20px; box-sizing:border-box; }
.erd *{ box-sizing:border-box; }

.erd-masthead{ display:flex; align-items:flex-end; justify-content:space-between; gap:16px;
  border-top:2px solid var(--ink); border-bottom:2px solid var(--ink); padding:12px 0 14px; }
.erd-masthead > div:first-child{ display:grid; grid-template-columns:auto auto; column-gap:14px; align-items:end; }
.erd-plate{ grid-row:1/3; align-self:stretch; writing-mode:vertical-rl; transform:rotate(180deg);
  background:var(--ink); color:var(--paper); font:700 10px/1 monospace; padding:7px 6px; letter-spacing:1px; }
.erd-masthead h1{ margin:0; font-size:clamp(44px,6vw,80px); letter-spacing:-.075em; line-height:.72; font-weight:900; }
.erd-masthead p{ margin:8px 0 0 4px; font:700 10px/1 monospace; letter-spacing:.16em; }

.erd-module-title{ display:grid; grid-template-columns:28px 1fr auto; align-items:start; border-bottom:1px solid var(--line); padding-bottom:8px; margin-bottom:14px; }
.erd-module-title > span{ background:var(--acid); width:22px; height:22px; display:grid; place-items:center; border:1px solid var(--ink); font:800 8px monospace; }
.erd-module-title h2{ font-size:17px; line-height:1; margin:0; letter-spacing:-.03em; }
.erd-module-title p{ font:700 7px monospace; color:var(--muted); margin:4px 0 0; letter-spacing:.1em; }
.erd-module-title i{ font:700 8px monospace; font-style:normal; color:var(--muted); }

.erd-foot{ display:flex; justify-content:space-between; padding-top:8px; font:700 7px monospace; color:var(--muted); letter-spacing:.08em; flex-wrap:wrap; gap:4px; }

.erd-transport{ display:flex; flex-wrap:wrap; align-items:center; gap:10px; }
.erd-play{ min-width:104px; min-height:52px; border:1.5px solid var(--ink); background:transparent; color:var(--ink);
  padding:7px 14px; font:700 10px/1 monospace; display:flex; align-items:center; justify-content:center; gap:8px;
  letter-spacing:.08em; transition:.15s; }
.erd-play:hover, .erd-play.on{ background:var(--acid); }
.erd-play-icon{ font-size:13px; }
.erd-bpmgroup{ display:flex; align-items:stretch; gap:6px; }
.erd-stepbtn{ min-width:44px; min-height:44px; border:1.5px solid var(--ink); background:transparent; color:var(--ink); font:700 16px/1 monospace; }
.erd-stepbtn:hover{ background:var(--acid); }
.erd-tempo{ min-width:104px; display:flex; flex-direction:column; align-items:flex-start; justify-content:center;
  border:1.5px solid var(--ink); padding:7px 12px; }
.erd-tempo > span{ font-size:8px; color:var(--muted); font:700 8px/1 monospace; letter-spacing:.08em; }
.erd-bpmval{ font:800 20px/1 monospace; letter-spacing:.02em; touch-action:none; user-select:none; cursor:ns-resize;
  border-bottom:1px dashed var(--line); padding:2px 0; }
.erd-bpmval:focus-visible{ outline:3px solid var(--acid); outline-offset:2px; }
.erd-swing{ align-self:center; }

.erd-section{ padding:16px 0; border-bottom:1.5px solid var(--ink); }
.erd-section--last{ border-bottom:2px solid var(--ink); }
.erd-acts{ display:flex; gap:6px; flex-wrap:wrap; justify-content:flex-end; margin:0 0 14px; }

.erd-chip{ min-height:36px; font:800 8.5px/1 monospace; letter-spacing:.08em; text-transform:uppercase;
  padding:8px 10px; border:1px solid var(--ink); background:transparent; color:var(--ink); }
.erd-chip:hover{ background:var(--paper-light); }
.erd-chip.on{ background:var(--acid); }

/* sequence grid */
.erd-seqrow{ display:grid; grid-template-columns:52px 40px 1fr; align-items:center; gap:5px; margin-bottom:3px; }
.erd-ruler{ margin-bottom:6px; }
.erd-grid{ display:grid; grid-template-columns:repeat(16,1fr); gap:2px; position:relative; height:30px; }
.erd-ruler .erd-grid{ height:11px; }
.erd-tick{ grid-row:1; font:700 7.5px/11px monospace; color:var(--muted); text-align:center; }
.erd-rowname{ font:800 9.5px/1 monospace; letter-spacing:.06em; padding:8px 2px; border:1px solid var(--ink);
  background:transparent; color:var(--ink); text-align:center; }
.erd-rowname.on{ background:var(--acid); }
.erd-mute{ font:700 8px/1 monospace; letter-spacing:.04em; border:1px solid var(--line); background:transparent; color:var(--muted); min-height:30px; }
.erd-mute.on{ background:var(--ink); color:var(--paper); border-color:var(--ink); }
.erd-cell{ position:relative; border:1px solid var(--line); border-radius:0; background:transparent;
  padding:0; min-height:30px; z-index:2; touch-action:manipulation; }
.erd-cell.beat{ border-color:var(--ink); }
.erd-cell.on, .erd-cell.accent{ background:var(--acid); border-color:var(--ink); }
.erd-cell.accent:after{ content:"!"; position:absolute; right:3px; bottom:0; font:900 11px/1 monospace; color:var(--ink); }
.erd-cell.head{ box-shadow:inset 0 0 0 3px var(--ink); }
.erd-tail{ z-index:1; align-self:center; height:8px; background:linear-gradient(90deg, rgba(29,29,27,.35) 0%, rgba(29,29,27,0) 100%); }
.erd-tail.acc{ background:linear-gradient(90deg, rgba(29,29,27,.5) 0%, rgba(29,29,27,0) 100%); }
.erd-seqrow.is-sel .erd-tail{ background:linear-gradient(90deg, rgba(180,166,0,.55) 0%, rgba(180,166,0,0) 100%); }

.erd-hint{ font:700 9px/1.6 monospace; color:var(--muted); margin:9px 2px 0; letter-spacing:.02em; }
.erd-hint b{ color:var(--ink); }
.erd-err{ font:700 9.5px/1.5 monospace; color:var(--danger); margin:9px 2px 0; }

/* voice */
.erd-tabs{ display:grid; grid-template-columns:repeat(6,1fr); gap:4px; margin-bottom:12px; }
.erd-tab{ min-height:44px; font:800 9.5px/1 monospace; letter-spacing:.06em; padding:9px 0; border:1px solid var(--ink);
  background:transparent; color:var(--muted); }
.erd-tab.on{ color:var(--ink); background:var(--acid); font-weight:900; }
.erd-selectors{ display:flex; flex-direction:column; gap:10px; margin-bottom:14px; }
.erd-seglabel{ font:700 7.5px/1 monospace; letter-spacing:.2em; text-transform:uppercase; color:var(--muted); margin-bottom:4px; }
.erd-seg{ display:flex; border:1px solid var(--ink); }
.erd-segbtn{ flex:1; min-height:44px; font:800 8.5px/1 monospace; letter-spacing:.06em; padding:8px 2px; border:0;
  border-right:1px solid var(--ink); background:transparent; color:var(--ink); }
.erd-segbtn:last-child{ border-right:0; }
.erd-segbtn.on{ background:var(--acid); font-weight:900; }

/* knobs */
.erd-knobs{ display:grid; grid-template-columns:repeat(4,1fr); gap:14px 6px; }
.erd-knobwrap{ display:flex; flex-direction:column; align-items:center; gap:3px; }
.erd-knob{ touch-action:none; user-select:none; cursor:ns-resize; border-radius:50%; display:block; }
.erd-knob:focus-visible{ outline:3px solid var(--acid); outline-offset:2px; }
.erd-kbody{ fill:var(--paper-light); stroke:var(--ink); stroke-width:1.5; }
.erd-ktrack{ fill:none; stroke:var(--line); stroke-width:2.5; stroke-linecap:round; }
.erd-ktick{ stroke:var(--ink); stroke-width:1.5; }
.erd-kval{ fill:none; stroke:var(--acid); stroke-width:2.5; stroke-linecap:round; }
.erd-kptr{ stroke:var(--ink); stroke-width:1.8; stroke-linecap:round; }
.erd-kdot{ fill:var(--ink); }
.erd-klabel{ font:700 7px/1 monospace; letter-spacing:.16em; color:var(--muted); }
.erd-kval-text{ font:800 9.5px/1 monospace; letter-spacing:.02em; color:var(--ink); }

/* bounce */
.erd-bounce{ display:flex; flex-direction:column; gap:10px; }
.erd-bars .erd-segbtn{ font-size:9px; }
.erd-bigbtn{ display:block; width:100%; text-align:center; min-height:48px; padding:14px; border:1.5px solid var(--ink);
  background:transparent; color:var(--ink); font:800 10.5px/1 monospace; letter-spacing:.16em; text-transform:uppercase;
  text-decoration:none; }
.erd-bigbtn:hover:not(:disabled){ background:var(--acid); }
.erd-bigbtn:disabled{ opacity:.35; border-color:var(--line); color:var(--muted); cursor:not-allowed; }
.erd-result{ margin-top:12px; display:flex; flex-direction:column; gap:9px; }
.erd-readout{ display:flex; flex-wrap:wrap; border:1px solid var(--ink); }
.erd-readout span{ padding:7px 10px; border-right:1px solid var(--line); font:700 9px/1 monospace; color:var(--ink); }
.erd-readout span:last-child{ border-right:0; }
.erd-readout b{ display:block; color:var(--muted); font-size:7px; margin-bottom:3px; letter-spacing:.08em; }
.erd-aud{ width:100%; height:34px; }

@media (max-width:900px){
  .erd-ruler{ display:none; }
  .erd-grid{ grid-template-columns:repeat(8,1fr); }
}
@media (max-width:520px){
  .erd-seqrow{ grid-template-columns:44px 32px 1fr; gap:3px; }
  .erd-grid{ grid-template-columns:repeat(4,1fr); }
  .erd-tabs{ grid-template-columns:repeat(3,1fr); }
  .erd-knobs{ grid-template-columns:repeat(3,1fr); }
}
@media (prefers-reduced-motion:reduce){
  .erd *{ transition:none !important; animation:none !important; }
}
`;
