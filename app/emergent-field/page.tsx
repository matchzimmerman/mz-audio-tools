"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EmergentFieldEngine, STREAMS, type EmergentParams, type ModeName } from "../emergent-field-engine";

const ROOTS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const MODES: Array<{ value: ModeName; label: string }> = [
  { value: "dorian", label: "DORIAN" },
  { value: "aeolian", label: "AEOLIAN" },
  { value: "minorPent", label: "MINOR PENT" },
  { value: "majorPent", label: "MAJOR PENT" },
  { value: "open", label: "OPEN" },
];

const DEFAULTS: EmergentParams = {
  density: .55,
  entropy: .48,
  energy: .58,
  motion: .45,
  spread: .78,
  selfMix: .82,
  space: .32,
  output: .58,
  bpm: 84,
  root: 0,
  mode: "dorian",
};

const EMPTY = { running: false, levels: [0, 0, 0, 0, 0, 0], pans: [0, 0, 0, 0, 0, 0], ducks: [0, 0, 0, 0, 0, 0], pressure: 0, adaptiveDensity: .55, bpm: 84, sceneProgress: 0 };

export default function EmergentFieldPage() {
  const engineRef = useRef<EmergentFieldEngine | null>(null);
  const [running, setRunning] = useState(false);
  const [params, setParams] = useState<EmergentParams>(DEFAULTS);
  const [telemetry, setTelemetry] = useState(EMPTY);
  const [status, setStatus] = useState("READY / PRESS START FIELD");

  useEffect(() => {
    const engine = new EmergentFieldEngine();
    engineRef.current = engine;
    engine.setParams(params);
    return () => { engine.destroy(); engineRef.current = null; };
    // Params are pushed through the dedicated effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { engineRef.current?.setParams(params); }, [params]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const next = engineRef.current?.getTelemetry();
      if (next) setTelemetry(next);
    }, 90);
    return () => window.clearInterval(timer);
  }, []);

  const set = useCallback(<K extends keyof EmergentParams>(key: K, value: EmergentParams[K]) => {
    setParams((previous) => ({ ...previous, [key]: value }));
  }, []);

  const toggle = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine) return;
    if (running) {
      engine.stop();
      setRunning(false);
      setStatus("PAUSED / FIELD STATE HELD");
      return;
    }
    try {
      await engine.start();
      setRunning(true);
      setStatus("LIVE / SIX STREAMS NEGOTIATING MIX");
    } catch (error) {
      setStatus(error instanceof Error ? `AUDIO ERROR / ${error.message}` : "AUDIO ERROR");
    }
  }, [running]);

  const mutate = () => {
    engineRef.current?.mutate();
    setStatus("FIELD MUTATED / NEW SECTION TARGETS LOADED");
  };

  const active = useMemo(() => telemetry.levels.filter((level) => level > .045).length, [telemetry.levels]);

  return (
    <main className="ef-app">
      <style>{STYLES}</style>

      <header className="ef-masthead">
        <div className="ef-plate">MZ–08</div>
        <div className="ef-title">
          <h1>EMERGENT FIELD</h1>
          <p>GENERATIVE / DYNAMIC / ADAPTIVE AUDIO SYSTEM</p>
        </div>
        <div className="ef-brand">MZ SONIC LAB<br />MATCH ZIMMERMAN CREATIVE MEDIA GROUP</div>
      </header>

      <section className="ef-transport">
        <button className="ef-start" type="button" aria-pressed={running} onClick={toggle}>{running ? "PAUSE FIELD" : "START FIELD"}</button>
        <button className="ef-mutate" type="button" onClick={mutate}>MUTATE FIELD</button>
        <label className="ef-tempo"><span>TEMPO</span><input type="range" min="44" max="164" step="1" value={params.bpm} onChange={(e) => set("bpm", Number(e.target.value))} /><b>{params.bpm} BPM</b></label>
        <label className="ef-main"><span>MAIN</span><input type="range" min="0" max="1" step=".01" value={params.output} onChange={(e) => set("output", Number(e.target.value))} /><b>{Math.round(params.output * 100)}%</b></label>
      </section>

      <div className="ef-status" role="status"><i className={running ? "on" : ""} />{status}</div>

      <section className="ef-register">
        <Register label="CLOCK" value={`${telemetry.bpm} BPM / FREE`} />
        <Register label="FIELD PRESSURE" value={`${Math.round(telemetry.pressure * 100)}%`} bar={telemetry.pressure} />
        <Register label="ADAPTIVE DENSITY" value={`${Math.round(telemetry.adaptiveDensity * 100)}%`} bar={telemetry.adaptiveDensity} />
        <Register label="ACTIVE STREAMS" value={`${active} / 6`} />
        <Register label="SECTION" value={`${Math.round(telemetry.sceneProgress * 100)}%`} bar={telemetry.sceneProgress} />
      </section>

      <section className="ef-module ef-field">
        <ModuleHead index="01" title="STREAM FIELD" note="LIVE MIX ECOLOGY / INTERNAL SIDECHAIN NEGOTIATION" code="FLD" />
        <div className="ef-streams">
          {STREAMS.map((stream, i) => <StreamStrip key={stream.id} index={i} name={stream.name} role={stream.role} band={stream.band} level={telemetry.levels[i] ?? 0} pan={telemetry.pans[i] ?? 0} duck={telemetry.ducks[i] ?? 0} />)}
        </div>
      </section>

      <section className="ef-modules">
        <div className="ef-module">
          <ModuleHead index="02" title="GENERATION" note="HOW MUCH MATERIAL THE FIELD PRODUCES" code="GEN" />
          <Control label="DENSITY" value={params.density} onChange={(v) => set("density", v)} detail="event probability" />
          <Control label="ENTROPY" value={params.entropy} onChange={(v) => set("entropy", v)} detail="variation + instability" />
          <Control label="ENERGY" value={params.energy} onChange={(v) => set("energy", v)} detail="amplitude + section intensity" />
        </div>

        <div className="ef-module">
          <ModuleHead index="03" title="MOTION" note="AUTOMATED STEREO FIELD" code="MOV" />
          <Control label="MOTION" value={params.motion} onChange={(v) => set("motion", v)} detail="pan drift + retarget rate" />
          <Control label="SPREAD" value={params.spread} onChange={(v) => set("spread", v)} detail="maximum stereo width" />
          <div className="ef-note">Streams actively choose positions that avoid competing spectral neighbors. Foundation remains near center while Grain + Air can occupy the edges.</div>
        </div>

        <div className="ef-module">
          <ModuleHead index="04" title="MIX INTELLIGENCE" note="COMPOSITION + MIXING AS ONE SYSTEM" code="MIX" />
          <Control label="SELF MIX" value={params.selfMix} onChange={(v) => set("selfMix", v)} detail="ducking + density adaptation" />
          <Control label="SPACE" value={params.space} onChange={(v) => set("space", v)} detail="shared ambience field" />
          <div className="ef-note">As pressure rises, streams duck by spectral role and the generator reduces future event density instead of only compressing the summed result.</div>
        </div>

        <div className="ef-module">
          <ModuleHead index="05" title="HARMONIC FIELD" note="TONAL GRAVITY / NOT A FIXED SEQUENCE" code="HRM" />
          <div className="ef-selects">
            <label><span>ROOT</span><select value={params.root} onChange={(e) => set("root", Number(e.target.value))}>{ROOTS.map((root, i) => <option value={i} key={root}>{root}</option>)}</select></label>
            <label><span>MODE</span><select value={params.mode} onChange={(e) => set("mode", e.target.value as ModeName)}>{MODES.map((mode) => <option value={mode.value} key={mode.value}>{mode.label}</option>)}</select></label>
          </div>
          <div className="ef-note">Pitch is selected from a shared scale field while each stream occupies a different register and rhythmic behavior.</div>
        </div>
      </section>

      <section className="ef-explain">
        <b>WHAT IS HAPPENING?</b>
        <p>Six internal streams generate independently but listen to the same evolving section state. Their spectral roles, activity, stereo position, and priority are continuously compared. When the field becomes crowded, the system creates room by ducking collisions, moving voices apart, and lowering the probability of new events.</p>
      </section>

      <footer className="ef-footer"><span>MZCMG + MATCH ZIMMERMAN CREATIVE MEDIA GROUP</span><span>WEB AUDIO PROTOTYPE / MZ SONIC LAB</span><Link href="/">← FIELD STATION INDEX</Link></footer>
    </main>
  );
}

function Register({ label, value, bar }: { label: string; value: string; bar?: number }) {
  return <div className="ef-reg"><span>{label}</span><b>{value}</b>{bar !== undefined && <i><em style={{ width: `${Math.max(1, bar * 100)}%` }} /></i>}</div>;
}

function ModuleHead({ index, title, note, code }: { index: string; title: string; note: string; code: string }) {
  return <header className="ef-module-head"><span className="ef-index">{index}</span><div><h2>{title}</h2><p>{note}</p></div><b>{code}</b></header>;
}

function Control({ label, value, detail, onChange }: { label: string; value: number; detail: string; onChange: (v: number) => void }) {
  return <label className="ef-control"><span><b>{label}</b><small>{detail}</small></span><input type="range" min="0" max="1" step=".01" value={value} onChange={(e) => onChange(Number(e.target.value))} /><strong>{String(Math.round(value * 100)).padStart(2, "0")}</strong></label>;
}

function StreamStrip({ index, name, role, band, level, pan, duck }: { index: number; name: string; role: string; band: string; level: number; pan: number; duck: number }) {
  return <article className="ef-stream">
    <div className="ef-stream-id"><b>{String(index + 1).padStart(2, "0")}</b><span>{name}</span></div>
    <div className="ef-meter"><i style={{ height: `${Math.max(2, level * 100)}%` }} /></div>
    <div className="ef-pan"><span>L</span><i><em style={{ left: `${50 + pan * 48}%` }} /></i><span>R</span></div>
    <dl><div><dt>ROLE</dt><dd>{role}</dd></div><div><dt>BAND</dt><dd>{band}</dd></div><div><dt>DUCK</dt><dd>{duck > -.1 ? "0.0 DB" : `${duck.toFixed(1)} DB`}</dd></div></dl>
  </article>;
}

const STYLES = `
.ef-app{width:min(100%,1480px);min-height:100vh;margin:0 auto;padding:22px 28px 32px;box-sizing:border-box}.ef-app *{box-sizing:border-box}.ef-app button,.ef-app input,.ef-app select{font:inherit}.ef-masthead{display:grid;grid-template-columns:62px 1fr auto;gap:16px;align-items:end;border-top:2px solid var(--ink);border-bottom:2px solid var(--ink);padding:13px 0 15px}.ef-plate,.ef-index{display:grid;place-items:center;background:var(--acid);border:1px solid var(--ink);font:900 10px/1 monospace;letter-spacing:.04em}.ef-plate{width:62px;height:62px}.ef-title h1{margin:0;font-size:clamp(42px,6vw,88px);font-weight:950;letter-spacing:-.065em;line-height:.78}.ef-title p,.ef-brand,.ef-module-head p,.ef-footer,.ef-status,.ef-control small,.ef-note,.ef-reg span,.ef-stream dl,.ef-stream-id b{font-family:monospace}.ef-title p{margin:10px 0 0;font-size:9px;font-weight:800;letter-spacing:.14em;color:var(--muted)}.ef-brand{text-align:right;font-size:8px;font-weight:800;line-height:1.5;letter-spacing:.08em}.ef-transport{display:grid;grid-template-columns:200px 150px 1fr 1fr;border-bottom:1px solid var(--ink)}.ef-transport button{border:0;border-right:1px solid var(--ink);background:transparent;padding:14px 12px;text-align:left;font-weight:900;font-size:12px;cursor:pointer}.ef-start{background:var(--acid)!important}.ef-mutate:hover,.ef-transport button:focus-visible{background:var(--paper-light)}.ef-tempo,.ef-main{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;padding:8px 12px;border-right:1px solid var(--ink);font:800 8px/1 monospace;letter-spacing:.08em}.ef-main{border-right:0}.ef-tempo input,.ef-main input,.ef-control input{accent-color:var(--ink);width:100%}.ef-status{display:flex;align-items:center;gap:8px;padding:8px 0;font-size:8px;font-weight:800;letter-spacing:.08em;border-bottom:1px solid var(--ink)}.ef-status i{width:8px;height:8px;border:1px solid var(--ink);display:inline-block}.ef-status i.on{background:var(--acid)}.ef-register{display:grid;grid-template-columns:repeat(5,1fr);border-bottom:1.5px solid var(--ink)}.ef-reg{position:relative;min-height:68px;padding:10px;border-right:1px solid var(--ink);overflow:hidden}.ef-reg:last-child{border-right:0}.ef-reg span{display:block;font-size:7px;font-weight:800;letter-spacing:.08em;color:var(--muted)}.ef-reg b{display:block;margin-top:8px;font-size:14px;letter-spacing:-.02em}.ef-reg>i{position:absolute;left:0;right:0;bottom:0;height:5px;background:rgba(0,0,0,.08)}.ef-reg>i em{display:block;height:100%;background:var(--acid);border-right:1px solid var(--ink)}.ef-module{border:1.5px solid var(--ink);border-top:0}.ef-field{border-top:1.5px solid var(--ink);margin-top:20px}.ef-module-head{display:grid;grid-template-columns:34px 1fr auto;gap:10px;align-items:center;min-height:52px;padding:8px;border-bottom:1px solid var(--ink)}.ef-index{width:34px;height:34px}.ef-module-head h2{margin:0;font-size:15px;font-weight:950;letter-spacing:-.025em}.ef-module-head p{margin:3px 0 0;font-size:7px;font-weight:800;letter-spacing:.08em;color:var(--muted)}.ef-module-head>b{font:900 9px/1 monospace;border:1px solid var(--ink);padding:6px}.ef-streams{display:grid;grid-template-columns:repeat(6,1fr)}.ef-stream{padding:12px;border-right:1px solid var(--ink);min-width:0}.ef-stream:last-child{border-right:0}.ef-stream-id{display:flex;gap:8px;align-items:center}.ef-stream-id b{font-size:8px;background:var(--ink);color:var(--paper);padding:4px}.ef-stream-id span{font-size:11px;font-weight:950;letter-spacing:-.02em}.ef-meter{height:118px;border:1px solid var(--ink);margin:12px 0 9px;display:flex;align-items:end;background:linear-gradient(to top,rgba(0,0,0,.04) 1px,transparent 1px);background-size:100% 12.5%}.ef-meter i{display:block;width:100%;min-height:2px;background:var(--acid);border-top:1px solid var(--ink);transition:height .08s linear}.ef-pan{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:5px;font:700 7px/1 monospace}.ef-pan>i{height:9px;border-top:1px solid var(--ink);border-bottom:1px solid var(--ink);position:relative}.ef-pan em{position:absolute;top:-3px;width:5px;height:13px;background:var(--ink);transform:translateX(-50%);transition:left .08s linear}.ef-stream dl{margin:10px 0 0;font-size:6.5px;line-height:1.3}.ef-stream dl div{border-top:1px solid rgba(0,0,0,.22);padding:5px 0}.ef-stream dt{color:var(--muted)}.ef-stream dd{margin:1px 0 0;font-weight:800}.ef-modules{display:grid;grid-template-columns:repeat(2,1fr);margin-top:20px}.ef-modules>.ef-module:nth-child(odd){border-right:0}.ef-modules>.ef-module:nth-child(-n+2){border-top:1.5px solid var(--ink)}.ef-control{display:grid;grid-template-columns:150px 1fr 38px;gap:12px;align-items:center;padding:13px;border-bottom:1px solid rgba(0,0,0,.28)}.ef-control:last-child{border-bottom:0}.ef-control span{display:flex;flex-direction:column;gap:2px}.ef-control b{font-size:10px}.ef-control small{font-size:6px;color:var(--muted);letter-spacing:.05em}.ef-control strong{text-align:right;font:900 10px/1 monospace}.ef-note{font-size:7px;line-height:1.55;letter-spacing:.03em;padding:13px;color:var(--muted)}.ef-selects{display:grid;grid-template-columns:1fr 1fr;gap:0}.ef-selects label{display:grid;grid-template-columns:54px 1fr;align-items:center;padding:14px;border-right:1px solid var(--ink);font:800 8px/1 monospace}.ef-selects label:last-child{border-right:0}.ef-selects select{width:100%;border:1px solid var(--ink);background:var(--paper);border-radius:0;padding:8px;font:800 9px monospace}.ef-explain{display:grid;grid-template-columns:180px 1fr;gap:20px;border-top:1.5px solid var(--ink);border-bottom:1.5px solid var(--ink);margin-top:20px;padding:16px 0}.ef-explain b{font:900 10px/1 monospace}.ef-explain p{margin:0;max-width:980px;font-size:12px;line-height:1.5}.ef-footer{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;padding-top:14px;font-size:7px;font-weight:800;letter-spacing:.07em;color:var(--muted)}.ef-footer a{color:var(--ink);text-decoration:none}
@media(max-width:980px){.ef-masthead{grid-template-columns:48px 1fr}.ef-plate{width:48px;height:48px}.ef-brand{grid-column:1/-1;text-align:left}.ef-transport{grid-template-columns:1fr 1fr}.ef-tempo{border-top:1px solid var(--ink)}.ef-main{border-top:1px solid var(--ink)}.ef-register{grid-template-columns:repeat(3,1fr)}.ef-reg:nth-child(3){border-right:0}.ef-reg:nth-child(n+4){border-top:1px solid var(--ink)}.ef-streams{grid-template-columns:repeat(3,1fr)}.ef-stream:nth-child(3){border-right:0}.ef-stream:nth-child(n+4){border-top:1px solid var(--ink)}.ef-modules{grid-template-columns:1fr}.ef-modules>.ef-module{border-right:1.5px solid var(--ink)!important;border-top:0!important}.ef-modules>.ef-module:first-child{border-top:1.5px solid var(--ink)!important}}
@media(max-width:620px){.ef-app{padding:14px}.ef-title h1{font-size:43px}.ef-transport{grid-template-columns:1fr}.ef-transport>*{border-right:0!important;border-bottom:1px solid var(--ink)}.ef-main{border-bottom:0}.ef-register{grid-template-columns:1fr 1fr}.ef-reg{border-top:1px solid var(--ink)}.ef-reg:nth-child(2n){border-right:0}.ef-reg:nth-child(3){border-right:1px solid var(--ink)}.ef-streams{grid-template-columns:repeat(2,1fr)}.ef-stream:nth-child(3){border-right:1px solid var(--ink)}.ef-stream:nth-child(2n){border-right:0}.ef-stream:nth-child(n+3){border-top:1px solid var(--ink)}.ef-control{grid-template-columns:100px 1fr 30px;gap:8px}.ef-explain{grid-template-columns:1fr;gap:8px}}
@media(prefers-reduced-motion:reduce){.ef-meter i,.ef-pan em{transition:none}}
`;
