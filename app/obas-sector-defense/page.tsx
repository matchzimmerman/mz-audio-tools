'use client';

import { useEffect, useRef, useState } from 'react';

const SECTORS = 8;
const KEYS = ['a','s','d','f','j','k','l',';'];
const LABELS = ['A','S','D','F','J','K','L',';'];
const VOICES = ['KICK','SNARE','HAT','TOM','KICK','CLAP','HAT','PERC'];
const STEP_MS = 250;
const TRAVEL_MS = 1800;
const HIT_RADIUS = 70;
const PERFECT_WINDOW = 70;
const GOOD_WINDOW = 135;

const PATTERN:number[][] = [
  [0,2],[],[2],[],
  [1,2],[],[2],[6],
  [4,2],[],[2,7],[],
  [5,2],[],[2],[3,6],
];

type Note = { id:number; sector:number; bornAt:number; hitAt:number; judged:boolean; hit:boolean };
type Pulse = { sector:number; life:number; strength:number };

export default function ObasSectorDefensePage() {
  const canvasRef = useRef<HTMLCanvasElement|null>(null);
  const notesRef = useRef<Note[]>([]);
  const pulsesRef = useRef<Pulse[]>([]);
  const nextIdRef = useRef(1);
  const audioRef = useRef<AudioContext|null>(null);
  const runningRef = useRef(false);
  const startTimeRef = useRef(0);
  const nextStepRef = useRef(0);

  const [running,setRunning] = useState(false);
  const [score,setScore] = useState(0);
  const [combo,setCombo] = useState(0);
  const [bestCombo,setBestCombo] = useState(0);
  const [status,setStatus] = useState('PRESS START // THEN PLAY A S D F J K L ;');
  const [lastKey,setLastKey] = useState('—');
  const [accuracy,setAccuracy] = useState({perfect:0,good:0,miss:0});

  function ensureAudio() {
    if (!audioRef.current) {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (Ctx) audioRef.current = new Ctx();
    }
    if (audioRef.current?.state === 'suspended') audioRef.current.resume();
    return audioRef.current;
  }

  function noiseBuffer(ctx: AudioContext, seconds=0.18) {
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate*seconds), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i=0;i<data.length;i++) data[i]=Math.random()*2-1;
    return buffer;
  }

  function playVoice(sector:number,strength=1) {
    const ctx=ensureAudio();
    if (!ctx) return;
    const now=ctx.currentTime;
    const voice=VOICES[sector];
    if (voice==='KICK') {
      const osc=ctx.createOscillator(); const gain=ctx.createGain();
      osc.type='sine';
      osc.frequency.setValueAtTime(120,now);
      osc.frequency.exponentialRampToValueAtTime(42,now+0.14);
      gain.gain.setValueAtTime(0.0001,now);
      gain.gain.exponentialRampToValueAtTime(0.85*strength,now+0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001,now+0.2);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now); osc.stop(now+0.22); return;
    }
    if (voice==='SNARE'||voice==='CLAP'||voice==='HAT'||voice==='PERC') {
      const src=ctx.createBufferSource(); const gain=ctx.createGain(); const filter=ctx.createBiquadFilter();
      src.buffer=noiseBuffer(ctx,voice==='HAT'?0.06:0.16);
      filter.type=voice==='HAT'?'highpass':'bandpass';
      filter.frequency.value=voice==='HAT'?6200:voice==='CLAP'?1800:1200;
      filter.Q.value=voice==='HAT'?0.7:1.1;
      gain.gain.setValueAtTime(0.55*strength,now);
      gain.gain.exponentialRampToValueAtTime(0.0001,now+(voice==='HAT'?0.055:0.16));
      src.connect(filter).connect(gain).connect(ctx.destination); src.start(now); return;
    }
    const osc=ctx.createOscillator(); const gain=ctx.createGain();
    osc.type='triangle';
    osc.frequency.setValueAtTime(220+sector*34,now);
    osc.frequency.exponentialRampToValueAtTime(95+sector*12,now+0.12);
    gain.gain.setValueAtTime(0.4*strength,now);
    gain.gain.exponentialRampToValueAtTime(0.0001,now+0.18);
    osc.connect(gain).connect(ctx.destination); osc.start(now); osc.stop(now+0.2);
  }

  function spawnStep(stepIndex:number,now:number) {
    for (const sector of PATTERN[stepIndex%PATTERN.length]) {
      notesRef.current.push({id:nextIdRef.current++,sector,bornAt:now,hitAt:now+TRAVEL_MS,judged:false,hit:false});
    }
  }

  function judgeSector(sector:number) {
    if (!runningRef.current) return;
    const now=performance.now();
    setLastKey(LABELS[sector]);
    let candidate:Note|null=null;
    let delta=Infinity;
    for (const note of notesRef.current) {
      if (note.sector!==sector||note.judged) continue;
      const d=Math.abs(note.hitAt-now);
      if (d<delta) {delta=d;candidate=note;}
    }
    if (!candidate||delta>GOOD_WINDOW) {
      setCombo(0); setStatus(`${LABELS[sector]} // EARLY OR LATE`);
      pulsesRef.current.push({sector,life:1,strength:0.35}); return;
    }
    candidate.judged=true; candidate.hit=true;
    const perfect=delta<=PERFECT_WINDOW;
    setScore(v=>v+(perfect?150:80)+Math.min(200,(combo+1)*4));
    setCombo(v=>{const n=v+1;setBestCombo(b=>Math.max(b,n));return n;});
    setAccuracy(a=>perfect?{...a,perfect:a.perfect+1}:{...a,good:a.good+1});
    setStatus(`${LABELS[sector]} // ${perfect?'PERFECT':'GOOD'} // ${VOICES[sector]}`);
    pulsesRef.current.push({sector,life:1,strength:perfect?1:0.72});
    playVoice(sector,perfect?1:0.8);
  }

  function toggleRun() {
    ensureAudio();
    const next=!runningRef.current;
    runningRef.current=next; setRunning(next);
    if (next) {
      const now=performance.now();
      startTimeRef.current=now; nextStepRef.current=0;
      notesRef.current=[]; pulsesRef.current=[];
      setScore(0); setCombo(0); setAccuracy({perfect:0,good:0,miss:0});
      setStatus('BEAT RUNNING // FOLLOW THE INCOMING TILES');
    } else setStatus('PAUSED // SPACE OR START TO RESUME');
  }

  useEffect(()=>{
    const onKey=(event:KeyboardEvent)=>{
      if (event.repeat) return;
      if (event.code==='Space') {event.preventDefault();toggleRun();return;}
      const sector=KEYS.indexOf(event.key.toLowerCase());
      if (sector>=0) {event.preventDefault();judgeSector(sector);}
    };
    window.addEventListener('keydown',onKey);
    return()=>window.removeEventListener('keydown',onKey);
  },[]);

  useEffect(()=>{
    const canvas=canvasRef.current; if (!canvas) return;
    const ctx=canvas.getContext('2d'); if (!ctx) return;
    let raf=0,last=performance.now();
    const resize=()=>{
      const r=canvas.getBoundingClientRect(); const dpr=Math.min(window.devicePixelRatio||1,2);
      canvas.width=Math.max(1,Math.floor(r.width*dpr)); canvas.height=Math.max(1,Math.floor(r.height*dpr));
      ctx.setTransform(dpr,0,0,dpr,0,0);
    };
    resize(); const ro=new ResizeObserver(resize); ro.observe(canvas);

    const draw=(now:number)=>{
      const dt=Math.min(50,now-last); last=now;
      const w=canvas.clientWidth,h=canvas.clientHeight,cx=w/2,cy=h/2;
      const radius=Math.max(150,Math.min(w,h)*0.44),wedge=Math.PI*2/SECTORS;
      ctx.fillStyle='#050505'; ctx.fillRect(0,0,w,h);

      if (runningRef.current) {
        const elapsed=now-startTimeRef.current;
        const targetStep=Math.floor(elapsed/STEP_MS)+Math.ceil(TRAVEL_MS/STEP_MS);
        while (nextStepRef.current<=targetStep) {
          const born=startTimeRef.current+nextStepRef.current*STEP_MS-TRAVEL_MS;
          if (born<=now) spawnStep(nextStepRef.current,born);
          nextStepRef.current++;
        }
      }

      for (let i=0;i<SECTORS;i++) {
        const a0=-Math.PI/2+i*wedge,a1=a0+wedge,am=(a0+a1)/2;
        ctx.beginPath();ctx.moveTo(cx,cy);ctx.arc(cx,cy,radius,a0,a1);ctx.closePath();
        ctx.strokeStyle='rgba(218,255,0,.15)';ctx.lineWidth=1;ctx.stroke();
        ctx.fillStyle='rgba(218,255,0,.78)';ctx.font='700 15px ui-monospace, monospace';ctx.textAlign='center';
        ctx.fillText(LABELS[i],cx+Math.cos(am)*(radius-20),cy+Math.sin(am)*(radius-20));
        ctx.font='10px ui-monospace, monospace';ctx.fillStyle='rgba(255,255,255,.42)';
        ctx.fillText(VOICES[i],cx+Math.cos(am)*(radius-42),cy+Math.sin(am)*(radius-42));
      }

      ctx.beginPath();ctx.arc(cx,cy,HIT_RADIUS,0,Math.PI*2);ctx.strokeStyle='#daff00';ctx.lineWidth=2;ctx.stroke();
      ctx.beginPath();ctx.arc(cx,cy,HIT_RADIUS+12,0,Math.PI*2);ctx.strokeStyle='rgba(218,255,0,.28)';ctx.lineWidth=1;ctx.stroke();

      const survivors:Note[]=[];
      for (const note of notesRef.current) {
        const remaining=note.hitAt-now;
        if (!note.judged&&remaining<-GOOD_WINDOW) {
          note.judged=true; setCombo(0); setAccuracy(a=>({...a,miss:a.miss+1})); setStatus(`${LABELS[note.sector]} // MISS`);
        }
        if (note.judged&&remaining<-300) continue;
        survivors.push(note);
        const progress=Math.max(0,Math.min(1,1-remaining/TRAVEL_MS));
        const r=radius-34-progress*(radius-34-HIT_RADIUS);
        const am=-Math.PI/2+(note.sector+0.5)*wedge;
        const x=cx+Math.cos(am)*r,y=cy+Math.sin(am)*r,size=9+progress*8;
        ctx.save();ctx.translate(Math.round(x),Math.round(y));ctx.rotate(am+Math.PI/4);
        ctx.fillStyle=note.hit?'rgba(218,255,0,.18)':'#daff00';ctx.fillRect(-size/2,-size/2,size,size);
        if (!note.hit) {ctx.fillStyle='#050505';ctx.fillRect(-2.5,-2.5,5,5);} ctx.restore();
      }
      notesRef.current=survivors;

      pulsesRef.current=pulsesRef.current.filter(p=>{
        p.life-=dt*0.006;if (p.life<=0) return false;
        const a0=-Math.PI/2+p.sector*wedge,a1=a0+wedge;
        ctx.beginPath();ctx.moveTo(cx,cy);ctx.arc(cx,cy,HIT_RADIUS+38*(1-p.life),a0,a1);ctx.closePath();
        ctx.fillStyle=`rgba(218,255,0,${p.life*0.5*p.strength})`;ctx.fill();return true;
      });

      const beatPhase=((now-startTimeRef.current)%STEP_MS)/STEP_MS;
      ctx.beginPath();ctx.arc(cx,cy,18+(runningRef.current?(1-beatPhase)*8:0),0,Math.PI*2);ctx.fillStyle='#daff00';ctx.fill();
      ctx.beginPath();ctx.arc(cx,cy,6,0,Math.PI*2);ctx.fillStyle='#050505';ctx.fill();
      raf=requestAnimationFrame(draw);
    };
    raf=requestAnimationFrame(draw);
    return()=>{cancelAnimationFrame(raf);ro.disconnect();};
  },[]);

  const total=accuracy.perfect+accuracy.good+accuracy.miss;
  const hitPct=total?Math.round(((accuracy.perfect+accuracy.good)/total)*100):100;

  return (
    <main style={{minHeight:'100vh',background:'#050505',color:'#daff00',fontFamily:'ui-monospace, SFMono-Regular, Menlo, monospace',padding:18}}>
      <div style={{maxWidth:1180,margin:'0 auto'}}>
        <div style={{display:'flex',justifyContent:'space-between',gap:16,flexWrap:'wrap',marginBottom:12,fontSize:12,letterSpacing:'.12em'}}>
          <span>HARIL OS // OBAS BEAT DEFENSE</span>
          <span>SCORE {String(score).padStart(6,'0')} // COMBO {combo} // BEST {bestCombo}</span>
        </div>
        <div style={{border:'1px solid #313131',background:'#000'}}>
          <canvas ref={canvasRef} style={{width:'100%',height:'min(68vw,680px)',minHeight:420,display:'block'}} />
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(8,minmax(44px,1fr))',gap:8,marginTop:10}}>
          {LABELS.map((label,i)=><button key={label} onClick={()=>judgeSector(i)} style={{minHeight:44,border:'1px solid #daff00',background:'#050505',color:'#daff00',font:'inherit',cursor:'pointer'}}>{label}</button>)}
        </div>
        <div style={{display:'flex',gap:10,flexWrap:'wrap',marginTop:10,alignItems:'center'}}>
          <button onClick={toggleRun} style={{minHeight:46,padding:'0 18px',border:'1px solid #daff00',background:running?'#daff00':'#050505',color:running?'#050505':'#daff00',font:'inherit',cursor:'pointer'}}>{running?'PAUSE':'START'}</button>
          <div style={{border:'1px solid #313131',padding:'13px 14px',color:'#eee',fontSize:12}}>LAST {lastKey} // HIT {hitPct}%</div>
          <div style={{flex:'1 1 280px',minHeight:46,border:'1px solid #313131',display:'flex',alignItems:'center',padding:'0 14px',color:'#eee',fontSize:12}}>{status}</div>
        </div>
        <p style={{color:'#8c8c8c',fontSize:12,lineHeight:1.5,marginTop:10}}>Press A S D F J K L ; as incoming tiles reach the center ring. SPACE starts or pauses the beat run.</p>
      </div>
    </main>
  );
}
