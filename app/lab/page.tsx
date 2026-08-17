"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type DeviceType = "audio" | "visual" | "system";
type Device = { id: string; name: string; type: DeviceType; href?: string; hosted?: boolean };

type AudioRig = {
  ctx: AudioContext;
  gull: GainNode;
  direct: GainNode;
  filter: BiquadFilterNode;
  filterSend: GainNode;
  delay: DelayNode;
  feedback: GainNode;
  delaySend: GainNode;
  analyser: AnalyserNode;
  main: GainNode;
};

const DEVICES: Device[] = [
  { id: "01", name: "GULL", type: "audio", hosted: true },
  { id: "02", name: "SERIAL", type: "audio", href: "../serial/" },
  { id: "03", name: "ER·D", type: "audio", href: "../erd/" },
  { id: "04", name: "COASTS", type: "audio", href: "../coasts/" },
  { id: "07", name: "FIELD CHORUS", type: "audio", href: "../field-chorus/" },
  { id: "08", name: "EMERGENT FIELD", type: "audio", href: "../emergent-field/" },
  { id: "05", name: "SPECTRAL PARTICLES", type: "visual", href: "../spectral-particles/" },
  { id: "06", name: "VISUAL ENGINE", type: "visual", href: "../visual-engine/" },
  { id: "RT", name: "ROUTING", type: "system", hosted: true },
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

export default function SonicLabHost() {
  const [active, setActive] = useState("01");
  const [bpm, setBpm] = useState(112);
  const [root, setRoot] = useState(2);
  const [scale, setScale] = useState("DORIAN");
  const [mainLevel, setMainLevel] = useState(.72);
  const [running, setRunning] = useState(false);
  const [directOn, setDirectOn] = useState(true);
  const [filterOn, setFilterOn] = useState(false);
  const [delayOn, setDelayOn] = useState(false);
  const [visualOn, setVisualOn] = useState(true);
  const [cutoff, setCutoff] = useState(1800);
  const [delayTime, setDelayTime] = useState(.28);
  const [status, setStatus] = useState("HOST READY / GULL ADAPTER ONLINE");
  const rigRef = useRef<AudioRig | null>(null);
  const timerRef = useRef<number | null>(null);
  const stepRef = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const selected = useMemo(() => DEVICES.find((d) => d.id === active) ?? DEVICES[0], [active]);

  const ensureRig = useCallback(async () => {
    if (!rigRef.current) {
      const Ctx = window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      const gull = ctx.createGain();
      const direct = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      const filterSend = ctx.createGain();
      const delay = ctx.createDelay(2);
      const feedback = ctx.createGain();
      const delaySend = ctx.createGain();
      const analyser = ctx.createAnalyser();
      const main = ctx.createGain();

      gull.gain.value = .8;
      filter.type = "lowpass";
      filter.frequency.value = cutoff;
      filter.Q.value = 1.2;
      delay.delayTime.value = delayTime;
      feedback.gain.value = .34;
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = .78;
      main.gain.value = mainLevel;

      gull.connect(direct).connect(main);
      gull.connect(filter).connect(filterSend).connect(main);
      filter.connect(delay).connect(delaySend).connect(main);
      delay.connect(feedback).connect(delay);
      gull.connect(analyser);
      main.connect(ctx.destination);
      rigRef.current = { ctx, gull, direct, filter, filterSend, delay, feedback, delaySend, analyser, main };
    }
    if (rigRef.current.ctx.state === "suspended") await rigRef.current.ctx.resume();
    return rigRef.current;
  }, [cutoff, delayTime, mainLevel]);

  useEffect(() => {
    const rig = rigRef.current;
    if (!rig) return;
    const now = rig.ctx.currentTime;
    rig.direct.gain.setTargetAtTime(directOn ? 1 : 0, now, .025);
    rig.filterSend.gain.setTargetAtTime(filterOn ? .82 : 0, now, .025);
    rig.delaySend.gain.setTargetAtTime(delayOn ? .7 : 0, now, .025);
    rig.filter.frequency.setTargetAtTime(cutoff, now, .025);
    rig.delay.delayTime.setTargetAtTime(delayTime, now, .025);
    rig.main.gain.setTargetAtTime(mainLevel, now, .025);
  }, [directOn, filterOn, delayOn, cutoff, delayTime, mainLevel]);

  const gullCall = useCallback(async (accent = false) => {
    const rig = await ensureRig();
    const intervals = SCALES[scale];
    const degree = stepRef.current++ % intervals.length;
    const midi = 60 + root + intervals[degree] + (degree > intervals.length * .62 ? 12 : 0);
    const now = rig.ctx.currentTime;
    const osc = rig.ctx.createOscillator();
    const harmonic = rig.ctx.createOscillator();
    const amp = rig.ctx.createGain();
    const pan = rig.ctx.createStereoPanner();
    const flutter = rig.ctx.createOscillator();
    const flutterDepth = rig.ctx.createGain();
    osc.type = "triangle";
    harmonic.type = "sine";
    osc.frequency.value = midiToHz(midi);
    harmonic.frequency.value = midiToHz(midi) * 2.01;
    harmonic.detune.value = Math.random() * 14 - 7;
    flutter.frequency.value = 7 + Math.random() * 9;
    flutterDepth.gain.value = 6 + Math.random() * 18;
    flutter.connect(flutterDepth).connect(osc.frequency);
    pan.pan.value = Math.max(-.9, Math.min(.9, Math.sin(stepRef.current * 1.7) * .72));
    amp.gain.setValueAtTime(.0001, now);
    amp.gain.exponentialRampToValueAtTime(accent ? .25 : .14, now + .018);
    amp.gain.exponentialRampToValueAtTime(.0001, now + (accent ? .7 : .46));
    osc.connect(amp); harmonic.connect(amp); amp.connect(pan).connect(rig.gull);
    osc.start(now); harmonic.start(now); flutter.start(now);
    osc.stop(now + .8); harmonic.stop(now + .8); flutter.stop(now + .8);
  }, [ensureRig, root, scale]);

  useEffect(() => {
    if (!running) {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
      return;
    }
    void gullCall(true);
    const ms = Math.max(80, (60000 / bpm) / 2);
    timerRef.current = window.setInterval(() => { void gullCall(stepRef.current % 4 === 0); }, ms);
    return () => { if (timerRef.current) window.clearInterval(timerRef.current); timerRef.current = null; };
  }, [running, bpm, gullCall]);

  useEffect(() => {
    let frame = 0;
    const draw = () => {
      const canvas = canvasRef.current;
      const analyser = rigRef.current?.analyser;
      if (canvas && analyser && visualOn) {
        const rect = canvas.getBoundingClientRect();
        const ratio = window.devicePixelRatio || 1;
        if (canvas.width !== Math.floor(rect.width * ratio) || canvas.height !== Math.floor(rect.height * ratio)) {
          canvas.width = Math.floor(rect.width * ratio); canvas.height = Math.floor(rect.height * ratio);
        }
        const ctx = canvas.getContext("2d")!;
        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        ctx.clearRect(0, 0, rect.width, rect.height);
        const bars = 48;
        for (let i = 0; i < bars; i++) {
          const v = data[Math.floor((i / bars) * data.length * .55)] / 255;
          ctx.fillStyle = i % 3 === 0 ? "#b06ab3" : "#1d1d1b";
          ctx.fillRect((i / bars) * rect.width, rect.height - v * rect.height, Math.max(2, rect.width / bars - 2), v * rect.height);
        }
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [visualOn]);

  const toggleTransport = async () => {
    await ensureRig();
    setRunning((v) => !v);
    setStatus(!running ? "GLOBAL TRANSPORT / RUNNING" : "GLOBAL TRANSPORT / STOPPED");
  };

  return (
    <main className="sl-host">
      <style>{STYLES}</style>

      <header className="sl-head">
        <div className="sl-brand"><b>MZCMG // SONIC LAB</b><span>INTERCONNECTED AUDIO + VISUAL DEVICE HOST / PROTOTYPE 01</span></div>
        <div className="sl-global">
          <button className={running ? "run on" : "run"} onClick={() => void toggleTransport()}>{running ? "■ STOP" : "▶ RUN"}</button>
          <label><span>BPM</span><input type="number" min="40" max="220" value={bpm} onChange={(e) => setBpm(Math.max(40, Math.min(220, Number(e.target.value))))} /></label>
          <label><span>KEY</span><select value={root} onChange={(e) => setRoot(Number(e.target.value))}>{ROOTS.map((n, i) => <option key={n} value={i}>{n}</option>)}</select></label>
          <label><span>SCALE</span><select value={scale} onChange={(e) => setScale(e.target.value)}>{Object.keys(SCALES).map((n) => <option key={n}>{n}</option>)}</select></label>
          <label className="main"><span>MAIN</span><input type="range" min="0" max="1" step=".01" value={mainLevel} onChange={(e) => setMainLevel(Number(e.target.value))} /><b>{Math.round(mainLevel * 100)}%</b></label>
        </div>
      </header>

      <nav className="sl-tabs" aria-label="Sonic Lab devices">
        {DEVICES.map((d) => <button key={d.id} className={`${d.type} ${active === d.id ? "active" : ""}`} onClick={() => setActive(d.id)}><i>{d.id}</i>{d.name}</button>)}
      </nav>

      <div className="sl-status"><i className={running ? "on" : ""} />{status}<span>YELLOW / AUDIO</span><span className="visual-key">PURPLE / VISUAL</span><span>SYSTEM / NEUTRAL</span></div>

      {selected.id === "01" && (
        <section className="sl-panel gull-panel">
          <div className="panel-head"><div><small>MZCMG_SL-01 / HOSTED DEVICE</small><h1>GULL</h1><p>AVIAN SIGNAL SYNTHESIZER / GLOBAL KEY + SCALE + BPM FOLLOW</p></div><button onClick={() => void gullCall(true)}>TRIGGER CALL</button></div>
          <div className="gull-grid">
            <article><b>HOST STATUS</b><strong>CONNECTED</strong><p>This is the first device running directly inside the shared SONIC LAB audio graph.</p></article>
            <article><b>MUSICAL CONTEXT</b><strong>{ROOTS[root]} / {scale}</strong><p>{bpm} BPM · FOLLOW GLOBAL</p></article>
            <article><b>OUTPUT BUS</b><strong>GULL OUT</strong><p>Route this signal through the patch bay instead of a fixed destination.</p></article>
            <article className="visual-card"><b>LIVE ANALYSIS BUS</b><canvas ref={canvasRef} /></article>
          </div>
          <button className="route-jump" onClick={() => setActive("RT")}>OPEN ROUTING →</button>
        </section>
      )}

      {selected.id === "RT" && (
        <section className="sl-panel routing-panel">
          <div className="panel-head"><div><small>SYSTEM / AUDIO GRAPH</small><h1>ROUTING</h1><p>PATCH AUDIO INTO EFFECTS, MAIN OUTPUT, AND VISUAL ANALYSIS</p></div></div>
          <div className="route-grid">
            <div className="node audio-node"><small>AUDIO DEVICE</small><b>GULL</b><span>OUT / STEREO</span></div>
            <div className="route-arrows">→</div>
            <label className={`node utility-node ${directOn ? "enabled" : ""}`}><input type="checkbox" checked={directOn} onChange={(e) => setDirectOn(e.target.checked)} /><small>PATH A</small><b>DIRECT</b><span>TO MAIN</span></label>
            <div className="route-arrows">→</div>
            <div className="node main-node"><small>OUTPUT</small><b>MAIN</b><span>{Math.round(mainLevel * 100)}%</span></div>

            <div className="node ghost"><small>FROM</small><b>GULL</b></div>
            <div className="route-arrows">→</div>
            <label className={`node utility-node ${filterOn ? "enabled" : ""}`}><input type="checkbox" checked={filterOn} onChange={(e) => setFilterOn(e.target.checked)} /><small>PATH B</small><b>LOW-PASS</b><span>{cutoff} HZ</span><input className="node-range" type="range" min="180" max="8000" step="10" value={cutoff} onChange={(e) => setCutoff(Number(e.target.value))} /></label>
            <div className="route-arrows">→</div>
            <div className="node main-node"><small>OUTPUT</small><b>MAIN</b><span>FILTER BUS</span></div>

            <div className="node ghost"><small>FROM</small><b>FILTER</b></div>
            <div className="route-arrows">→</div>
            <label className={`node utility-node ${delayOn ? "enabled" : ""}`}><input type="checkbox" checked={delayOn} onChange={(e) => setDelayOn(e.target.checked)} /><small>SEND C</small><b>DELAY</b><span>{delayTime.toFixed(2)} SEC</span><input className="node-range" type="range" min=".06" max=".9" step=".01" value={delayTime} onChange={(e) => setDelayTime(Number(e.target.value))} /></label>
            <div className="route-arrows">→</div>
            <div className="node main-node"><small>RETURN</small><b>MAIN</b><span>DELAY BUS</span></div>

            <div className="node ghost"><small>FROM</small><b>GULL</b></div>
            <div className="route-arrows visual-arrow">→</div>
            <label className={`node visual-node ${visualOn ? "enabled" : ""}`}><input type="checkbox" checked={visualOn} onChange={(e) => setVisualOn(e.target.checked)} /><small>ANALYSIS</small><b>VISUAL BUS</b><span>FFT / ENERGY</span></label>
            <div className="route-arrows visual-arrow">→</div>
            <div className="node visual-node"><small>ENDPOINTS</small><b>VISUAL TOOLS</b><span>BRIDGE NEXT</span></div>
          </div>
          <p className="route-note">The GULL paths above are live Web Audio routes. The visual bus is already producing analysis data; the next migration step is replacing the current visual tools’ microphone/file inputs with this internal bus when hosted.</p>
        </section>
      )}

      {selected.id !== "01" && selected.id !== "RT" && selected.href && (
        <section className={`sl-panel legacy-panel ${selected.type}`}>
          <div className="legacy-head"><div><small>MZCMG_SL-{selected.id} / {selected.type.toUpperCase()} DEVICE</small><h1>{selected.name}</h1><p>STANDALONE DEVICE BRIDGE / HOST MIGRATION PENDING</p></div><Link href={selected.href}>OPEN DIRECT ↗</Link></div>
          <iframe title={selected.name} src={selected.href} />
        </section>
      )}
    </main>
  );
}

const STYLES = `
:root{--sl-visual:#b06ab3;--sl-visual-cool:#6a82fb}.sonic-lab-global-header{display:none!important}.sl-host{min-height:100vh;background:var(--paper);color:var(--ink);font-family:Arial,Helvetica,sans-serif}.sl-host *{box-sizing:border-box}.sl-head{position:sticky;top:0;z-index:1000;display:grid;grid-template-columns:minmax(260px,1fr) auto;border-bottom:2px solid var(--ink);background:var(--paper)}.sl-brand{background:var(--ink);color:var(--acid);padding:11px 16px;display:flex;flex-direction:column;justify-content:center}.sl-brand b{font:950 16px/1 var(--mono);letter-spacing:.06em}.sl-brand span{margin-top:5px;font:700 7px/1 var(--mono);letter-spacing:.1em}.sl-global{display:flex;align-items:stretch}.sl-global button,.sl-global label{border:0;border-left:1px solid var(--ink);background:transparent;padding:7px 10px;min-width:78px}.sl-global label{display:flex;flex-direction:column;justify-content:center;gap:3px}.sl-global label span{font:800 7px/1 var(--mono);color:var(--muted);letter-spacing:.08em}.sl-global input[type=number],.sl-global select{width:78px;border:0;background:transparent;font:900 13px/1 var(--mono);outline:0}.sl-global .run{font:900 10px/1 var(--mono);background:var(--acid);min-width:92px}.sl-global .run.on{background:var(--ink);color:var(--acid)}.sl-global .main{min-width:145px;display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:7px}.sl-global .main span{grid-column:1}.sl-global .main input{grid-column:2;width:78px}.sl-global .main b{font:900 8px var(--mono)}.sl-tabs{position:sticky;top:58px;z-index:999;display:flex;overflow-x:auto;border-bottom:2px solid var(--ink);background:var(--paper)}.sl-tabs button{flex:0 0 auto;border:0;border-right:1px solid var(--ink);background:transparent;padding:10px 12px;font:900 8px/1 var(--mono);letter-spacing:.05em}.sl-tabs button i{font-style:normal;margin-right:7px;padding:3px 4px;border:1px solid var(--ink)}.sl-tabs button.audio i{background:var(--acid)}.sl-tabs button.visual i{background:var(--sl-visual);color:white}.sl-tabs button.system i{background:var(--ink);color:var(--paper)}.sl-tabs button.active.audio{background:var(--acid)}.sl-tabs button.active.visual{background:var(--sl-visual);color:white}.sl-tabs button.active.system{background:var(--ink);color:var(--paper)}.sl-status{display:flex;align-items:center;gap:8px;padding:7px 16px;border-bottom:1px solid var(--ink);font:800 7px/1 var(--mono);letter-spacing:.07em}.sl-status>i{width:7px;height:7px;border:1px solid var(--ink)}.sl-status>i.on{background:var(--acid)}.sl-status span{margin-left:auto}.sl-status span+span{margin-left:8px}.sl-status .visual-key{color:var(--sl-visual)}.sl-panel{padding:18px 22px 30px;max-width:1600px;margin:0 auto}.panel-head,.legacy-head{display:flex;justify-content:space-between;align-items:end;border-top:2px solid var(--ink);border-bottom:2px solid var(--ink);padding:14px 0}.panel-head small,.legacy-head small{font:800 8px/1 var(--mono);letter-spacing:.1em;color:var(--muted)}.panel-head h1,.legacy-head h1{margin:7px 0 0;font-size:clamp(44px,6vw,88px);font-weight:950;letter-spacing:-.065em;line-height:.78}.panel-head p,.legacy-head p{margin:9px 0 0;font:800 8px/1 var(--mono);letter-spacing:.1em}.panel-head>button,.legacy-head a,.route-jump{border:1.5px solid var(--ink);background:var(--acid);padding:12px 14px;text-decoration:none;color:var(--ink);font:900 9px/1 var(--mono);letter-spacing:.08em}.gull-grid{display:grid;grid-template-columns:repeat(4,1fr);border-bottom:1.5px solid var(--ink)}.gull-grid article{min-height:180px;padding:16px;border-right:1px solid var(--ink)}.gull-grid article:last-child{border-right:0}.gull-grid b{display:block;font:900 8px/1 var(--mono);letter-spacing:.08em;color:var(--muted)}.gull-grid strong{display:block;margin-top:14px;font-size:22px}.gull-grid p{font-size:12px;line-height:1.5}.gull-grid .visual-card{background:rgba(176,106,179,.1)}.visual-card canvas{width:100%;height:110px;margin-top:10px;border:1px solid var(--ink);display:block}.route-jump{display:block;width:max-content;margin:18px 0 0}.route-grid{display:grid;grid-template-columns:minmax(150px,1fr) 42px minmax(180px,1.3fr) 42px minmax(150px,1fr);gap:10px;align-items:stretch;margin-top:20px}.node{min-height:110px;border:1.5px solid var(--ink);padding:13px;display:flex;flex-direction:column;justify-content:center;gap:8px;position:relative}.node small{font:800 7px/1 var(--mono);letter-spacing:.08em;color:var(--muted)}.node b{font-size:17px}.node span{font:800 8px/1 var(--mono)}.node input[type=checkbox]{position:absolute;right:10px;top:10px}.audio-node{background:var(--acid)}.visual-node{border-color:var(--sl-visual)}.visual-node.enabled{background:var(--sl-visual);color:white}.visual-node.enabled small{color:white}.utility-node.enabled{box-shadow:inset 0 0 0 5px var(--acid)}.main-node{background:var(--ink);color:var(--paper)}.ghost{opacity:.48}.route-arrows{display:grid;place-items:center;font:900 24px/1 var(--mono)}.visual-arrow{color:var(--sl-visual)}.node-range{width:100%;accent-color:var(--ink)}.route-note{margin:18px 0 0;max-width:1000px;font-size:12px;line-height:1.55}.legacy-panel{max-width:none;padding-bottom:0}.legacy-panel.visual .legacy-head{border-color:var(--sl-visual)}.legacy-panel.visual .legacy-head a{background:var(--sl-visual);color:white}.legacy-panel iframe{width:100%;height:calc(100vh - 235px);min-height:620px;border:1.5px solid var(--ink);border-top:0;display:block;background:var(--paper)}
@media(max-width:1000px){.sl-head{grid-template-columns:1fr}.sl-global{overflow-x:auto}.sl-tabs{top:109px}.gull-grid{grid-template-columns:repeat(2,1fr)}.gull-grid article:nth-child(2){border-right:0}.gull-grid article:nth-child(n+3){border-top:1px solid var(--ink)}.route-grid{grid-template-columns:1fr 30px 1.3fr 30px 1fr}}
@media(max-width:650px){.sl-tabs{top:109px}.sl-brand b{font-size:13px}.sl-panel{padding:14px}.panel-head,.legacy-head{align-items:flex-start;gap:16px;flex-direction:column}.gull-grid{grid-template-columns:1fr}.gull-grid article{border-right:0;border-top:1px solid var(--ink)}.route-grid{grid-template-columns:1fr}.route-arrows{transform:rotate(90deg);height:24px}.legacy-panel iframe{min-height:700px;height:calc(100vh - 270px)}}
`;
