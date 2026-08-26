'use client';

import { useEffect, useRef, useState } from 'react';

const SECTORS = 8;
const STEPS = 16;
const DRUMS = ['KICK','SNARE','CLOSED HAT','OPEN HAT','CLAP','TOM','PERC','FX'];
const DRUM_COLORS = ['#daff00','#ff5a36','#f2f2f2','#6ee7ff','#ff85d7','#ffcf40','#b6ff7a','#a890ff'];
const BASS_NOTES = ['C2','D2','EB2','F2','G2','AB2','BB2','C3'];
const BASS_FREQS = [65.41,73.42,77.78,87.31,98.0,103.83,116.54,130.81];
const TRACKS = [...DRUMS,'BASS'];

type Screen = 'DRUM' | 'BASS' | 'MIXER';
type DrumGrid = boolean[][];
type TrackMix = { vol:number; hpf:number; lpf:number };
type TrackNodes = { hpf:BiquadFilterNode; lpf:BiquadFilterNode; gain:GainNode };
type AudioRack = {
  ctx: AudioContext;
  tracks: TrackNodes[];
  masterIn: GainNode;
  delaySend: GainNode;
  spaceSend: GainNode;
  masterGain: GainNode;
};

function blankDrums(): DrumGrid {
  return Array.from({ length: STEPS }, () => Array(SECTORS).fill(false));
}

function starterDrums(): DrumGrid {
  const g = blankDrums();
  [0,4,8,12].forEach(s => g[s][0] = true);
  [4,12].forEach(s => g[s][1] = true);
  for (let s=0;s<STEPS;s+=2) g[s][2] = true;
  g[7][4] = true;
  g[15][5] = true;
  return g;
}

function starterBass(): number[] {
  const b = Array(STEPS).fill(-1);
  b[0]=0; b[3]=0; b[6]=4; b[8]=3; b[11]=4; b[14]=1;
  return b;
}

function defaultMix(): TrackMix[] {
  return TRACKS.map((_,i) => ({
    vol: i === 8 ? 0.72 : i === 0 ? 0.8 : 0.62,
    hpf: i === 0 || i === 5 || i === 8 ? 30 : i === 1 ? 90 : 180,
    lpf: i === 0 ? 4200 : i === 8 ? 3600 : 12000,
  }));
}

export default function ObasPolarInstrumentPage() {
  const canvasRef = useRef<HTMLCanvasElement|null>(null);
  const audioRackRef = useRef<AudioRack|null>(null);
  const drumRef = useRef<DrumGrid>(starterDrums());
  const bassRef = useRef<number[]>(starterBass());
  const mixRef = useRef<TrackMix[]>(defaultMix());
  const runningRef = useRef(false);
  const bpmRef = useRef(112);
  const phaseRef = useRef(0);
  const startTimeRef = useRef(0);
  const lastStepRef = useRef(-1);
  const dragModeRef = useRef<boolean|null>(null);
  const lastCellRef = useRef('');
  const masterVolRef = useRef(0.32);
  const delayRef = useRef(0.10);
  const spaceRef = useRef(0.08);
  const bassCutoffRef = useRef(720);
  const bassResRef = useRef(7.5);
  const bassDecayRef = useRef(0.22);

  const [screen,setScreen] = useState<Screen>('DRUM');
  const [running,setRunning] = useState(false);
  const [bpm,setBpm] = useState(112);
  const [masterVol,setMasterVol] = useState(0.32);
  const [delaySend,setDelaySend] = useState(0.10);
  const [spaceSend,setSpaceSend] = useState(0.08);
  const [bassCutoff,setBassCutoff] = useState(720);
  const [bassRes,setBassRes] = useState(7.5);
  const [bassDecay,setBassDecay] = useState(0.22);
  const [trackMix,setTrackMix] = useState<TrackMix[]>(defaultMix());
  const [status,setStatus] = useState('DRUM VORTEX // PAINT THE FIELD');
  const [,force] = useState(0);

  function createImpulse(ctx:AudioContext, seconds=1.3) {
    const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    const buffer = ctx.createBuffer(2,length,ctx.sampleRate);
    for (let ch=0;ch<2;ch++) {
      const data = buffer.getChannelData(ch);
      for (let i=0;i<length;i++) {
        const env = Math.pow(1-i/length,2.6);
        data[i] = (Math.random()*2-1)*env;
      }
    }
    return buffer;
  }

  function ensureAudio() {
    if (audioRackRef.current) {
      if (audioRackRef.current.ctx.state === 'suspended') audioRackRef.current.ctx.resume();
      return audioRackRef.current;
    }
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return null;
    const ctx:AudioContext = new Ctx();

    const masterIn = ctx.createGain();
    const safetyHP1 = ctx.createBiquadFilter();
    const safetyHP2 = ctx.createBiquadFilter();
    const safetyLP1 = ctx.createBiquadFilter();
    const safetyLP2 = ctx.createBiquadFilter();
    const limiter = ctx.createDynamicsCompressor();
    const masterGain = ctx.createGain();

    safetyHP1.type='highpass'; safetyHP1.frequency.value=30; safetyHP1.Q.value=0.707;
    safetyHP2.type='highpass'; safetyHP2.frequency.value=30; safetyHP2.Q.value=0.707;
    safetyLP1.type='lowpass'; safetyLP1.frequency.value=12000; safetyLP1.Q.value=0.707;
    safetyLP2.type='lowpass'; safetyLP2.frequency.value=12000; safetyLP2.Q.value=0.707;
    limiter.threshold.value=-10;
    limiter.knee.value=4;
    limiter.ratio.value=16;
    limiter.attack.value=0.003;
    limiter.release.value=0.14;
    masterGain.gain.value=masterVolRef.current;

    masterIn.connect(safetyHP1).connect(safetyHP2).connect(safetyLP1).connect(safetyLP2).connect(limiter).connect(masterGain).connect(ctx.destination);

    const delaySend = ctx.createGain();
    const delay = ctx.createDelay(1);
    const delayFeedback = ctx.createGain();
    const delayReturn = ctx.createGain();
    delaySend.gain.value=delayRef.current;
    delay.delayTime.value=0.19;
    delayFeedback.gain.value=0.24;
    delayReturn.gain.value=0.32;
    delaySend.connect(delay);
    delay.connect(delayFeedback).connect(delay);
    delay.connect(delayReturn).connect(masterIn);

    const spaceSend = ctx.createGain();
    const verb = ctx.createConvolver();
    const verbReturn = ctx.createGain();
    spaceSend.gain.value=spaceRef.current;
    verb.buffer=createImpulse(ctx);
    verbReturn.gain.value=0.24;
    spaceSend.connect(verb).connect(verbReturn).connect(masterIn);

    const tracks = mixRef.current.map((m) => {
      const hpf=ctx.createBiquadFilter();
      const lpf=ctx.createBiquadFilter();
      const gain=ctx.createGain();
      hpf.type='highpass'; hpf.frequency.value=m.hpf; hpf.Q.value=0.707;
      lpf.type='lowpass'; lpf.frequency.value=m.lpf; lpf.Q.value=0.707;
      gain.gain.value=m.vol;
      hpf.connect(lpf).connect(gain);
      gain.connect(masterIn);
      gain.connect(delaySend);
      gain.connect(spaceSend);
      return {hpf,lpf,gain};
    });

    audioRackRef.current={ctx,tracks,masterIn,delaySend,spaceSend,masterGain};
    return audioRackRef.current;
  }

  function noiseBuffer(ctx:AudioContext, seconds:number) {
    const b=ctx.createBuffer(1,Math.max(1,Math.floor(ctx.sampleRate*seconds)),ctx.sampleRate);
    const d=b.getChannelData(0);
    for (let i=0;i<d.length;i++) d[i]=Math.random()*2-1;
    return b;
  }

  function playDrum(sector:number) {
    const rack=ensureAudio();
    if (!rack) return;
    const {ctx}=rack;
    const out=rack.tracks[sector].hpf;
    const now=ctx.currentTime;

    if (sector===0) {
      const osc=ctx.createOscillator(); const gain=ctx.createGain();
      osc.type='sine';
      osc.frequency.setValueAtTime(130,now);
      osc.frequency.exponentialRampToValueAtTime(44,now+0.14);
      gain.gain.setValueAtTime(0.42,now);
      gain.gain.exponentialRampToValueAtTime(0.0001,now+0.18);
      osc.connect(gain).connect(out); osc.start(now); osc.stop(now+0.19); return;
    }

    if ([1,2,3,4,6].includes(sector)) {
      const src=ctx.createBufferSource(); const filter=ctx.createBiquadFilter(); const gain=ctx.createGain();
      const dur=sector===2?0.04:sector===3?0.14:0.10;
      src.buffer=noiseBuffer(ctx,dur);
      filter.type=sector===2||sector===3?'highpass':'bandpass';
      filter.frequency.value=sector===2?6500:sector===3?4800:sector===1?1600:1000+sector*160;
      filter.Q.value=0.9;
      gain.gain.setValueAtTime(sector===2?0.12:0.20,now);
      gain.gain.exponentialRampToValueAtTime(0.0001,now+dur);
      src.connect(filter).connect(gain).connect(out); src.start(now); return;
    }

    const osc=ctx.createOscillator(); const gain=ctx.createGain();
    osc.type=sector===5?'triangle':'square';
    osc.frequency.setValueAtTime(sector===5?180:480,now);
    osc.frequency.exponentialRampToValueAtTime(sector===5?92:170,now+0.12);
    gain.gain.setValueAtTime(sector===5?0.20:0.09,now);
    gain.gain.exponentialRampToValueAtTime(0.0001,now+0.16);
    osc.connect(gain).connect(out); osc.start(now); osc.stop(now+0.17);
  }

  function playBass(sector:number) {
    const rack=ensureAudio();
    if (!rack) return;
    const {ctx}=rack;
    const now=ctx.currentTime;
    const osc=ctx.createOscillator();
    const filter=ctx.createBiquadFilter();
    const gain=ctx.createGain();
    const freq=Math.max(40,Math.min(400,BASS_FREQS[sector]));
    const cutoff=Math.max(180,Math.min(2400,bassCutoffRef.current));
    const decay=Math.max(0.08,Math.min(0.42,bassDecayRef.current));
    osc.type='sawtooth';
    osc.frequency.setValueAtTime(freq,now);
    filter.type='lowpass';
    filter.Q.value=Math.max(1,Math.min(12,bassResRef.current));
    filter.frequency.setValueAtTime(Math.max(140,cutoff*0.45),now);
    filter.frequency.exponentialRampToValueAtTime(cutoff,now+0.025);
    filter.frequency.exponentialRampToValueAtTime(Math.max(140,cutoff*0.32),now+decay);
    gain.gain.setValueAtTime(0.18,now);
    gain.gain.exponentialRampToValueAtTime(0.0001,now+decay+0.03);
    osc.connect(filter).connect(gain).connect(rack.tracks[8].hpf);
    osc.start(now); osc.stop(now+decay+0.05);
  }

  function triggerStep(step:number) {
    let hits=0;
    drumRef.current[step].forEach((on,sector)=>{ if(on){hits++;playDrum(sector);} });
    const bass=bassRef.current[step];
    if (bass>=0) { hits++; playBass(bass); }
    setStatus(`STEP ${String(step+1).padStart(2,'0')} // ${hits?`${hits} EVENT${hits===1?'':'S'}`:'SILENCE'}`);
  }

  useEffect(()=>{
    let raf=0;
    const tick=(now:number)=>{
      const stepMs=60000/bpmRef.current/4;
      if (runningRef.current) phaseRef.current=(now-startTimeRef.current)/stepMs;
      const abs=Math.floor(phaseRef.current);
      if (runningRef.current && abs>lastStepRef.current) {
        while(lastStepRef.current<abs) {
          lastStepRef.current++;
          triggerStep(((lastStepRef.current%STEPS)+STEPS)%STEPS);
        }
      }
      raf=requestAnimationFrame(tick);
    };
    raf=requestAnimationFrame(tick);
    return()=>cancelAnimationFrame(raf);
  },[]);

  function toggleRun() {
    ensureAudio();
    const next=!runningRef.current;
    runningRef.current=next; setRunning(next);
    const stepMs=60000/bpmRef.current/4;
    if(next){
      startTimeRef.current=performance.now()-phaseRef.current*stepMs;
      lastStepRef.current=Math.floor(phaseRef.current)-1;
      setStatus('RUNNING // PAINT WHILE IT MOVES');
    } else setStatus('PAUSED // PATTERN HELD');
  }

  function changeBpm(v:number) {
    const next=Math.max(40,Math.min(220,v||112));
    bpmRef.current=next; setBpm(next);
    if(runningRef.current){
      const stepMs=60000/next/4;
      startTimeRef.current=performance.now()-phaseRef.current*stepMs;
      lastStepRef.current=Math.floor(phaseRef.current)-1;
    }
  }

  function updateMaster(v:number) {
    const next=Math.max(0,Math.min(0.6,v));
    masterVolRef.current=next; setMasterVol(next);
    const rack=audioRackRef.current;
    if(rack) rack.masterGain.gain.setTargetAtTime(next,rack.ctx.currentTime,0.025);
  }

  function updateDelay(v:number) {
    const next=Math.max(0,Math.min(0.35,v)); delayRef.current=next; setDelaySend(next);
    const rack=audioRackRef.current; if(rack) rack.delaySend.gain.setTargetAtTime(next,rack.ctx.currentTime,0.03);
  }

  function updateSpace(v:number) {
    const next=Math.max(0,Math.min(0.35,v)); spaceRef.current=next; setSpaceSend(next);
    const rack=audioRackRef.current; if(rack) rack.spaceSend.gain.setTargetAtTime(next,rack.ctx.currentTime,0.03);
  }

  function updateTrack(index:number,key:keyof TrackMix,value:number) {
    const next=mixRef.current.map(x=>({...x}));
    const m=next[index];
    if(key==='vol') m.vol=Math.max(0,Math.min(1,value));
    if(key==='hpf') m.hpf=Math.max(30,Math.min(Math.min(1000,m.lpf-120),value));
    if(key==='lpf') m.lpf=Math.max(Math.max(1200,m.hpf+120),Math.min(12000,value));
    mixRef.current=next; setTrackMix(next);
    const rack=audioRackRef.current;
    if(rack){
      const n=rack.tracks[index]; const t=rack.ctx.currentTime;
      n.gain.gain.setTargetAtTime(m.vol,t,0.025);
      n.hpf.frequency.setTargetAtTime(m.hpf,t,0.025);
      n.lpf.frequency.setTargetAtTime(m.lpf,t,0.025);
    }
  }

  function clearCurrent() {
    if(screen==='DRUM') drumRef.current=blankDrums();
    if(screen==='BASS') bassRef.current=Array(STEPS).fill(-1);
    force(v=>v+1); setStatus(`${screen} FIELD CLEARED`);
  }

  useEffect(()=>{
    if(screen==='MIXER') return;
    const canvas=canvasRef.current; if(!canvas) return;
    const ctx=canvas.getContext('2d'); if(!ctx) return;
    let raf=0;
    const resize=()=>{
      const r=canvas.getBoundingClientRect(); const dpr=Math.min(window.devicePixelRatio||1,2);
      canvas.width=Math.max(1,Math.floor(r.width*dpr)); canvas.height=Math.max(1,Math.floor(r.height*dpr));
      ctx.setTransform(dpr,0,0,dpr,0,0);
    };
    resize(); const ro=new ResizeObserver(resize); ro.observe(canvas);

    const geometry=()=>{
      const w=canvas.clientWidth,h=canvas.clientHeight,cx=w/2,cy=h/2;
      const outer=Math.max(155,Math.min(w,h)*0.43),inner=Math.max(42,outer*0.14);
      return {w,h,cx,cy,outer,inner,wedge:Math.PI*2/SECTORS};
    };
    const ringRadius=(step:number,phase:number,inner:number,outer:number)=>{
      const delta=((step-phase)%STEPS+STEPS)%STEPS;
      return inner+(delta/(STEPS-1))*(outer-inner);
    };
    const wedgePath=(rr:number,sector:number,band:number,cx:number,cy:number,wedge:number)=>{
      const a0=-Math.PI/2+sector*wedge+0.025, a1=a0+wedge-0.05;
      ctx.beginPath();
      ctx.arc(cx,cy,rr+band,a0,a1);
      ctx.arc(cx,cy,Math.max(1,rr-band),a1,a0,true);
      ctx.closePath();
    };

    const paint=(event:PointerEvent,first=false)=>{
      const rect=canvas.getBoundingClientRect(); const x=event.clientX-rect.left,y=event.clientY-rect.top;
      const {cx,cy,outer,inner,wedge}=geometry();
      const dx=x-cx,dy=y-cy,radial=Math.hypot(dx,dy);
      if(radial<inner*0.72||radial>outer+14) return;
      let angle=Math.atan2(dy,dx)+Math.PI/2; if(angle<0) angle+=Math.PI*2;
      const sector=Math.min(SECTORS-1,Math.floor(angle/wedge));
      let best=0,dist=Infinity;
      for(let s=0;s<STEPS;s++){const rr=ringRadius(s,phaseRef.current,inner,outer);const d=Math.abs(rr-radial);if(d<dist){dist=d;best=s;}}
      if(dist>Math.max(16,(outer-inner)/STEPS*0.72)) return;
      const key=`${best}:${sector}`; if(!first&&key===lastCellRef.current)return; lastCellRef.current=key;
      if(screen==='DRUM'){
        if(first||dragModeRef.current===null) dragModeRef.current=!drumRef.current[best][sector];
        drumRef.current[best][sector]=Boolean(dragModeRef.current);
        if(dragModeRef.current) playDrum(sector);
      } else {
        const erase=bassRef.current[best]===sector;
        bassRef.current[best]=erase?-1:sector;
        if(!erase) playBass(sector);
      }
      force(v=>v+1);
    };
    const onDown=(e:PointerEvent)=>{canvas.setPointerCapture(e.pointerId);dragModeRef.current=null;lastCellRef.current='';paint(e,true);};
    const onMove=(e:PointerEvent)=>{if(canvas.hasPointerCapture(e.pointerId))paint(e,false);};
    const onUp=(e:PointerEvent)=>{if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);dragModeRef.current=null;lastCellRef.current='';};
    canvas.addEventListener('pointerdown',onDown);canvas.addEventListener('pointermove',onMove);canvas.addEventListener('pointerup',onUp);canvas.addEventListener('pointercancel',onUp);

    const draw=()=>{
      const {w,h,cx,cy,outer,inner,wedge}=geometry(); const phase=phaseRef.current;
      ctx.fillStyle='#050505';ctx.fillRect(0,0,w,h);
      const labels=screen==='DRUM'?DRUMS:BASS_NOTES;
      for(let s=0;s<SECTORS;s++){
        const a0=-Math.PI/2+s*wedge,am=a0+wedge/2;
        ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx+Math.cos(a0)*outer,cy+Math.sin(a0)*outer);
        ctx.strokeStyle='rgba(255,255,255,.12)';ctx.lineWidth=1;ctx.stroke();
        ctx.fillStyle=screen==='DRUM'?DRUM_COLORS[s]:'#daff00';ctx.font='700 11px ui-monospace, monospace';ctx.textAlign='center';
        ctx.fillText(labels[s],cx+Math.cos(am)*(outer+28),cy+Math.sin(am)*(outer+28));
      }
      for(let s=0;s<STEPS;s++){
        const rr=ringRadius(s,phase,inner,outer);const band=Math.max(5,(outer-inner)/STEPS*0.34);
        ctx.beginPath();ctx.arc(cx,cy,rr,0,Math.PI*2);ctx.strokeStyle=s%4===0?'rgba(218,255,0,.34)':'rgba(255,255,255,.12)';ctx.lineWidth=s%4===0?1.6:1;ctx.stroke();
        if(screen==='DRUM'){
          const bs=bassRef.current[s];
          if(bs>=0){wedgePath(rr,bs,band,cx,cy,wedge);ctx.strokeStyle='rgba(218,255,0,.28)';ctx.lineWidth=2;ctx.setLineDash([4,4]);ctx.stroke();ctx.setLineDash([]);}
          for(let v=0;v<SECTORS;v++)if(drumRef.current[s][v]){wedgePath(rr,v,band,cx,cy,wedge);ctx.fillStyle=DRUM_COLORS[v];ctx.globalAlpha=.84;ctx.fill();ctx.globalAlpha=1;}
        } else {
          for(let v=0;v<SECTORS;v++)if(drumRef.current[s][v]){wedgePath(rr,v,band,cx,cy,wedge);ctx.strokeStyle=DRUM_COLORS[v];ctx.globalAlpha=.22;ctx.lineWidth=1.2;ctx.stroke();ctx.globalAlpha=1;}
          const bs=bassRef.current[s];
          if(bs>=0){wedgePath(rr,bs,band,cx,cy,wedge);ctx.fillStyle='#daff00';ctx.globalAlpha=.9;ctx.fill();ctx.globalAlpha=1;}
        }
      }
      ctx.beginPath();ctx.arc(cx,cy,inner,0,Math.PI*2);ctx.fillStyle='#050505';ctx.fill();ctx.strokeStyle='#daff00';ctx.lineWidth=3;ctx.stroke();
      const pulse=runningRef.current?1-(phase-Math.floor(phase)):0;
      ctx.beginPath();ctx.arc(cx,cy,Math.max(8,inner*.34+pulse*5),0,Math.PI*2);ctx.fillStyle='#daff00';ctx.fill();
      ctx.fillStyle='rgba(255,255,255,.55)';ctx.font='10px ui-monospace, monospace';ctx.textAlign='center';ctx.fillText(`${Math.round(bpmRef.current)} BPM`,cx,cy+3);
      raf=requestAnimationFrame(draw);
    };
    raf=requestAnimationFrame(draw);
    return()=>{cancelAnimationFrame(raf);ro.disconnect();canvas.removeEventListener('pointerdown',onDown);canvas.removeEventListener('pointermove',onMove);canvas.removeEventListener('pointerup',onUp);canvas.removeEventListener('pointercancel',onUp);};
  },[screen]);

  const tabStyle=(active:boolean)=>({minHeight:42,padding:'0 18px',border:'1px solid #3a3a3a',background:active?'#daff00':'#050505',color:active?'#050505':'#daff00',font:'inherit',cursor:'pointer'} as React.CSSProperties);
  const rangeStyle={accentColor:'#daff00'} as React.CSSProperties;

  return (
    <main style={{minHeight:'100vh',background:'#050505',color:'#daff00',fontFamily:'ui-monospace, SFMono-Regular, Menlo, monospace',padding:18,paddingBottom:170}}>
      <div style={{maxWidth:1180,margin:'0 auto'}}>
        <div style={{display:'flex',justifyContent:'space-between',gap:16,flexWrap:'wrap',marginBottom:10,fontSize:12,letterSpacing:'.12em'}}>
          <span>MZCMG // SONIC LAB // POLAR INSTRUMENT</span><span>DRUM + BASS + MIXER</span>
        </div>

        <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:10}}>
          {(['DRUM','BASS','MIXER'] as Screen[]).map(s=><button key={s} onClick={()=>{setScreen(s);setStatus(`${s} VIEW`);}} style={tabStyle(screen===s)}>{s}</button>)}
          {screen!=='MIXER' && <button onClick={clearCurrent} style={{...tabStyle(false),marginLeft:'auto'}}>CLEAR {screen}</button>}
        </div>

        {screen==='BASS' && <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))',gap:8,marginBottom:10}}>
          <label style={{border:'1px solid #292929',padding:10,fontSize:11}}>CUTOFF {Math.round(bassCutoff)} Hz<input type='range' min='180' max='2400' step='10' value={bassCutoff} onChange={e=>{const v=Number(e.target.value);bassCutoffRef.current=v;setBassCutoff(v);}} style={{...rangeStyle,width:'100%'}}/></label>
          <label style={{border:'1px solid #292929',padding:10,fontSize:11}}>RESONANCE {bassRes.toFixed(1)}<input type='range' min='1' max='12' step='.1' value={bassRes} onChange={e=>{const v=Number(e.target.value);bassResRef.current=v;setBassRes(v);}} style={{...rangeStyle,width:'100%'}}/></label>
          <label style={{border:'1px solid #292929',padding:10,fontSize:11}}>DECAY {bassDecay.toFixed(2)} s<input type='range' min='.08' max='.42' step='.01' value={bassDecay} onChange={e=>{const v=Number(e.target.value);bassDecayRef.current=v;setBassDecay(v);}} style={{...rangeStyle,width:'100%'}}/></label>
        </div>}

        {screen!=='MIXER' ? <div style={{border:'1px solid #313131',background:'#000'}}>
          <canvas ref={canvasRef} style={{width:'100%',height:'min(72vw,760px)',minHeight:460,display:'block',touchAction:'none',cursor:'crosshair'}} />
        </div> : <div style={{border:'1px solid #313131',background:'#080808',padding:14}}>
          <div style={{fontSize:11,letterSpacing:'.12em',marginBottom:12,color:'#a8a8a8'}}>TRACK MIXER // SIMPLE ROLL-OFF EQ + LEVEL</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))',gap:10}}>
            {trackMix.map((m,i)=><div key={TRACKS[i]} style={{border:'1px solid #2d2d2d',padding:10,minHeight:310,display:'flex',flexDirection:'column',alignItems:'center',gap:10}}>
              <div style={{fontSize:11,textAlign:'center',minHeight:28,color:i===8?'#daff00':DRUM_COLORS[i]}}>{TRACKS[i]}</div>
              <Knob label='LOW CUT' min={30} max={1000} value={m.hpf} onChange={v=>updateTrack(i,'hpf',v)} />
              <Knob label='HIGH CUT' min={1200} max={12000} value={m.lpf} onChange={v=>updateTrack(i,'lpf',v)} />
              <div style={{height:135,display:'flex',alignItems:'center',justifyContent:'center'}}>
                <input aria-label={`${TRACKS[i]} volume`} type='range' min='0' max='1' step='.01' value={m.vol} onChange={e=>updateTrack(i,'vol',Number(e.target.value))} style={{...rangeStyle,width:120,transform:'rotate(-90deg)'}} />
              </div>
              <div style={{fontSize:10,color:'#8b8b8b'}}>VOL {Math.round(m.vol*100)}</div>
            </div>)}
          </div>
        </div>}

        <div style={{marginTop:8,fontSize:11,color:'#858585'}}>{status}</div>
      </div>

      <div style={{position:'sticky',bottom:0,margin:'24px -18px -18px',background:'rgba(5,5,5,.96)',borderTop:'1px solid #3b3b3b',padding:'10px 18px',backdropFilter:'blur(8px)',zIndex:20}}>
        <div style={{maxWidth:1180,margin:'0 auto',display:'flex',gap:12,alignItems:'center',flexWrap:'wrap'}}>
          <button onClick={toggleRun} style={{minHeight:46,padding:'0 20px',border:'1px solid #daff00',background:running?'#daff00':'#050505',color:running?'#050505':'#daff00',font:'inherit',cursor:'pointer'}}>{running?'PAUSE':'PLAY'}</button>
          <label style={{fontSize:10,minWidth:140}}>BPM {bpm}<input type='range' min='40' max='220' value={bpm} onChange={e=>changeBpm(Number(e.target.value))} style={{...rangeStyle,width:'100%'}}/></label>
          <label style={{fontSize:10,minWidth:140}}>MASTER {Math.round(masterVol/0.6*100)}<input type='range' min='0' max='.6' step='.01' value={masterVol} onChange={e=>updateMaster(Number(e.target.value))} style={{...rangeStyle,width:'100%'}}/></label>
          <label style={{fontSize:10,minWidth:130}}>DELAY SEND {Math.round(delaySend/0.35*100)}<input type='range' min='0' max='.35' step='.01' value={delaySend} onChange={e=>updateDelay(Number(e.target.value))} style={{...rangeStyle,width:'100%'}}/></label>
          <label style={{fontSize:10,minWidth:130}}>SPACE SEND {Math.round(spaceSend/0.35*100)}<input type='range' min='0' max='.35' step='.01' value={spaceSend} onChange={e=>updateSpace(Number(e.target.value))} style={{...rangeStyle,width:'100%'}}/></label>
          <span style={{fontSize:9,color:'#686868',marginLeft:'auto'}}>SAFE BUS // 30 Hz–12 kHz</span>
        </div>
      </div>
    </main>
  );
}

function Knob({label,min,max,value,onChange}:{label:string;min:number;max:number;value:number;onChange:(v:number)=>void}) {
  const pct=(value-min)/(max-min);
  const angle=-135+pct*270;
  return <label style={{display:'flex',flexDirection:'column',alignItems:'center',gap:5,fontSize:9,color:'#8b8b8b'}}>
    <span>{label}</span>
    <span style={{width:44,height:44,border:'1px solid #555',borderRadius:'50%',position:'relative',display:'block',background:'#101010'}}>
      <span style={{position:'absolute',left:'50%',top:'50%',width:1,height:15,background:'#daff00',transformOrigin:'50% 0%',transform:`rotate(${angle}deg) translateY(-14px)`}} />
    </span>
    <input aria-label={label} type='range' min={min} max={max} step={label==='LOW CUT'?5:50} value={value} onChange={e=>onChange(Number(e.target.value))} style={{width:82,accentColor:'#daff00'}} />
    <span>{Math.round(value)} Hz</span>
  </label>;
}
