'use client';

import { useEffect, useRef, useState } from 'react';

const SECTORS = 8;
const STEPS = 16;
const VOICES = ['KICK','SNARE','CLOSED HAT','OPEN HAT','CLAP','TOM','PERC','FX'];
const COLORS = ['#daff00','#ff5a36','#f2f2f2','#6ee7ff','#ff85d7','#ffcf40','#b6ff7a','#a890ff'];

type Grid = boolean[][];

function blankGrid(): Grid {
  return Array.from({ length: STEPS }, () => Array(SECTORS).fill(false));
}

function starterGrid(): Grid {
  const g = blankGrid();
  [0,4,8,12].forEach((s) => g[s][0] = true);
  [4,12].forEach((s) => g[s][1] = true);
  for (let s = 0; s < STEPS; s += 2) g[s][2] = true;
  g[7][4] = true;
  g[15][5] = true;
  return g;
}

export default function ObasPolarSequencerPage() {
  const canvasRef = useRef<HTMLCanvasElement|null>(null);
  const audioRef = useRef<AudioContext|null>(null);
  const gridRef = useRef<Grid>(starterGrid());
  const runningRef = useRef(false);
  const bpmRef = useRef(112);
  const phaseRef = useRef(0);
  const startTimeRef = useRef(0);
  const lastStepRef = useRef(-1);
  const dragModeRef = useRef<boolean|null>(null);
  const lastCellRef = useRef('');

  const [running,setRunning] = useState(false);
  const [bpm,setBpm] = useState(112);
  const [status,setStatus] = useState('PAINT THE FIELD // PRESS PLAY');
  const [,force] = useState(0);

  function ensureAudio() {
    if (!audioRef.current) {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (Ctx) audioRef.current = new Ctx();
    }
    if (audioRef.current?.state === 'suspended') audioRef.current.resume();
    return audioRef.current;
  }

  function noiseBuffer(ctx: AudioContext, seconds: number) {
    const b = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * seconds)), ctx.sampleRate);
    const data = b.getChannelData(0);
    for (let i=0;i<data.length;i++) data[i] = Math.random()*2-1;
    return b;
  }

  function playVoice(sector: number) {
    const ctx = ensureAudio();
    if (!ctx) return;
    const now = ctx.currentTime;

    if (sector === 0) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(135, now);
      osc.frequency.exponentialRampToValueAtTime(42, now + 0.16);
      gain.gain.setValueAtTime(0.9, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now); osc.stop(now + 0.21);
      return;
    }

    if ([1,2,3,4,6].includes(sector)) {
      const src = ctx.createBufferSource();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      const dur = sector === 2 ? 0.045 : sector === 3 ? 0.16 : 0.11;
      src.buffer = noiseBuffer(ctx, dur);
      filter.type = sector === 2 || sector === 3 ? 'highpass' : 'bandpass';
      filter.frequency.value = sector === 2 ? 7000 : sector === 3 ? 5200 : sector === 1 ? 1700 : 1100 + sector*180;
      filter.Q.value = 0.9;
      gain.gain.setValueAtTime(sector === 2 ? 0.24 : 0.42, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      src.connect(filter).connect(gain).connect(ctx.destination);
      src.start(now);
      return;
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = sector === 5 ? 'triangle' : 'square';
    osc.frequency.setValueAtTime(sector === 5 ? 190 : 520, now);
    osc.frequency.exponentialRampToValueAtTime(sector === 5 ? 88 : 160, now + 0.14);
    gain.gain.setValueAtTime(sector === 5 ? 0.42 : 0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now); osc.stop(now + 0.19);
  }

  function triggerStep(step: number) {
    let count = 0;
    gridRef.current[step].forEach((on, sector) => {
      if (on) { count++; playVoice(sector); }
    });
    setStatus(count ? `STEP ${String(step+1).padStart(2,'0')} // ${count} VOICE${count===1?'':'S'}` : `STEP ${String(step+1).padStart(2,'0')} // SILENCE`);
  }

  function toggleRun() {
    ensureAudio();
    const next = !runningRef.current;
    runningRef.current = next;
    setRunning(next);
    const stepMs = 60000 / bpmRef.current / 4;
    if (next) {
      startTimeRef.current = performance.now() - phaseRef.current * stepMs;
      lastStepRef.current = Math.floor(phaseRef.current)-1;
      setStatus('RUNNING // PAINT WHILE IT MOVES');
    } else {
      setStatus('PAUSED // PATTERN HELD');
    }
  }

  function changeBpm(v: number) {
    const next = Math.max(40, Math.min(220, v || 112));
    bpmRef.current = next;
    setBpm(next);
    if (runningRef.current) {
      const stepMs = 60000 / next / 4;
      startTimeRef.current = performance.now() - phaseRef.current * stepMs;
      lastStepRef.current = Math.floor(phaseRef.current)-1;
    }
  }

  function clearGrid() {
    gridRef.current = blankGrid();
    force(v => v+1);
    setStatus('FIELD CLEARED');
  }

  function mutateGrid() {
    const g = blankGrid();
    for (let s=0;s<STEPS;s++) for (let v=0;v<SECTORS;v++) {
      const density = v===2 ? 0.34 : v<2 ? 0.2 : 0.1;
      g[s][v] = Math.random() < density;
    }
    gridRef.current = g;
    force(v => v+1);
    setStatus('FIELD MUTATED');
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf = 0;

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(r.width*dpr));
      canvas.height = Math.max(1, Math.floor(r.height*dpr));
      ctx.setTransform(dpr,0,0,dpr,0,0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const geometry = () => {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      const cx = w/2, cy = h/2;
      const outer = Math.max(160, Math.min(w,h)*0.44);
      const inner = Math.max(42, outer*0.14);
      return {w,h,cx,cy,outer,inner,wedge:Math.PI*2/SECTORS};
    };

    const ringRadius = (stepIndex:number, stepFloat:number, inner:number, outer:number) => {
      const delta = ((stepIndex-stepFloat)%STEPS+STEPS)%STEPS;
      return inner + (delta/(STEPS-1))*(outer-inner);
    };

    const paint = (event: PointerEvent, first=false) => {
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left, y = event.clientY - rect.top;
      const {cx,cy,outer,inner,wedge} = geometry();
      const dx = x-cx, dy = y-cy;
      const radial = Math.hypot(dx,dy);
      if (radial < inner*0.72 || radial > outer+14) return;
      let angle = Math.atan2(dy,dx)+Math.PI/2;
      if (angle < 0) angle += Math.PI*2;
      const sector = Math.min(SECTORS-1, Math.floor(angle/wedge));
      let bestStep = 0, bestDistance = Infinity;
      for (let s=0;s<STEPS;s++) {
        const rr = ringRadius(s, phaseRef.current, inner, outer);
        const d = Math.abs(rr-radial);
        if (d < bestDistance) { bestDistance = d; bestStep = s; }
      }
      if (bestDistance > Math.max(16,(outer-inner)/STEPS*0.72)) return;
      const key = `${bestStep}:${sector}`;
      if (!first && key === lastCellRef.current) return;
      lastCellRef.current = key;
      if (first || dragModeRef.current === null) dragModeRef.current = !gridRef.current[bestStep][sector];
      gridRef.current[bestStep][sector] = Boolean(dragModeRef.current);
      force(v => v+1);
      if (dragModeRef.current) playVoice(sector);
    };

    const onDown = (e: PointerEvent) => {
      canvas.setPointerCapture(e.pointerId);
      dragModeRef.current = null;
      lastCellRef.current = '';
      paint(e,true);
    };
    const onMove = (e: PointerEvent) => {
      if (canvas.hasPointerCapture(e.pointerId)) paint(e,false);
    };
    const onUp = (e: PointerEvent) => {
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
      dragModeRef.current = null;
      lastCellRef.current = '';
    };

    canvas.addEventListener('pointerdown',onDown);
    canvas.addEventListener('pointermove',onMove);
    canvas.addEventListener('pointerup',onUp);
    canvas.addEventListener('pointercancel',onUp);

    const draw = (now:number) => {
      const {w,h,cx,cy,outer,inner,wedge} = geometry();
      ctx.fillStyle = '#050505';
      ctx.fillRect(0,0,w,h);

      const stepMs = 60000/bpmRef.current/4;
      if (runningRef.current) phaseRef.current = (now-startTimeRef.current)/stepMs;
      const stepFloat = phaseRef.current;
      const absStep = Math.floor(stepFloat);
      if (runningRef.current && absStep > lastStepRef.current) {
        while (lastStepRef.current < absStep) {
          lastStepRef.current++;
          triggerStep(((lastStepRef.current%STEPS)+STEPS)%STEPS);
        }
      }

      for (let s=0;s<SECTORS;s++) {
        const a0 = -Math.PI/2+s*wedge;
        const am = a0+wedge/2;
        ctx.beginPath();
        ctx.moveTo(cx,cy);
        ctx.lineTo(cx+Math.cos(a0)*outer, cy+Math.sin(a0)*outer);
        ctx.strokeStyle = 'rgba(255,255,255,.12)';
        ctx.stroke();
        ctx.fillStyle = COLORS[s];
        ctx.font = '700 11px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(VOICES[s], cx+Math.cos(am)*(outer+28), cy+Math.sin(am)*(outer+28));
      }

      for (let s=0;s<STEPS;s++) {
        const rr = ringRadius(s,stepFloat,inner,outer);
        ctx.beginPath();
        ctx.arc(cx,cy,rr,0,Math.PI*2);
        ctx.strokeStyle = s%4===0 ? 'rgba(218,255,0,.34)' : 'rgba(255,255,255,.12)';
        ctx.lineWidth = s%4===0 ? 1.6 : 1;
        ctx.stroke();

        for (let sector=0;sector<SECTORS;sector++) {
          if (!gridRef.current[s][sector]) continue;
          const a0 = -Math.PI/2+sector*wedge+0.025;
          const a1 = a0+wedge-0.05;
          const band = Math.max(5,(outer-inner)/STEPS*0.34);
          ctx.beginPath();
          ctx.arc(cx,cy,rr+band,a0,a1);
          ctx.arc(cx,cy,Math.max(inner*0.7,rr-band),a1,a0,true);
          ctx.closePath();
          ctx.fillStyle = COLORS[sector];
          ctx.globalAlpha = rr < inner+16 ? 1 : 0.82;
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }

      ctx.beginPath();
      ctx.arc(cx,cy,inner,0,Math.PI*2);
      ctx.fillStyle = '#050505';
      ctx.fill();
      ctx.strokeStyle = '#daff00';
      ctx.lineWidth = 3;
      ctx.stroke();

      const pulse = runningRef.current ? 1-(stepFloat-Math.floor(stepFloat)) : 0;
      ctx.beginPath();
      ctx.arc(cx,cy,Math.max(8,inner*0.34+pulse*5),0,Math.PI*2);
      ctx.fillStyle = '#daff00';
      ctx.fill();

      ctx.fillStyle = 'rgba(255,255,255,.55)';
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.round(bpmRef.current)} BPM`,cx,cy+3);
      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener('pointerdown',onDown);
      canvas.removeEventListener('pointermove',onMove);
      canvas.removeEventListener('pointerup',onUp);
      canvas.removeEventListener('pointercancel',onUp);
    };
  },[]);

  return (
    <main style={{minHeight:'100vh',background:'#050505',color:'#daff00',fontFamily:'ui-monospace, SFMono-Regular, Menlo, monospace',padding:18}}>
      <div style={{maxWidth:1180,margin:'0 auto'}}>
        <div style={{display:'flex',justifyContent:'space-between',gap:16,flexWrap:'wrap',marginBottom:12,fontSize:12,letterSpacing:'.12em'}}>
          <span>HARIL OS // OBAS POLAR SEQUENCER</span>
          <span>16 STEPS // 8 VOICES</span>
        </div>
        <div style={{border:'1px solid #313131',background:'#000'}}>
          <canvas ref={canvasRef} style={{width:'100%',height:'min(72vw,760px)',minHeight:460,display:'block',touchAction:'none',cursor:'crosshair'}} />
        </div>
        <div style={{display:'flex',gap:10,flexWrap:'wrap',marginTop:10,alignItems:'center'}}>
          <button onClick={toggleRun} style={{minHeight:46,padding:'0 20px',border:'1px solid #daff00',background:running?'#daff00':'#050505',color:running?'#050505':'#daff00',font:'inherit',cursor:'pointer'}}>{running?'PAUSE':'PLAY'}</button>
          <label style={{display:'flex',alignItems:'center',gap:8,border:'1px solid #313131',padding:'0 12px',minHeight:46,color:'#eee'}}>
            BPM
            <input type='number' min={40} max={220} value={bpm} onChange={(e)=>changeBpm(Number(e.target.value))} style={{width:72,background:'#050505',color:'#daff00',border:'1px solid #444',padding:'6px 8px',font:'inherit'}} />
          </label>
          <button onClick={clearGrid} style={{minHeight:46,padding:'0 16px',border:'1px solid #555',background:'#050505',color:'#eee',font:'inherit',cursor:'pointer'}}>CLEAR</button>
          <button onClick={mutateGrid} style={{minHeight:46,padding:'0 16px',border:'1px solid #555',background:'#050505',color:'#eee',font:'inherit',cursor:'pointer'}}>MUTATE</button>
          <div style={{flex:'1 1 280px',minHeight:46,border:'1px solid #313131',display:'flex',alignItems:'center',padding:'0 14px',color:'#eee',fontSize:12}}>{status}</div>
        </div>
        <p style={{color:'#8c8c8c',fontSize:12,lineHeight:1.6,marginTop:10}}>Paint notes directly onto the moving polar grid. Each concentric ring is one sixteenth-note step; each pie slice is a voice. When a painted ring reaches the center trigger, that voice sounds.</p>
      </div>
    </main>
  );
}
