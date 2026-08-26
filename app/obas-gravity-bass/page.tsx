'use client';

import { useEffect, useRef, useState } from 'react';

type Puck = { id:number; x:number; y:number; vx:number; vy:number; r:number; pitch:number; hue:number; dragging?:boolean; lastHit:number };
type Pulse = { x:number; y:number; life:number; r:number; hue:number };

const SCALE = [55, 65.41, 73.42, 82.41, 98, 110, 130.81, 146.83];

export default function ObasGravityBassPage(){
  const canvasRef = useRef<HTMLCanvasElement|null>(null);
  const audioRef = useRef<AudioContext|null>(null);
  const pucksRef = useRef<Puck[]>([]);
  const pulsesRef = useRef<Pulse[]>([]);
  const nextIdRef = useRef(1);
  const dragRef = useRef<{id:number;dx:number;dy:number;lastX:number;lastY:number;lastT:number}|null>(null);
  const runningRef = useRef(true);
  const speedRef = useRef(1);

  const [running,setRunning] = useState(true);
  const [speed,setSpeed] = useState(1);
  const [status,setStatus] = useState('KINETIC FIELD // GRAB + THROW TO PERTURB');
  const [count,setCount] = useState(6);

  function ensureAudio(){
    if(!audioRef.current){
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if(Ctx) audioRef.current = new Ctx();
    }
    if(audioRef.current?.state==='suspended') audioRef.current.resume();
    return audioRef.current;
  }

  function playTone(puck:Puck, energy:number, kind:'wall'|'puck'){
    const ctx = ensureAudio(); if(!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const sub = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const freq = puck.pitch;
    osc.type = kind==='puck' ? 'triangle' : 'sine';
    sub.type = 'sine';
    osc.frequency.setValueAtTime(freq*(kind==='puck'?2:1),now);
    sub.frequency.setValueAtTime(freq/2,now);
    filter.type='lowpass';
    filter.frequency.setValueAtTime(kind==='puck'?1200:520,now);
    filter.frequency.exponentialRampToValueAtTime(180,now+0.22);
    const amp = Math.min(.85,.08+energy*.45);
    gain.gain.setValueAtTime(.0001,now);
    gain.gain.exponentialRampToValueAtTime(amp,now+.004);
    gain.gain.exponentialRampToValueAtTime(.0001,now+(kind==='puck'?.28:.18));
    osc.connect(filter); sub.connect(filter); filter.connect(gain).connect(ctx.destination);
    osc.start(now); sub.start(now); osc.stop(now+.3); sub.stop(now+.3);
    setStatus(`${kind==='puck'?'PUCK COLLISION':'WALL STRIKE'} // ${Math.round(freq)} HZ`);
  }

  function spawn(randomize=true){
    const c=canvasRef.current; if(!c) return;
    const w=c.clientWidth,h=c.clientHeight;
    const r=18+Math.random()*12;
    const angle=Math.random()*Math.PI*2;
    const velocity=.06+Math.random()*.08;
    const puck:Puck={
      id:nextIdRef.current++,
      x:r+Math.random()*Math.max(1,w-r*2),
      y:r+Math.random()*Math.max(1,h-r*2),
      vx:Math.cos(angle)*velocity,
      vy:Math.sin(angle)*velocity,
      r,
      pitch:SCALE[Math.floor(Math.random()*SCALE.length)],
      hue:Math.random(),
      lastHit:0
    };
    pucksRef.current.push(puck);
    if(randomize) setCount(pucksRef.current.length);
  }

  function reseed(){
    pucksRef.current=[]; pulsesRef.current=[];
    for(let i=0;i<6;i++) spawn(false);
    setCount(6); setStatus('FIELD RESEEDED // SIX BODIES IN MOTION');
  }

  useEffect(()=>{
    const c=canvasRef.current; if(!c) return;
    const ctx=c.getContext('2d'); if(!ctx) return;
    for(let i=0;i<6;i++) spawn(false);
    setCount(6);
    let raf=0,last=performance.now();

    const resize=()=>{
      const r=c.getBoundingClientRect(); const dpr=Math.min(window.devicePixelRatio||1,2);
      c.width=Math.max(1,Math.floor(r.width*dpr)); c.height=Math.max(1,Math.floor(r.height*dpr));
      ctx.setTransform(dpr,0,0,dpr,0,0);
    };
    resize(); const ro=new ResizeObserver(resize); ro.observe(c);

    const pointerPos=(e:PointerEvent)=>{const r=c.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};};
    const onDown=(e:PointerEvent)=>{
      ensureAudio(); const p=pointerPos(e);
      let hit:Puck|null=null;
      for(let i=pucksRef.current.length-1;i>=0;i--){const b=pucksRef.current[i];if(Math.hypot(p.x-b.x,p.y-b.y)<=b.r+10){hit=b;break;}}
      if(!hit){spawn();setStatus('NEW BODY ADDED');return;}
      c.setPointerCapture(e.pointerId); hit.dragging=true; hit.vx=0; hit.vy=0;
      dragRef.current={id:hit.id,dx:p.x-hit.x,dy:p.y-hit.y,lastX:p.x,lastY:p.y,lastT:performance.now()};
      setStatus('BODY CAPTURED // THROW TO CHANGE THE SYSTEM');
    };
    const onMove=(e:PointerEvent)=>{
      const d=dragRef.current;if(!d)return;const p=pointerPos(e);const b=pucksRef.current.find(x=>x.id===d.id);if(!b)return;
      const now=performance.now(),dt=Math.max(8,now-d.lastT);
      b.x=p.x-d.dx;b.y=p.y-d.dy;b.vx=(p.x-d.lastX)/dt;b.vy=(p.y-d.lastY)/dt;
      d.lastX=p.x;d.lastY=p.y;d.lastT=now;
    };
    const onUp=(e:PointerEvent)=>{
      const d=dragRef.current;if(!d)return;const b=pucksRef.current.find(x=>x.id===d.id);if(b)b.dragging=false;
      dragRef.current=null;if(c.hasPointerCapture(e.pointerId))c.releasePointerCapture(e.pointerId);
      setStatus('BODY RELEASED // WATCH THE FIELD REORGANIZE');
    };
    c.addEventListener('pointerdown',onDown);c.addEventListener('pointermove',onMove);c.addEventListener('pointerup',onUp);c.addEventListener('pointercancel',onUp);

    const draw=(now:number)=>{
      const dt=Math.min(32,now-last)*speedRef.current;last=now;const w=c.clientWidth,h=c.clientHeight;
      ctx.fillStyle='#050505';ctx.fillRect(0,0,w,h);

      ctx.strokeStyle='rgba(255,255,255,.08)';ctx.lineWidth=1;
      for(let i=1;i<8;i++){ctx.beginPath();ctx.moveTo((w/8)*i,0);ctx.lineTo((w/8)*i,h);ctx.stroke();}
      for(let i=1;i<6;i++){ctx.beginPath();ctx.moveTo(0,(h/6)*i);ctx.lineTo(w,(h/6)*i);ctx.stroke();}

      if(runningRef.current){
        for(const b of pucksRef.current){
          if(b.dragging)continue;
          b.x+=b.vx*dt;b.y+=b.vy*dt;
          let wallEnergy=0;
          if(b.x<b.r){b.x=b.r;b.vx=Math.abs(b.vx);wallEnergy=Math.abs(b.vx);}
          else if(b.x>w-b.r){b.x=w-b.r;b.vx=-Math.abs(b.vx);wallEnergy=Math.abs(b.vx);}
          if(b.y<b.r){b.y=b.r;b.vy=Math.abs(b.vy);wallEnergy=Math.max(wallEnergy,Math.abs(b.vy));}
          else if(b.y>h-b.r){b.y=h-b.r;b.vy=-Math.abs(b.vy);wallEnergy=Math.max(wallEnergy,Math.abs(b.vy));}
          if(wallEnergy>.035 && now-b.lastHit>75){b.lastHit=now;playTone(b,wallEnergy*4,'wall');pulsesRef.current.push({x:b.x,y:b.y,life:1,r:b.r,hue:b.hue});}
        }

        const arr=pucksRef.current;
        for(let i=0;i<arr.length;i++)for(let j=i+1;j<arr.length;j++){
          const a=arr[i],b=arr[j];if(a.dragging||b.dragging)continue;
          const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy),min=a.r+b.r;
          if(d>0&&d<min){
            const nx=dx/d,ny=dy/d,overlap=min-d;
            a.x-=nx*overlap*.5;a.y-=ny*overlap*.5;b.x+=nx*overlap*.5;b.y+=ny*overlap*.5;
            const rvx=b.vx-a.vx,rvy=b.vy-a.vy;const rel=rvx*nx+rvy*ny;
            if(rel<0){
              const impulse=-rel;
              a.vx-=nx*impulse;a.vy-=ny*impulse;b.vx+=nx*impulse;b.vy+=ny*impulse;
              const energy=Math.abs(rel);
              if(energy>.025 && now-a.lastHit>70 && now-b.lastHit>70){
                a.lastHit=now;b.lastHit=now;
                const primary=energy>Math.hypot(a.vx,a.vy)?b:a;
                playTone(primary,energy*5,'puck');
                pulsesRef.current.push({x:(a.x+b.x)/2,y:(a.y+b.y)/2,life:1,r:(a.r+b.r)/2,hue:(a.hue+b.hue)/2});
              }
            }
          }
        }
      }

      for(const p of pucksRef.current){
        ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
        ctx.fillStyle=`hsla(${Math.round(45+p.hue*220)},85%,60%,.88)`;ctx.fill();
        ctx.strokeStyle=p.dragging?'#fff':'rgba(0,0,0,.8)';ctx.lineWidth=p.dragging?3:2;ctx.stroke();
        ctx.fillStyle='#050505';ctx.font='700 10px ui-monospace,monospace';ctx.textAlign='center';ctx.fillText(String(Math.round(p.pitch)),p.x,p.y+3);
      }

      pulsesRef.current=pulsesRef.current.filter(p=>{p.life-=dt*.0032;if(p.life<=0)return false;ctx.beginPath();ctx.arc(p.x,p.y,p.r+(1-p.life)*70,0,Math.PI*2);ctx.strokeStyle=`hsla(${Math.round(45+p.hue*220)},90%,65%,${p.life*.7})`;ctx.lineWidth=2.5*p.life;ctx.stroke();return true;});
      raf=requestAnimationFrame(draw);
    };
    raf=requestAnimationFrame(draw);
    return()=>{cancelAnimationFrame(raf);ro.disconnect();c.removeEventListener('pointerdown',onDown);c.removeEventListener('pointermove',onMove);c.removeEventListener('pointerup',onUp);c.removeEventListener('pointercancel',onUp);};
  },[]);

  function setSpeedValue(v:number){const next=Math.max(.25,Math.min(2.5,v));speedRef.current=next;setSpeed(next);}

  return <main style={{minHeight:'100vh',background:'#050505',color:'#daff00',fontFamily:'ui-monospace,SFMono-Regular,Menlo,monospace',padding:18}}>
    <div style={{maxWidth:1180,margin:'0 auto'}}>
      <div style={{display:'flex',justifyContent:'space-between',gap:16,flexWrap:'wrap',marginBottom:12,fontSize:12,letterSpacing:'.12em'}}>
        <span>HARIL OS // OBAS KINETIC FIELD</span><span>{count} BODIES // COLLISION-DRIVEN SOUND</span>
      </div>
      <div style={{border:'1px solid #313131',background:'#000'}}><canvas ref={canvasRef} style={{width:'100%',height:'min(70vw,720px)',minHeight:480,display:'block',touchAction:'none',cursor:'grab'}}/></div>
      <div style={{display:'flex',gap:10,flexWrap:'wrap',marginTop:10,alignItems:'center'}}>
        <button onClick={()=>{runningRef.current=!runningRef.current;setRunning(runningRef.current);setStatus(runningRef.current?'FIELD ACTIVE':'FIELD FROZEN');}} style={{minHeight:46,padding:'0 18px',border:'1px solid #daff00',background:running?'#daff00':'#050505',color:running?'#050505':'#daff00',font:'inherit',cursor:'pointer'}}>{running?'FREEZE':'RELEASE'}</button>
        <button onClick={()=>spawn()} style={{minHeight:46,padding:'0 18px',border:'1px solid #313131',background:'#050505',color:'#daff00',font:'inherit',cursor:'pointer'}}>ADD BODY</button>
        <button onClick={reseed} style={{minHeight:46,padding:'0 18px',border:'1px solid #313131',background:'#050505',color:'#daff00',font:'inherit',cursor:'pointer'}}>RESEED</button>
        <label style={{display:'flex',alignItems:'center',gap:8,border:'1px solid #313131',minHeight:46,padding:'0 12px',color:'#eee'}}>FIELD SPEED <input type='range' min='.25' max='2.5' step='.05' value={speed} onChange={e=>setSpeedValue(Number(e.target.value))}/><span>{speed.toFixed(2)}×</span></label>
        <div style={{flex:'1 1 280px',minHeight:46,border:'1px solid #313131',display:'flex',alignItems:'center',padding:'0 14px',color:'#eee',fontSize:12}}>{status}</div>
      </div>
      <p style={{color:'#8c8c8c',fontSize:12,lineHeight:1.5,marginTop:10}}>The bodies float indefinitely with no gravity. Wall strikes and puck-to-puck collisions trigger tones. Grab and throw any body to perturb the system and let new rhythms or melodies emerge.</p>
    </div>
  </main>;
}
