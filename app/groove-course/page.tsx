"use client";

import { useMemo, useRef, useState } from "react";
import "./groove-course.css";

type Lesson = {
  id: string;
  title: string;
  kicker: string;
  status: "LIVE" | "NEXT";
};

type Rating = { sync: number; scaffold: number; score: number };

const lessons: Lesson[] = [
  { id: "syncopation", title: "Syncopation", kicker: "Expectation, violation, movement", status: "LIVE" },
  { id: "layers", title: "Rhythmic Layers", kicker: "Why scaffolds change groove", status: "NEXT" },
  { id: "bass", title: "Bass + VLF", kicker: "Low-frequency energy and the body", status: "NEXT" },
  { id: "microtiming", title: "Microtiming", kicker: "When humanization helps — and when it does not", status: "NEXT" },
  { id: "tempo", title: "Tempo", kicker: "BPM, event rate, and movement", status: "NEXT" },
];

const straightHat = [0,2,4,6,8,10,12,14];
const syncPools = [
  [2,6,10,14],
  [1,3,5,7,9,11,13,15],
  [3,7,11,15],
];

function clamp(v:number,min:number,max:number){ return Math.max(min,Math.min(max,v)); }

export default function GrooveCoursePage(){
  const [playing,setPlaying] = useState(false);
  const [sync,setSync] = useState(42);
  const [scaffold,setScaffold] = useState(3);
  const [bpm,setBpm] = useState(116);
  const [ratings,setRatings] = useState<Rating[]>([]);
  const [score,setScore] = useState(6);
  const [reveal,setReveal] = useState(false);
  const ctxRef = useRef<AudioContext|null>(null);
  const timerRef = useRef<number|null>(null);
  const stepRef = useRef(0);

  const pattern = useMemo(()=>{
    const amount = sync/100;
    const hats = new Set(straightHat);
    const moveCount = Math.round(amount*5);
    const targets = [...syncPools[1]].slice(0,moveCount);
    for(let i=0;i<moveCount;i++){
      const from = straightHat[(i*3)%straightHat.length];
      hats.delete(from);
      hats.add(targets[i]);
    }
    return {
      kick:[0,4,8,12],
      snare:[4,12],
      hat:[...hats].sort((a,b)=>a-b),
    };
  },[sync]);

  function ensureCtx(){
    if(!ctxRef.current) ctxRef.current = new AudioContext();
    if(ctxRef.current.state === "suspended") void ctxRef.current.resume();
    return ctxRef.current;
  }

  function hit(ctx:AudioContext,time:number,type:"kick"|"snare"|"hat"){
    if(type==="kick"){
      const osc=ctx.createOscillator(); const g=ctx.createGain();
      osc.type="sine"; osc.frequency.setValueAtTime(130,time); osc.frequency.exponentialRampToValueAtTime(48,time+.12);
      g.gain.setValueAtTime(.7,time); g.gain.exponentialRampToValueAtTime(.001,time+.18);
      osc.connect(g).connect(ctx.destination); osc.start(time); osc.stop(time+.2);
    } else {
      const len = type==="snare" ? .11 : .035;
      const buffer=ctx.createBuffer(1,Math.floor(ctx.sampleRate*len),ctx.sampleRate);
      const data=buffer.getChannelData(0); for(let i=0;i<data.length;i++) data[i]=(Math.random()*2-1)*(1-i/data.length);
      const src=ctx.createBufferSource(); src.buffer=buffer;
      const filter=ctx.createBiquadFilter(); filter.type="highpass"; filter.frequency.value=type==="snare"?900:5000;
      const g=ctx.createGain(); g.gain.value=type==="snare"?.22:.08;
      src.connect(filter).connect(g).connect(ctx.destination); src.start(time);
    }
  }

  function tick(){
    const ctx=ensureCtx(); const step=stepRef.current%16; const now=ctx.currentTime;
    if(pattern.kick.includes(step)) hit(ctx,now,"kick");
    if(scaffold>=2 && pattern.snare.includes(step)) hit(ctx,now,"snare");
    if(scaffold>=3 && pattern.hat.includes(step)) hit(ctx,now,"hat");
    stepRef.current=(step+1)%16;
  }

  function toggle(){
    if(playing){ if(timerRef.current) window.clearInterval(timerRef.current); timerRef.current=null; setPlaying(false); return; }
    ensureCtx(); tick();
    const ms=(60/bpm/4)*1000;
    timerRef.current=window.setInterval(tick,ms);
    setPlaying(true);
  }

  function saveRating(){
    setRatings(r=>[...r,{sync,scaffold,score}]);
  }

  const best = ratings.length ? [...ratings].sort((a,b)=>b.score-a.score)[0] : null;

  return <main className="gc-shell">
    <aside className="gc-rail">
      <div className="gc-brand">MZCMG // GROOVE CORE</div>
      <div className="gc-sub">PRIVATE COURSE v0.1</div>
      <nav>
        {lessons.map((l,i)=><button key={l.id} className={`gc-lesson ${i===0?"active":""}`} disabled={i!==0}>
          <span>{String(i+1).padStart(2,"0")}</span>
          <strong>{l.title}</strong>
          <em>{l.status}</em>
        </button>)}
      </nav>
    </aside>

    <section className="gc-main">
      <header className="gc-hero">
        <div className="gc-eyebrow">LESSON 01 // SYNCOPATION</div>
        <h1>When does breaking the beat make the body want to move?</h1>
        <p>Groove research does not say “more syncopation is better.” A recurring result is an <b>inverted-U</b>: too little can feel obvious, too much can destabilize the pulse, and an intermediate region often produces the strongest pleasurable urge to move.</p>
      </header>

      <section className="gc-card lesson-copy">
        <div className="gc-stepnum">01</div>
        <div>
          <h2>Hear the stable scaffold first.</h2>
          <p>A strong pulse gives the listener something to predict. Syncopation works by placing events where the meter does not most strongly expect them — but the underlying beat still has to remain recoverable.</p>
          <p className="gc-note">Research anchor: Witek et al. (2014), later complicated by evidence showing that instrumentation and rhythmic-layer structure alter the effect.</p>
        </div>
      </section>

      <section className="gc-lab">
        <div className="gc-labtop">
          <div><div className="gc-eyebrow">INTERACTIVE LAB</div><h2>Manipulate the groove.</h2></div>
          <button className={`gc-play ${playing?"on":""}`} onClick={toggle}>{playing?"■ STOP":"▶ PLAY LOOP"}</button>
        </div>

        <div className="gc-grid16">
          {Array.from({length:16},(_,i)=><div key={i} className={`gc-step ${i%4===0?"beat":""} ${pattern.hat.includes(i)&&scaffold>=3?"hat":""} ${pattern.snare.includes(i)&&scaffold>=2?"snare":""} ${pattern.kick.includes(i)?"kick":""}`}>
            <span>{i%4===0?i/4+1:"·"}</span>
          </div>)}
        </div>

        <div className="gc-controls">
          <label><span>SYNCOPATION <b>{sync}</b></span><input type="range" min="0" max="100" value={sync} onChange={e=>setSync(+e.target.value)}/><small>predictable ← → destabilized</small></label>
          <label><span>SCAFFOLD <b>{["KICK","KICK + SNARE","FULL KIT"][scaffold-1]}</b></span><input type="range" min="1" max="3" step="1" value={scaffold} onChange={e=>setScaffold(+e.target.value)}/><small>how much metrical support surrounds the syncopation</small></label>
          <label><span>TEMPO <b>{bpm} BPM</b></span><input type="range" min="90" max="140" value={bpm} onChange={e=>{setBpm(+e.target.value); if(playing){ if(timerRef.current) window.clearInterval(timerRef.current); timerRef.current=window.setInterval(tick,(60/+e.target.value/4)*1000); }}}/><small>kept secondary for this lesson</small></label>
        </div>
      </section>

      <section className="gc-card gc-test">
        <div className="gc-stepnum">02</div>
        <div className="gc-testbody">
          <h2>Do not ask “is this good?” Ask what your body wants to do.</h2>
          <label className="gc-rating"><span>URGE TO MOVE</span><b>{score}/10</b><input type="range" min="0" max="10" value={score} onChange={e=>setScore(+e.target.value)}/></label>
          <button className="gc-save" onClick={saveRating}>LOG THIS TRIAL</button>
          <div className="gc-stats"><span>TRIALS {ratings.length}</span><span>BEST {best?`${best.score}/10 @ sync ${best.sync}`:"—"}</span></div>
        </div>
      </section>

      <section className="gc-card lesson-copy">
        <div className="gc-stepnum">03</div>
        <div>
          <h2>Now reveal the model.</h2>
          <button className="gc-reveal" onClick={()=>setReveal(v=>!v)}>{reveal?"HIDE RESEARCH":"REVEAL RESEARCH"}</button>
          {reveal && <div className="gc-research">
            <h3>What the evidence suggests</h3>
            <p><b>Witek et al. (2014):</b> intermediate syncopation often produced the highest pleasure and wanting-to-move ratings.</p>
            <p><b>Seeberg et al. (2025):</b> that curve depends on the rhythmic scaffold; the full bass-drum + snare + hi-hat condition produced the clearest inverted-U.</p>
            <p><b>Working design rule:</b> do not optimize syncopation independently. Treat it as an interaction between expectation violation and pulse support.</p>
            <div className="gc-model">PULSE SCAFFOLD × SYNCOPATION → PLEASURABLE URGE TO MOVE</div>
            <p className="gc-note">Sources: Witek et al., PLOS ONE 2014, DOI 10.1371/journal.pone.0094446. Seeberg et al., Cognition 2025, DOI 10.1016/j.cognition.2025.106178.</p>
          </div>}
        </div>
      </section>

      <footer className="gc-footer">NEXT LESSON // RHYTHMIC LAYERS — why the same syncopation can groove differently depending on the scaffold.</footer>
    </section>
  </main>;
}
