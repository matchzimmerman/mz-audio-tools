'use client';

import { useEffect, useRef, useState } from 'react';

type Body = { id:number; x:number; y:number; vx:number; vy:number; r:number; mass:number; pitch:number; dragging?:boolean };
type Pulse = { x:number; y:number; life:number; r:number };

const NOTES = [43.65, 49.0, 55.0, 65.41, 73.42, 82.41];

export default function ObasGravityBassPage(){
  const canvasRef = useRef<HTMLCanvasElement|null>(null);
  const audioRef = useRef<AudioContext|null>(null);
  const bodiesRef = useRef<Body[]>([]);
  const pulsesRef = useRef<Pulse[]>([]);
  const nextIdRef = useRef(1);
  const dragRef = useRef<{id:number;dx:number;dy:number;lastX:number;lastY:number;lastT:number}|null>(null);
  const runningRef = useRef(true);
  const gravityRef = useRef(0.00022);
  const [running,setRunning]=useState(true);
  const [gravity,setGravity]=useState(1);
  const [status,setStatus]=useState('GRAB // THROW // LET MASS BECOME BASS');

  function ensureAudio(){
    if(!audioRef.current){
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if(Ctx) audioRef.current = new Ctx();
    }
    if(audioRef.current?.state==='suspended') audioRef.current.resume();
    return audioRef.current;
  }

  function playBass(body:Body, impact:number){
    const ctx=ensureAudio(); if(!ctx) return;
    const now=ctx.currentTime;
    const osc=ctx.createOscillator();
    const sub=ctx.createOscillator();
    const gain=ctx.createGain();
    const filt=ctx.createBiquadFilter();
    const freq=body.pitch;
    osc.type='sawtooth'; sub.type='sine';
    osc.frequency.setValueAtTime(freq*2,now);
    osc.frequency.exponentialRampToValueAtTime(freq,now+0.16);
    sub.frequency.setValueAtTime(freq,now);
    filt.type='lowpass'; filt.frequency.setValueAtTime(520,now); filt.frequency.exponentialRampToValueAtTime(120,now+0.28);
    const amp=Math.min(.95,.25+impact*.8+body.mass*.05);
    gain.gain.setValueAtTime(.0001,now);
    gain.gain.exponentialRampToValueAtTime(amp,now+.008);
    gain.gain.exponentialRampToValueAtTime(.0001,now+.42);
    osc.connect(filt); sub.connect(filt); filt.connect(gain).connect(ctx.destination);
    osc.start(now); sub.start(now); osc.stop(now+.45); sub.stop(now+.45);
    setStatus(`IMPACT // ${Math.round(freq)} HZ // MASS ${body.mass.toFixed(1)}`);
  }

  function spawn(x?:number,y?:number){
    const canvas=canvasRef.current; if(!canvas) return;
    const w=canvas.clientWidth, h=canvas.clientHeight;
    const mass=.8+Math.random()*1.8;
    const r=16+mass*8;
    bodiesRef.current.push({
      id:nextIdRef.current++,
      x:x ?? w*(.18+Math.random()*.64),
      y:y ?? 40+Math.random()*h*.16,
      vx:(Math.random()-.5)*.045,
      vy:0,
      r,mass,
      pitch:NOTES[Math.floor(Math.random()*NOTES.length)]
    });
  }

  function clear(){ bodiesRef.current=[]; pulsesRef.current=[]; setStatus('FIELD CLEARED'); }

  useEffect(()=>{
    const c=canvasRef.current; if(!c) return;
    for(let i=0;i<6;i++) spawn();
    const ctx=c.getContext('2d'); if(!ctx) return;
    let raf=0, last=performance.now();

    const resize=()=>{
      const r=c.getBoundingClientRect(); const dpr=Math.min(window.devicePixelRatio||1,2);
      c.width=Math.max(1,Math.floor(r.width*dpr)); c.height=Math.max(1,Math.floor(r.height*dpr));
      ctx.setTransform(dpr,0,0,dpr,0,0);
    };
    resize(); const ro=new ResizeObserver(resize); ro.observe(c);

    const pointerPos=(e:PointerEvent)=>{ const r=c.getBoundingClientRect(); return {x:e.clientX-r.left,y:e.clientY-r.top}; };
    const onDown=(e:PointerEvent)=>{
      ensureAudio(); const p=pointerPos(e);
      let hit:Body|null=null;
      for(let i=bodiesRef.current.length-1;i>=0;i--){ const b=bodiesRef.current[i]; if(Math.hypot(p.x-b.x,p.y-b.y)<=b.r+8){hit=b;break;} }
      if(!hit){ spawn(p.x,p.y); setStatus('NEW MASS // RELEASED'); return; }
      c.setPointerCapture(e.pointerId); hit.dragging=true; hit.vx=0; hit.vy=0;
      dragRef.current={id:hit.id,dx:p.x-hit.x,dy:p.y-hit.y,lastX:p.x,lastY:p.y,lastT:performance.now()};
      setStatus('MASS CAPTURED // DRAG + THROW');
    };
    const onMove=(e:PointerEvent)=>{
      const d=dragRef.current; if(!d) return; const p=pointerPos(e); const b=bodiesRef.current.find(x=>x.id===d.id); if(!b)return;
      const now=performance.now(), dt=Math.max(8,now-d.lastT);
      b.x=p.x-d.dx; b.y=p.y-d.dy; b.vx=(p.x-d.lastX)/dt; b.vy=(p.y-d.lastY)/dt;
      d.lastX=p.x; d.lastY=p.y; d.lastT=now;
    };
    const onUp=(e:PointerEvent)=>{
      const d=dragRef.current; if(!d) return; const b=bodiesRef.current.find(x=>x.id===d.id); if(b)b.dragging=false;
      dragRef.current=null; if(c.hasPointerCapture(e.pointerId)) c.releasePointerCapture(e.pointerId);
      setStatus('MASS RELEASED // FOLLOW ITS FALL');
    };
    c.addEventListener('pointerdown',onDown); c.addEventListener('pointermove',onMove); c.addEventListener('pointerup',onUp); c.addEventListener('pointercancel',onUp);

    const draw=(now:number)=>{
      const dt=Math.min(32,now-last); last=now; const w=c.clientWidth,h=c.clientHeight; const floor=h-72;
      ctx.fillStyle='#050505'; ctx.fillRect(0,0,w,h);

      ctx.strokeStyle='rgba(218,255,0,.16)'; ctx.lineWidth=1;
      for(let i=1;i<6;i++){ const yy=(floor/6)*i; ctx.beginPath(); ctx.moveTo(0,yy); ctx.lineTo(w,yy); ctx.stroke(); }
      ctx.fillStyle='rgba(255,255,255,.32)'; ctx.font='10px ui-monospace,monospace'; ctx.textAlign='left'; ctx.fillText('GRAVITY FIELD',14,22);

      ctx.fillStyle='rgba(218,255,0,.06)'; ctx.fillRect(0,floor,w,h-floor);
      ctx.strokeStyle='#daff00'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(0,floor); ctx.lineTo(w,floor); ctx.stroke();
      ctx.fillStyle='rgba(218,255,0,.65)'; ctx.font='11px ui-monospace,monospace'; ctx.fillText('IMPACT / SOUND ZONE',14,floor+22);

      if(runningRef.current){
        for(const b of bodiesRef.current){
          if(b.dragging) continue;
          b.vy += gravityRef.current*gravity*dt;
          b.x += b.vx*dt; b.y += b.vy*dt;
          if(b.x<b.r){b.x=b.r;b.vx=Math.abs(b.vx)*.82;} if(b.x>w-b.r){b.x=w-b.r;b.vx=-Math.abs(b.vx)*.82;}
          for(const o of bodiesRef.current){
            if(o===b) continue; const dx=b.x-o.x,dy=b.y-o.y,d=Math.hypot(dx,dy),min=b.r+o.r;
            if(d>0 && d<min){ const nx=dx/d,ny=dy/d,push=(min-d)*.5; b.x+=nx*push;b.y+=ny*push; o.x-=nx*push;o.y-=ny*push; const rel=(b.vx-o.vx)*nx+(b.vy-o.vy)*ny; if(rel<0){ const imp=-rel*.72; b.vx+=nx*imp;b.vy+=ny*imp;o.vx-=nx*imp;o.vy-=ny*imp; } }
          }
          if(b.y+b.r>=floor){
            const impact=Math.min(1.4,Math.abs(b.vy)*2.8);
            if(Math.abs(b.vy)>.12){ playBass(b,impact); pulsesRef.current.push({x:b.x,y:floor,life:1,r:b.r}); }
            b.y=floor-b.r; b.vy=-Math.abs(b.vy)*(.34+Math.min(.22,b.mass*.04)); b.vx*=.94;
          }
        }
      }

      for(const b of bodiesRef.current){
        const shade=Math.max(.22,Math.min(.92,.26+b.mass*.22));
        ctx.beginPath(); ctx.arc(b.x,b.y,b.r,0,Math.PI*2); ctx.fillStyle=`rgba(218,255,0,${shade})`; ctx.fill();
        ctx.strokeStyle=b.dragging?'#fff':'rgba(0,0,0,.9)'; ctx.lineWidth=b.dragging?3:2; ctx.stroke();
        ctx.fillStyle='#050505'; ctx.font='700 11px ui-monospace,monospace'; ctx.textAlign='center'; ctx.fillText(`${Math.round(b.pitch)}`,b.x,b.y+4);
      }

      pulsesRef.current=pulsesRef.current.filter(p=>{ p.life-=dt*.0028; if(p.life<=0)return false; ctx.beginPath(); ctx.arc(p.x,p.y,p.r+(1-p.life)*90,Math.PI,Math.PI*2); ctx.strokeStyle=`rgba(218,255,0,${p.life*.75})`; ctx.lineWidth=3*p.life; ctx.stroke(); return true; });

      raf=requestAnimationFrame(draw);
    };
    raf=requestAnimationFrame(draw);
    return()=>{cancelAnimationFrame(raf);ro.disconnect();c.removeEventListener('pointerdown',onDown);c.removeEventListener('pointermove',onMove);c.removeEventListener('pointerup',onUp);c.removeEventListener('pointercancel',onUp);};
  },[gravity]);

  return <main style={{minHeight:'100vh',background:'#050505',color:'#daff00',fontFamily:'ui-monospace,SFMono-Regular,Menlo,monospace',padding:18}}>
    <div style={{maxWidth:1180,margin:'0 auto'}}>
      <div style={{display:'flex',justifyContent:'space-between',gap:16,flexWrap:'wrap',marginBottom:12,fontSize:12,letterSpacing:'.12em'}}>
        <span>HARIL OS // OBAS GRAVITY BASS</span><span>MASS // MOMENTUM // IMPACT</span>
      </div>
      <div style={{border:'1px solid #313131',background:'#000'}}><canvas ref={canvasRef} style={{width:'100%',height:'min(70vw,720px)',minHeight:480,display:'block',touchAction:'none',cursor:'grab'}}/></div>
      <div style={{display:'flex',gap:10,flexWrap:'wrap',marginTop:10,alignItems:'center'}}>
        <button onClick={()=>{runningRef.current=!runningRef.current;setRunning(runningRef.current);setStatus(runningRef.current?'FIELD ACTIVE':'FIELD FROZEN');}} style={{minHeight:46,padding:'0 18px',border:'1px solid #daff00',background:running?'#daff00':'#050505',color:running?'#050505':'#daff00',font:'inherit',cursor:'pointer'}}>{running?'FREEZE':'RELEASE'}</button>
        <button onClick={()=>spawn()} style={{minHeight:46,padding:'0 18px',border:'1px solid #313131',background:'#050505',color:'#daff00',font:'inherit',cursor:'pointer'}}>ADD MASS</button>
        <button onClick={clear} style={{minHeight:46,padding:'0 18px',border:'1px solid #313131',background:'#050505',color:'#daff00',font:'inherit',cursor:'pointer'}}>CLEAR</button>
        <label style={{display:'flex',alignItems:'center',gap:8,border:'1px solid #313131',minHeight:46,padding:'0 12px',color:'#eee'}}>GRAVITY <input type='range' min='0.25' max='2.4' step='0.05' value={gravity} onChange={e=>setGravity(Number(e.target.value))}/><span>{gravity.toFixed(2)}×</span></label>
        <div style={{flex:'1 1 280px',minHeight:46,border:'1px solid #313131',display:'flex',alignItems:'center',padding:'0 14px',color:'#eee',fontSize:12}}>{status}</div>
      </div>
      <p style={{color:'#8c8c8c',fontSize:12,lineHeight:1.5,marginTop:10}}>Click empty space to create mass. Grab a body and throw it. Heavier objects fall, collide, rebound, and trigger sub-bass when they strike the sounding floor.</p>
    </div>
  </main>;
}
