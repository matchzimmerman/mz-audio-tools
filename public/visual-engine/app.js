(() => {
  'use strict';

  const ROLE_DEFS = {
    impact:     {label:'IMPACT',     desc:'TRANSIENT / PRESSURE', color:'#f2ff00'},
    mass:       {label:'MASS',       desc:'SUB / GRAVITY',        color:'#ff3b00'},
    form:       {label:'FORM',       desc:'MIDS / COHESION',      color:'#12f7c8'},
    texture:    {label:'TEXTURE',    desc:'EDGE / TURBULENCE',    color:'#a75cff'},
    atmosphere: {label:'ATMOSPHERE', desc:'AIR / PERSISTENCE',   color:'#fff6dc'},
    master:     {label:'MASTER',     desc:'GLOBAL ENERGY',        color:'#00d8ff'}
  };

  const SEND_DEFAULTS = [
    ['KICK / DRUMS','impact'],
    ['BASS','mass'],
    ['VOICE / LEAD','form'],
    ['GUITAR / SYNTH','texture'],
    ['REVERB / FX','atmosphere'],
    ['MASTER BUS','master']
  ];

  const view = document.getElementById('view');
  const vctx = view.getContext('2d', {alpha:false});
  const low = document.createElement('canvas');
  const ctx = low.getContext('2d', {alpha:false});
  const sendsEl = document.getElementById('sends');
  const signalHud = document.getElementById('signalHud');
  const sceneSelect = document.getElementById('sceneSelect');
  const sensitivity = document.getElementById('sensitivity');
  const notice = document.getElementById('notice');
  const sourceLabel = document.getElementById('sourceLabel');
  const sceneName = document.getElementById('sceneName');
  const recordFlag = document.getElementById('recordFlag');
  const timeEl = document.getElementById('time');

  let W=384,H=216,last=performance.now(),frame=0,seed=Math.random()*99999;
  let audioCtx=null, recordDest=null, micStream=null, micAnalyser=null, micFreq=null, micTime=null;
  let demoMode=true, playing=false, loop=true, frozen=false, blackout=false;
  let particles=[], recorder=null, recordChunks=[];
  let signals={impact:0,mass:0,form:0,texture:0,atmosphere:0,master:0};
  let smooth={impact:0,mass:0,form:0,texture:0,atmosphere:0,master:0};
  let transient=0, previousMaster=0;

  const sends = SEND_DEFAULTS.map((d,i)=>({
    id:i+1, name:d[0], role:d[1], influence:1, muted:false, loaded:false,
    audio:new Audio(), source:null, analyser:null, gain:null, freq:null, time:null,
    previous:0, fileName:'NO AUDIO LOADED', objectUrl:null, meter:null
  }));

  function fmtTime(sec){
    if(!Number.isFinite(sec)) return '--:--';
    const m=Math.floor(sec/60), s=Math.floor(sec%60);
    return String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
  }

  function seeded(){
    seed += 0.918273;
    const x=Math.sin(seed*12.9898)*43758.5453;
    return x-Math.floor(x);
  }

  function resize(){
    const r=view.getBoundingClientRect();
    const dpr=Math.min(devicePixelRatio||1,2);
    view.width=Math.max(1,Math.floor(r.width*dpr));
    view.height=Math.max(1,Math.floor(r.height*dpr));
    H=216; W=Math.max(288,Math.round(H*(r.width/Math.max(1,r.height))));
    low.width=W; low.height=H;
    vctx.imageSmoothingEnabled=false;
    reseed(false);
  }

  function makeParticle(i){
    const role=Object.keys(ROLE_DEFS)[i%5];
    return {
      x:seeded()*W,y:seeded()*H,px:0,py:0,
      vx:(seeded()-.5)*.5,vy:(seeded()-.5)*.5,
      role,phase:seeded()*Math.PI*2,size:.7+seeded()*1.8
    };
  }

  function reseed(change=true){
    if(change) seed=Math.random()*99999;
    particles=Array.from({length:1250},(_,i)=>makeParticle(i));
    ctx.fillStyle='#050505';ctx.fillRect(0,0,W,H);
  }

  function buildRack(){
    sendsEl.innerHTML='';
    sends.forEach(send=>{
      const card=document.createElement('section'); card.className='send';
      const options=Object.entries(ROLE_DEFS).map(([id,r])=>`<option value="${id}" ${id===send.role?'selected':''}>${r.label}</option>`).join('');
      card.innerHTML=`
        <div class="send-head">
          <div class="send-number">${String(send.id).padStart(2,'0')}</div>
          <div class="send-name"><strong>${send.name}</strong><span class="filename">${send.fileName}</span></div>
          <button class="mute">MUTE</button>
        </div>
        <div class="send-grid">
          <label>TRACK AUDIO<label class="file-button">LOAD STEM<input class="file" type="file" accept="audio/*"></label></label>
          <label>VISUAL ROLE<select class="role">${options}</select></label>
          <label>INFLUENCE<input class="influence" type="range" min="0" max="2" step="0.05" value="1"></label>
          <label>ANALYSIS<div class="meter"><span></span></div></label>
        </div>`;
      const file=card.querySelector('.file');
      const role=card.querySelector('.role');
      const influence=card.querySelector('.influence');
      const mute=card.querySelector('.mute');
      send.meter=card.querySelector('.meter span');
      file.addEventListener('change',e=>{const f=e.target.files&&e.target.files[0];if(f) loadStem(send,f,card);});
      role.addEventListener('change',()=>send.role=role.value);
      influence.addEventListener('input',()=>send.influence=Number(influence.value));
      mute.addEventListener('click',()=>{
        send.muted=!send.muted; mute.classList.toggle('active',send.muted); mute.textContent=send.muted?'MUTED':'MUTE';
        if(send.gain) send.gain.gain.setTargetAtTime(send.muted?0:1,audioCtx.currentTime,.01);
      });
      sendsEl.appendChild(card);
    });
  }

  function ensureAudio(){
    if(audioCtx) return;
    audioCtx=new (window.AudioContext||window.webkitAudioContext)();
    recordDest=audioCtx.createMediaStreamDestination();
  }

  async function loadStem(send,file,card){
    ensureAudio(); await audioCtx.resume();
    if(send.objectUrl) URL.revokeObjectURL(send.objectUrl);
    send.objectUrl=URL.createObjectURL(file);
    send.audio.src=send.objectUrl; send.audio.loop=loop; send.audio.preload='auto';
    send.fileName=file.name.toUpperCase(); send.loaded=true;
    card.querySelector('.filename').textContent=send.fileName;
    if(!send.source){
      send.source=audioCtx.createMediaElementSource(send.audio);
      send.gain=audioCtx.createGain();
      send.analyser=audioCtx.createAnalyser();
      send.analyser.fftSize=1024; send.analyser.smoothingTimeConstant=.68;
      send.freq=new Uint8Array(send.analyser.frequencyBinCount);
      send.time=new Uint8Array(send.analyser.fftSize);
      send.source.connect(send.gain); send.gain.connect(send.analyser);
      send.analyser.connect(audioCtx.destination); send.analyser.connect(recordDest);
    }
    send.gain.gain.value=send.muted?0:1;
    demoMode=false; document.getElementById('demoBtn').classList.remove('active');
    document.getElementById('micBtn').classList.remove('active');
    sourceLabel.textContent='STEM RACK / '+sends.filter(s=>s.loaded).length+' SENDS ACTIVE';
    notice.classList.add('hidden');
  }

  function stopMic(){
    if(micStream){micStream.getTracks().forEach(t=>t.stop());micStream=null;}
    micAnalyser=null;micFreq=null;micTime=null;
  }

  async function useMic(){
    ensureAudio(); await audioCtx.resume(); stopAllAudio(); stopMic();
    micStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}});
    const src=audioCtx.createMediaStreamSource(micStream);
    micAnalyser=audioCtx.createAnalyser();micAnalyser.fftSize=2048;micAnalyser.smoothingTimeConstant=.65;
    micFreq=new Uint8Array(micAnalyser.frequencyBinCount);micTime=new Uint8Array(micAnalyser.fftSize);
    src.connect(micAnalyser);
    demoMode=false;playing=true;
    document.getElementById('micBtn').classList.add('active');document.getElementById('demoBtn').classList.remove('active');
    sourceLabel.textContent='LIVE INPUT / ANALYSIS ONLY';notice.classList.add('hidden');
  }

  function stopAllAudio(){
    sends.forEach(s=>{try{s.audio.pause();s.audio.currentTime=0;}catch(e){}});
    playing=false;
  }

  async function playAll(){
    ensureAudio();await audioCtx.resume();
    const loaded=sends.filter(s=>s.loaded);
    if(!loaded.length){demoMode=true;playing=true;return;}
    stopMic();
    await Promise.all(loaded.map(async s=>{s.audio.loop=loop;try{await s.audio.play();}catch(e){}}));
    demoMode=false;playing=true;
    document.getElementById('micBtn').classList.remove('active');document.getElementById('demoBtn').classList.remove('active');
    sourceLabel.textContent='STEM RACK / '+loaded.length+' SENDS PLAYING';notice.classList.add('hidden');
  }

  function pauseAll(){sends.forEach(s=>s.audio.pause());playing=false;}

  function binFor(analyser,hz){
    if(!audioCtx) return 0;
    return Math.max(0,Math.min(analyser.frequencyBinCount-1,Math.floor(hz/(audioCtx.sampleRate/2)*analyser.frequencyBinCount)));
  }

  function bandAverage(freq,analyser,min,max){
    const a=binFor(analyser,min),b=Math.max(a+1,binFor(analyser,max));let sum=0;
    for(let i=a;i<=b;i++) sum+=freq[i]/255;
    return sum/(b-a+1);
  }

  function analyse(freq,time,analyser,prev){
    analyser.getByteFrequencyData(freq);analyser.getByteTimeDomainData(time);
    let rms=0;for(let i=0;i<time.length;i++){const v=(time[i]-128)/128;rms+=v*v;}rms=Math.sqrt(rms/time.length);
    const low=bandAverage(freq,analyser,25,180),mid=bandAverage(freq,analyser,180,2200),high=bandAverage(freq,analyser,2200,15000);
    const hit=Math.max(0,rms-prev*.88);
    return {rms,low,mid,high,hit,prev:rms};
  }

  function resetSignals(){for(const k in signals)signals[k]=0;}

  function sampleAudio(t){
    resetSignals();
    const sens=Number(sensitivity.value);
    if(demoMode){
      const beat=(t*2.08)%1,off=(t*4.16+.5)%1;
      const kick=Math.exp(-beat*15),hat=Math.exp(-off*30);
      signals.impact=Math.min(1,.08+kick*.95);
      signals.mass=Math.min(1,.14+kick*.38+Math.max(0,Math.sin(t*2.7))*.48);
      signals.form=.22+(Math.sin(t*1.17+1.2)+1)*.18;
      signals.texture=.16+(Math.sin(t*5.1)*Math.sin(t*.47)+1)*.22;
      signals.atmosphere=.12+(Math.sin(t*.31)+1)*.25+hat*.22;
      signals.master=Math.min(1,(signals.impact+signals.mass+signals.form+signals.texture+signals.atmosphere)/3.2);
      transient=Math.max(transient*.84,kick,hat*.3);
    } else if(micAnalyser){
      const a=analyse(micFreq,micTime,micAnalyser,previousMaster);previousMaster=a.prev;
      signals.impact=(a.hit*8+a.low*.22)*sens;
      signals.mass=a.low*sens;
      signals.form=a.mid*sens;
      signals.texture=(a.mid*.35+a.high*.9)*sens;
      signals.atmosphere=(a.rms*.7+a.high*.5)*sens;
      signals.master=a.rms*sens*1.8;
      transient=Math.max(transient*.82,a.hit*8);
    } else {
      let count=0, masterSum=0;
      sends.forEach(s=>{
        if(!s.loaded||!s.analyser)return;
        const a=analyse(s.freq,s.time,s.analyser,s.previous);s.previous=a.prev;
        let value=0;
        if(s.role==='impact')value=a.hit*8+a.low*.25;
        if(s.role==='mass')value=a.low*1.2+a.rms*.2;
        if(s.role==='form')value=a.mid*1.1+a.rms*.25;
        if(s.role==='texture')value=a.high*1.25+a.mid*.25;
        if(s.role==='atmosphere')value=a.rms*.8+a.high*.45;
        if(s.role==='master')value=a.rms*1.8+(a.low+a.mid+a.high)/5;
        value*=s.influence*sens*(s.muted?0:1);
        signals[s.role]=Math.min(1,signals[s.role]+value);
        masterSum+=a.rms*(s.muted?0:1);count++;
        if(s.meter)s.meter.style.width=Math.round(Math.min(1,value)*100)+'%';
        transient=Math.max(transient*.84,a.hit*7*s.influence);
      });
      signals.master=Math.min(1,signals.master+(count?masterSum/count*sens*1.6:0));
    }
    for(const k in signals){
      signals[k]=Math.min(1,signals[k]);
      smooth[k]+=(signals[k]-smooth[k])*((signals[k]>smooth[k])?.28:.075);
    }
  }

  function fieldNoise(x,y,t){
    return Math.sin(x*.049+y*.081+t*.73)+Math.sin(x*.019-y*.067-t*.41)+Math.cos((x+y)*.011+t*.23);
  }

  function updateParticles(t,dt){
    const cx=W*.5+Math.sin(t*.27)*W*.13,cy=H*.5+Math.cos(t*.23)*H*.11;
    particles.forEach(p=>{
      const dx=p.x-cx,dy=p.y-cy,d=Math.sqrt(dx*dx+dy*dy)+.001,nx=dx/d,ny=dy/d;
      const e=smooth[p.role]||0;
      p.vx+=nx*(smooth.mass-.22)*.035+nx*transient*.05;
      p.vy+=ny*(smooth.mass-.22)*.035+ny*transient*.05;
      if(p.role==='impact'){
        p.vx+=nx*(e-.25)*.055;p.vy+=ny*(e-.25)*.055;
      }else if(p.role==='mass'){
        p.vx+=-ny*(.008+e*.045)-nx*.004;p.vy+=nx*(.008+e*.045)-ny*.004;
      }else if(p.role==='form'){
        const tx=cx+Math.sin(p.phase+t*.35)*W*.3,ty=cy+Math.cos(p.phase*1.7-t*.29)*H*.29;
        p.vx+=(tx-p.x)*(.00015+e*.0007);p.vy+=(ty-p.y)*(.00015+e*.0007);
      }else if(p.role==='texture'){
        const n=fieldNoise(p.x,p.y,t+p.phase);p.vx+=Math.cos(n*Math.PI)*(.007+e*.055);p.vy+=Math.sin(n*Math.PI)*(.007+e*.055);
      }else{
        p.vx+=(e*.09+.007)*(.2+Math.sin(p.phase)*.8);p.vy+=Math.sin(t*3.7+p.phase+p.x*.026)*(.005+e*.04);
      }
      p.vx+=Math.sin(t*.63+p.y*.035)*smooth.texture*.015;
      p.vy+=Math.cos(t*.39+p.x*.027)*smooth.form*.014;
      p.vx*=.974;p.vy*=.974;
      const max=.7+e*2.1,sp=Math.hypot(p.vx,p.vy);if(sp>max){p.vx=p.vx/sp*max;p.vy=p.vy/sp*max;}
      p.px=p.x;p.py=p.y;p.x+=p.vx*dt*60;p.y+=p.vy*dt*60;
      if(p.x<-5)p.x=W+5;if(p.x>W+5)p.x=-5;if(p.y<-5)p.y=H+5;if(p.y>H+5)p.y=-5;
    });
  }

  function clearTrail(alpha=.11){ctx.fillStyle=`rgba(5,5,5,${alpha})`;ctx.fillRect(0,0,W,H);}

  function drawParticles(){
    clearTrail(.105+smooth.atmosphere*.03);
    particles.forEach(p=>{
      const r=ROLE_DEFS[p.role],e=smooth[p.role]||0;ctx.strokeStyle=r.color;ctx.fillStyle=r.color;ctx.globalAlpha=.18+e*.76;
      if(p.role==='impact'){const s=Math.max(1,Math.round(p.size+e*2.8));ctx.fillRect(Math.round(p.x),Math.round(p.y),s,s);}
      else{ctx.beginPath();ctx.moveTo(p.px,p.py);ctx.lineTo(p.x,p.y);ctx.stroke();}
    });ctx.globalAlpha=1;
  }

  function drawField(t){
    clearTrail(.14);
    const step=5,amp=2+smooth.mass*9;
    for(let y=0;y<H;y+=step){
      for(let x=0;x<W;x+=step){
        const n=fieldNoise(x,y,t)+smooth.form*Math.sin((x-W/2)*.025);
        const a=n*Math.PI+smooth.texture*4;
        const len=1+smooth.atmosphere*4+Math.max(0,n)*smooth.master*2;
        ctx.strokeStyle=n>0?ROLE_DEFS.form.color:ROLE_DEFS.texture.color;
        ctx.globalAlpha=.14+Math.abs(n)*.08+smooth.master*.28;
        ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+Math.cos(a)*len+Math.sin(t+y*.02)*amp*.15,y+Math.sin(a)*len);ctx.stroke();
      }
    }
    ctx.globalAlpha=1;
  }

  function drawDither(t){
    ctx.fillStyle='#050505';ctx.fillRect(0,0,W,H);
    const cell=4;
    for(let y=0;y<H;y+=cell){
      for(let x=0;x<W;x+=cell){
        const radial=Math.hypot(x-W/2,y-H/2);
        const wave=Math.sin(x*.055+t*(1+smooth.mass*3)+Math.sin(y*.04+t)*3)+Math.cos(y*.071-t*.7)+fieldNoise(x,y,t)*smooth.texture;
        const threshold=(smooth.form-.35)*1.8+Math.sin(radial*.045-t*1.4)*smooth.atmosphere;
        if(wave>threshold){
          const role=wave>1.3?'impact':wave>.35?'form':'texture';ctx.fillStyle=ROLE_DEFS[role].color;
          const s=1+Math.round((smooth[role]||0)*2);ctx.fillRect(x,y,s,s);
        }
      }
    }
  }

  function drawTerrain(t){
    ctx.fillStyle='#050505';ctx.fillRect(0,0,W,H);
    const lines=34;
    for(let i=0;i<lines;i++){
      const base=(i/(lines-1))*H;
      ctx.strokeStyle=i%3===0?ROLE_DEFS.impact.color:ROLE_DEFS.form.color;
      ctx.globalAlpha=.22+smooth.master*.5;ctx.beginPath();
      for(let x=0;x<=W;x+=2){
        const n=fieldNoise(x,base,t*.7+i*.08);
        const y=base+n*(2+smooth.mass*8)+Math.sin(x*.03+t+i*.2)*smooth.texture*6-Math.exp(-Math.pow((x-W*.5)/(W*.22),2))*smooth.form*18;
        if(x===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
      }ctx.stroke();
    }ctx.globalAlpha=1;
  }

  function drawPhantom(t){
    ctx.fillStyle='#050505';ctx.fillRect(0,0,W,H);
    const gap=13,ox=(W%gap)/2,oy=(H%gap)/2;
    for(let y=oy;y<H;y+=gap){
      for(let x=ox;x<W;x+=gap){
        const sx=Math.min(x,W-x),sy=Math.min(y,H-y);
        const n=fieldNoise(sx,sy,t*.65);
        const pulse=(Math.sin(t*1.5+Math.hypot(x-W/2,y-H/2)*.055)+1)*.5;
        const size=1+Math.round((smooth.form*.6+smooth.texture*.45+pulse*smooth.atmosphere)*3);
        ctx.fillStyle=n+smooth.mass>.25?ROLE_DEFS.form.color:ROLE_DEFS.texture.color;
        ctx.globalAlpha=.28+smooth.master*.6;
        ctx.fillRect(Math.round(x-size/2),Math.round(y-size/2),size,size);
        if(n>1.3-transient){ctx.strokeStyle=ROLE_DEFS.impact.color;ctx.strokeRect(x-3,y-3,6,6);}
      }
    }
    ctx.globalAlpha=1;
  }

  function renderScene(t,dt){
    updateParticles(t,dt);
    const scene=sceneSelect.value;
    if(scene==='particles')drawParticles();
    if(scene==='field')drawField(t);
    if(scene==='dither')drawDither(t);
    if(scene==='terrain')drawTerrain(t);
    if(scene==='phantom')drawPhantom(t);
    if(blackout){ctx.fillStyle='#000';ctx.fillRect(0,0,W,H);}
    vctx.fillStyle='#050505';vctx.fillRect(0,0,view.width,view.height);vctx.imageSmoothingEnabled=false;vctx.drawImage(low,0,0,view.width,view.height);
  }

  function updateHud(){
    const keys=['impact','mass','form','texture','atmosphere','master'];
    signalHud.innerHTML=keys.map(k=>`<span>${ROLE_DEFS[k].label}</span><span class="hud-meter"><span style="width:${Math.round(smooth[k]*100)}%"></span></span>`).join('');
    const loaded=sends.filter(s=>s.loaded);const current=loaded[0]?.audio.currentTime||0;const duration=Math.max(0,...loaded.map(s=>Number.isFinite(s.audio.duration)?s.audio.duration:0));
    timeEl.textContent=fmtTime(current)+' / '+fmtTime(duration||NaN);
  }

  async function startCapture(){
    if(recorder&&recorder.state==='recording'){recorder.stop();return;}
    ensureAudio();await audioCtx.resume();
    const canvasStream=view.captureStream?view.captureStream(30):null;
    if(!canvasStream){alert('Canvas capture is not supported in this browser.');return;}
    const tracks=[...canvasStream.getVideoTracks()];
    if(recordDest)tracks.push(...recordDest.stream.getAudioTracks());
    if(micStream)tracks.push(...micStream.getAudioTracks());
    const stream=new MediaStream(tracks);
    const types=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'];
    const mime=types.find(t=>window.MediaRecorder&&MediaRecorder.isTypeSupported(t))||'';
    try{recorder=new MediaRecorder(stream,mime?{mimeType:mime}:undefined);}catch(e){alert('MediaRecorder is unavailable in this browser.');return;}
    recordChunks=[];
    recorder.ondataavailable=e=>{if(e.data&&e.data.size)recordChunks.push(e.data);};
    recorder.onstop=()=>{
      const blob=new Blob(recordChunks,{type:recorder.mimeType||'video/webm'});const a=document.createElement('a');
      a.href=URL.createObjectURL(blob);a.download='MZ-Visual-Engine-'+new Date().toISOString().replace(/[:.]/g,'-')+'.webm';a.click();
      setTimeout(()=>URL.revokeObjectURL(a.href),4000);recordFlag.classList.remove('active');document.getElementById('recordBtn').textContent='START CAPTURE';
    };
    recorder.start(500);recordFlag.classList.add('active');document.getElementById('recordBtn').textContent='STOP + SAVE';
  }

  function animate(now){
    const dt=Math.min(.033,(now-last)/1000||.016);last=now;const t=now/1000;frame++;
    if(!frozen){sampleAudio(t);renderScene(t,dt);transient*=.91;}
    if(frame%3===0)updateHud();requestAnimationFrame(animate);
  }

  document.getElementById('demoBtn').addEventListener('click',()=>{
    stopAllAudio();stopMic();demoMode=true;playing=true;document.getElementById('demoBtn').classList.add('active');document.getElementById('micBtn').classList.remove('active');sourceLabel.textContent='DEMO SIGNAL / MULTI-SEND SIMULATION';notice.classList.add('hidden');
  });
  document.getElementById('micBtn').addEventListener('click',()=>useMic().catch(e=>{sourceLabel.textContent='LIVE INPUT ERROR / '+e.message.toUpperCase();}));
  document.getElementById('playBtn').addEventListener('click',async()=>{if(playing){pauseAll();document.getElementById('playBtn').textContent='PLAY';}else{await playAll();document.getElementById('playBtn').textContent='PAUSE';}});
  document.getElementById('stopBtn').addEventListener('click',()=>{stopAllAudio();document.getElementById('playBtn').textContent='PLAY';});
  document.getElementById('loopBtn').addEventListener('click',()=>{loop=!loop;document.getElementById('loopBtn').classList.toggle('active',loop);sends.forEach(s=>s.audio.loop=loop);});
  document.getElementById('reseedBtn').addEventListener('click',()=>reseed(true));
  document.getElementById('fullBtn').addEventListener('click',()=>document.getElementById('stage').requestFullscreen?.());
  document.getElementById('blackoutBtn').addEventListener('click',e=>{blackout=!blackout;e.currentTarget.classList.toggle('active',blackout);});
  document.getElementById('freezeBtn').addEventListener('click',e=>{frozen=!frozen;e.currentTarget.classList.toggle('active',frozen);});
  document.getElementById('recordBtn').addEventListener('click',()=>startCapture());
  sceneSelect.addEventListener('change',()=>{sceneName.textContent=sceneSelect.options[sceneSelect.selectedIndex].text;reseed(false);});
  window.addEventListener('resize',resize,{passive:true});

  buildRack();resize();requestAnimationFrame(animate);
})();
