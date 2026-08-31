"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import "./groove-course.css";

type Mode = "STRAIGHT" | "GROOVE" | "BROKEN";
type Rating = { mode: Mode; scaffold: number; score: number };

const MODE: Record<Mode, { label:string; sync:number; note:string }> = {
  STRAIGHT: { label:"TOO STRAIGHT", sync:8, note:"The pulse is obvious, but there is little expectation violation." },
  GROOVE: { label:"RESEARCH ZONE", sync:48, note:"Clear pulse + intermediate syncopation: the region most often associated with stronger PLUMM." },
  BROKEN: { label:"TOO UNSTABLE", sync:92, note:"So many events leave strong positions that the meter becomes harder to recover." },
};

const straightHat = [0,2,4,6,8,10,12,14];
const offbeats = [1,3,5,7,9,11,13,15];

function patternFor(sync:number){
  const hats = new Set(straightHat);
  const moved:number[] = [];
  const moveCount = sync < 20 ? 0 : sync < 70 ? 3 : 7;
  for(let i=0;i<moveCount;i++){
    const from = straightHat[(i*3)%straightHat.length];
    const to = offbeats[(i*2+1)%offbeats.length];
    hats.delete(from); hats.add(to); moved.push(to);
  }
  return { kick:[0,4,8,12], snare:[4,12], hat:[...hats].sort((a,b)=>a-b), moved };
}

export default function GrooveCoursePage(){
  const [module,setModule] = useState(1);
  const [mode,setMode] = useState<Mode>("STRAIGHT");
  const [scaffold,setScaffold] = useState(3);
  const [playing,setPlaying] = useState(false);
  const [step,setStep] = useState(-1);
  const [ratings,setRatings] = useState<Rating[]>([]);
  const [score,setScore] = useState(5);
  const [showResearch,setShowResearch] = useState(false);
  const ctxRef = useRef<AudioContext|null>(null);
  const timerRef = useRef<number|null>(null);
  const liveRef = useRef({mode,scaffold});

  useEffect(()=>{ liveRef.current={mode,scaffold}; },[mode,scaffold]);
  const pattern = useMemo(()=>patternFor(MODE[mode].sync),[mode]);

  function ensure(){
    if(!ctxRef.current) ctxRef.current = new AudioContext();
    if(ctxRef.current.state === "suspended") void ctxRef.current.resume();
    return ctxRef.current;
  }

  function hit(ctx:AudioContext,time:number,type:"kick"|"snare"|"hat"){
    if(type==="kick"){
      const osc=ctx.createOscillator(), g=ctx.createGain();
      osc.type="sine"; osc.frequency.setValueAtTime(125,time); osc.frequency.exponentialRampToValueAtTime(48,time+.11);
      g.gain.setValueAtTime(.78,time); g.gain.exponentialRampToValueAtTime(.001,time+.18);
      osc.connect(g).connect(ctx.destination); osc.start(time); osc.stop(time+.2); return;
    }
    const len=type==="snare"?.1:.032;
    const b=ctx.createBuffer(1,Math.floor(ctx.sampleRate*len),ctx.sampleRate), d=b.getChannelData(0);
    for(let i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*(1-i/d.length);
    const src=ctx.createBufferSource(), f=ctx.createBiquadFilter(), g=ctx.createGain(); src.buffer=b;
    f.type="highpass"; f.frequency.value=type==="snare"?900:5200; g.gain.value=type==="snare"?.27:.12;
    src.connect(f).connect(g).connect(ctx.destination); src.start(time);
  }

  function fireStep(i:number){
    const ctx=ensure(); const {mode:m,scaffold:s}=liveRef.current; const p=patternFor(MODE[m].sync); const now=ctx.currentTime;
    if(p.kick.includes(i)) hit(ctx,now,"kick");
    if(s>=2 && p.snare.includes(i)) hit(ctx,now,"snare");
    if(s>=3 && p.hat.includes(i)) hit(ctx,now,"hat");
  }

  function stop(){ if(timerRef.current) window.clearInterval(timerRef.current); timerRef.current=null; setPlaying(false); setStep(-1); }
  function play(){
    if(playing){ stop(); return; }
    ensure(); let i=0; fireStep(i); setStep(i); setPlaying(true);
    timerRef.current=window.setInterval(()=>{ i=(i+1)%16; fireStep(i); setStep(i); },(60/116/4)*1000);
  }
  useEffect(()=>()=>{ if(timerRef.current) window.clearInterval(timerRef.current); },[]);

  function choose(next:Mode){ setMode(next); }
  function log(){ setRatings(r=>[...r,{mode,scaffold,score}]); }
  const best=ratings.length?[...ratings].sort((a,b)=>b.score-a.score)[0]:null;
  const zone = mode==="GROOVE" && scaffold===3 ? "SUPPORTED" : mode==="GROOVE" ? "PARTIAL" : "OUTSIDE";

  return <main className="gc-shell">
    <aside className="gc-rail">
      <div className="gc-brand">MZCMG // GROOVE CORE</div>
      <div className="gc-sub">COURSE // LESSON 01</div>
      {[1,2,3,4].map(n=><button key={n} className={`gc-nav ${module===n?"active":""}`} onClick={()=>setModule(n)}><b>0{n}</b><span>{["FIND THE PULSE","BREAK THE EXPECTATION","FIND THE GROOVE ZONE","TEST THE SCAFFOLD"][n-1]}</span></button>)}
    </aside>

    <section className="gc-main">
      <header className="gc-top"><div><div className="gc-eyebrow">SYNCOPATION LAB</div><h1>{["First: feel the clock.","Now: move events off the clock.","There is a sweet spot.","The scaffold changes the result."][module-1]}</h1></div><div className="gc-progress">MODULE {module} / 4</div></header>

      <section className="gc-stage">
        {module===1 && <>
          <div className="gc-instruction"><b>DO THIS</b><span>Press play. Ignore whether you like it. Tap your foot on the big numbered squares.</span></div>
          <CompareButtons mode={mode} choose={choose} onlyStraight />
          <BeatView pattern={pattern} step={step} scaffold={1}/>
          <div className="gc-concept"><b>PULSE</b><span>The repeating beat is the prediction scaffold. Before syncopation can create tension, the body needs a clock it can keep finding.</span></div>
        </>}

        {module===2 && <>
          <div className="gc-instruction"><b>DO THIS</b><span>Switch between A and B while the loop plays. Watch the yellow hits: those are events displaced away from expected positions.</span></div>
          <CompareButtons mode={mode} choose={choose} allowed={["STRAIGHT","GROOVE"]}/>
          <BeatView pattern={pattern} step={step} scaffold={3}/>
          <div className="gc-legend"><span><i className="expected"/> strong beat</span><span><i className="moved"/> displaced event</span><span><i className="playhead"/> current step</span></div>
          <div className="gc-concept"><b>SYNCOPATION</b><span>An event arrives where the meter does not strongly predict it — while the underlying beat remains recoverable.</span></div>
        </>}

        {module===3 && <>
          <div className="gc-instruction"><b>DO THIS</b><span>A → B → C. Do not hunt for “best music.” Notice where your body gets the strongest pull without losing the beat.</span></div>
          <CompareButtons mode={mode} choose={choose}/>
          <ResearchMeter mode={mode}/>
          <BeatView pattern={pattern} step={step} scaffold={3}/>
          <div className={`gc-zone ${zone.toLowerCase()}`}><b>{MODE[mode].label}</b><span>{MODE[mode].note}</span></div>
          <button className="gc-reveal" onClick={()=>setShowResearch(v=>!v)}>{showResearch?"HIDE WHY":"WHY DOES RESEARCH EXPECT THIS?"}</button>
          {showResearch && <div className="gc-research"><b>WITEK ET AL. 2014</b><span>Across their stimuli, pleasure and wanting-to-move tended to peak at intermediate syncopation: an inverted-U, not a “more is better” rule.</span><small>Important: this is a population-level tendency, not a universal law.</small></div>}
        </>}

        {module===4 && <>
          <div className="gc-instruction"><b>DO THIS</b><span>Keep B // RESEARCH ZONE selected. Strip the rhythm down, then rebuild it. The syncopation stays the same.</span></div>
          <CompareButtons mode={mode} choose={choose} allowed={["GROOVE"]}/>
          <div className="gc-scaffold">
            {[1,2,3].map(s=><button key={s} onClick={()=>setScaffold(s)} className={scaffold===s?"active":""}>{s===1?"KICK ONLY":s===2?"+ SNARE":"+ HI-HAT"}</button>)}
          </div>
          <BeatView pattern={pattern} step={step} scaffold={scaffold}/>
          <div className={`gc-zone ${zone.toLowerCase()}`}><b>{zone==="SUPPORTED"?"STRONGEST RESEARCH MATCH":zone==="PARTIAL"?"SCAFFOLD INCOMPLETE":"OUTSIDE TARGET"}</b><span>{zone==="SUPPORTED"?"Intermediate syncopation + full rhythmic scaffold matches the condition that produced the clearest inverted-U in newer layer research.":"Same syncopation, less metrical support. The relationship becomes less reliable."}</span></div>
          <div className="gc-rate"><span>YOUR URGE TO MOVE</span><b>{score}/10</b><input type="range" min="0" max="10" value={score} onChange={e=>setScore(+e.target.value)}/><button onClick={log}>LOG TRIAL</button><small>{ratings.length} trials {best?`// best ${best.score}/10: ${best.mode}, scaffold ${best.scaffold}`:""}</small></div>
          <div className="gc-research"><b>SEEBERG ET AL. 2025</b><span>The clearest inverted-U emerged with the full bass-drum + snare + hi-hat scaffold. Syncopation does not act alone.</span></div>
        </>}
      </section>

      <div className="gc-playbar"><button className={playing?"on":""} onClick={play}>{playing?"■ STOP LOOP":"▶ PLAY LOOP"}</button><span>116 BPM // 16 STEPS</span>{module<4?<button className="gc-next" onClick={()=>setModule(m=>Math.min(4,m+1))}>NEXT MODULE →</button>:<span className="gc-done">LESSON MODEL: PULSE SCAFFOLD × SYNCOPATION → PLUMM</span>}</div>
    </section>
  </main>;
}

function CompareButtons({mode,choose,allowed,onlyStraight}:{mode:Mode;choose:(m:Mode)=>void;allowed?:Mode[];onlyStraight?:boolean}){
  const modes:Mode[]=onlyStraight?["STRAIGHT"]:(allowed??["STRAIGHT","GROOVE","BROKEN"]);
  return <div className="gc-compare">{modes.map((m,i)=><button key={m} className={mode===m?"active":""} onClick={()=>choose(m)}><small>{String.fromCharCode(65+i)}</small><b>{m==="STRAIGHT"?"STRAIGHT":m==="GROOVE"?"INTERMEDIATE":"HEAVY"}</b><span>{MODE[m].sync}% syncopation</span></button>)}</div>;
}

function BeatView({pattern,step,scaffold}:{pattern:{kick:number[];snare:number[];hat:number[];moved:number[]};step:number;scaffold:number}){
  const lanes=[{name:"KICK",hits:pattern.kick,on:true},{name:"SNARE",hits:pattern.snare,on:scaffold>=2},{name:"HI-HAT",hits:pattern.hat,on:scaffold>=3}];
  return <div className="gc-seq"><div className="gc-beatnums"><span/> {Array.from({length:16},(_,i)=><b key={i} className={i%4===0?"strong":""}>{i%4===0?i/4+1:"·"}</b>)}</div>{lanes.map(l=><div className={`gc-lane ${l.on?"":"muted"}`} key={l.name}><label>{l.name}</label>{Array.from({length:16},(_,i)=><i key={i} className={`${l.hits.includes(i)&&l.on?"hit":""} ${pattern.moved.includes(i)&&l.name==="HI-HAT"?"moved":""} ${step===i?"head":""} ${i%4===0?"beat":""}`}/>)}</div>)}</div>;
}

function ResearchMeter({mode}:{mode:Mode}){
  const left=mode==="STRAIGHT"?9:mode==="GROOVE"?50:91;
  return <div className="gc-meter"><div className="gc-meterlabels"><span>TOO PREDICTABLE</span><b>COMMON GROOVE ZONE</b><span>TOO COMPLEX</span></div><div className="gc-meterbar"><div className="gc-sweet"/><i style={{left:`${left}%`}}/></div><small>Research summary: intermediate rhythmic complexity frequently produces the strongest pleasurable urge to move.</small></div>;
}
