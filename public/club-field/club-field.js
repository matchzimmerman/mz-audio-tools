(() => {
  const cities = [
    {name:'Baltimore', x:320,y:70},
    {name:'London', x:545,y:235},
    {name:'Kingston', x:460,y:500},
    {name:'Berlin', x:180,y:500},
    {name:'Detroit', x:95,y:235},
  ];

  // Research-informed placeholders for the prototype. Values are continuous control targets,
  // not claims that a city has one fixed sound. They are intended to be refined track-by-track.
  const profiles = [
    { // Baltimore
      swing:.34, kickHz:74, kickDecay:.16, kickDrop:1.0, kickDrive:.82, sub:.18,
      snareBright:.72, hat:.56, delay:.05, feedback:.08, verb:.05, width:.18,
      panSnare:-.08, stab:.10, offbeat:.18, filter:5200, breakiness:.72, density:.72
    },
    { // London
      swing:.64, kickHz:50, kickDecay:.34, kickDrop:.65, kickDrive:.48, sub:.88,
      snareBright:.68, hat:.78, delay:.15, feedback:.18, verb:.12, width:.70,
      panSnare:.18, stab:.18, offbeat:.54, filter:7600, breakiness:.92, density:.82
    },
    { // Kingston
      swing:.43, kickHz:58, kickDecay:.27, kickDrop:.48, kickDrive:.38, sub:.82,
      snareBright:.50, hat:.42, delay:.74, feedback:.62, verb:.46, width:.82,
      panSnare:-.38, stab:.82, offbeat:.92, filter:4100, breakiness:.28, density:.42
    },
    { // Berlin
      swing:.08, kickHz:55, kickDecay:.24, kickDrop:.78, kickDrive:.62, sub:.46,
      snareBright:.62, hat:.70, delay:.10, feedback:.13, verb:.22, width:.36,
      panSnare:.02, stab:.12, offbeat:.16, filter:6800, breakiness:.18, density:.61
    },
    { // Detroit
      swing:.24, kickHz:61, kickDecay:.21, kickDrop:.72, kickDrive:.56, sub:.54,
      snareBright:.80, hat:.73, delay:.11, feedback:.15, verb:.13, width:.58,
      panSnare:.28, stab:.58, offbeat:.46, filter:8400, breakiness:.43, density:.68
    }
  ];

  const patterns = {
    baltimore: {
      bpm:132,
      kick:[1,0,0,1, 0,1,0,0, 1,0,1,0, 0,1,0,1],
      snare:[0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0],
      hat:[1,0,1,1, 1,0,1,0, 1,1,1,0, 1,0,1,1],
      bass:[0,0,0,1, 0,1,0,0, 0,0,1,0, 0,1,0,0],
      stab:[0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0]
    },
    london: {
      bpm:134,
      kick:[1,0,0,0, 0,0,1,0, 1,0,0,0, 0,1,0,0],
      snare:[0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
      hat:[1,1,0,1, 0,1,1,1, 1,0,1,1, 0,1,1,0],
      bass:[1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1],
      stab:[0,0,0,0, 0,0,0,1, 0,0,0,0, 0,0,0,0]
    },
    kingston: {
      bpm:100,
      kick:[1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
      snare:[0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
      hat:[0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0],
      bass:[1,0,0,0, 0,0,1,0, 0,0,0,0, 1,0,0,0],
      stab:[0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0]
    },
    berlin: {
      bpm:132,
      kick:[1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
      snare:[0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
      hat:[0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0],
      bass:[1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
      stab:[0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0]
    },
    detroit: {
      bpm:128,
      kick:[1,0,0,0, 1,0,0,1, 1,0,0,0, 1,0,1,0],
      snare:[0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
      hat:[1,0,1,0, 1,1,1,0, 1,0,1,1, 1,0,1,0],
      bass:[1,0,0,0, 0,0,1,0, 0,0,1,0, 0,1,0,0],
      stab:[0,0,0,1, 0,0,0,0, 0,0,1,0, 0,0,0,0]
    }
  };

  let coreName = 'baltimore';
  let pos = {x:320,y:300};
  let weights = [0.2,0.2,0.2,0.2,0.2];
  let audio = null, playing = false, timer = null, step = 0, nextTime = 0;
  let noiseBuffer = null;

  const field = document.getElementById('field');
  const puck = document.getElementById('puck');
  const playBtn = document.getElementById('playBtn');
  const resetBtn = document.getElementById('resetBtn');
  const bpmRead = document.getElementById('bpmRead');

  function pointInPoly(p, vs){
    let inside=false;
    for(let i=0,j=vs.length-1;i<vs.length;j=i++){
      const xi=vs[i].x, yi=vs[i].y, xj=vs[j].x, yj=vs[j].y;
      const intersect=((yi>p.y)!=(yj>p.y)) && (p.x < (xj-xi)*(p.y-yi)/(yj-yi)+xi);
      if(intersect) inside=!inside;
    }
    return inside;
  }
  function nearestInside(p){
    if(pointInPoly(p,cities)) return p;
    let q={...p};
    for(let i=0;i<50 && !pointInPoly(q,cities);i++){
      q.x += (320-q.x)*.08; q.y += (300-q.y)*.08;
    }
    return q;
  }
  function computeWeights(p){
    const power=2.15, eps=900;
    let raw=cities.map(c=>1/(Math.pow(Math.hypot(p.x-c.x,p.y-c.y),power)+eps));
    const sum=raw.reduce((a,b)=>a+b,0);
    return raw.map(v=>v/sum);
  }
  function blend(key){
    return profiles.reduce((s,p,i)=>s+p[key]*weights[i],0);
  }
  function updateVisual(){
    const circles=puck.querySelectorAll('circle');
    circles.forEach(c=>{c.setAttribute('cx',pos.x);c.setAttribute('cy',pos.y)});
    weights = computeWeights(pos);
    for(let i=0;i<5;i++){
      const pct=Math.round(weights[i]*100);
      document.getElementById('w'+i).textContent=pct+'%';
      document.getElementById('b'+i).style.width=pct+'%';
      document.getElementById('a'+i).classList.toggle('live',weights[i]===Math.max(...weights));
    }
    const kickHz=blend('kickHz'), kd=blend('kickDecay'), sub=blend('sub'), space=(blend('delay')+blend('verb'))/2, width=blend('width');
    document.getElementById('kickT').textContent=(kickHz<57?'DEEP':kickHz>67?'HIGH':'MID')+' / '+(kd>.27?'LONG':kd>.20?'MED':'SHORT');
    document.getElementById('subT').textContent=sub>.68?'STRUCTURAL':sub>.42?'MED':'LOW';
    document.getElementById('spaceT').textContent=space>.42?'DUB / WIDE':space>.20?'OPEN':'DEAD / DIRECT';
    document.getElementById('stereoT').textContent=width>.65?'WIDE':width>.38?'MED':'NARROW';
    updateAudioParams();
  }
  function fieldPoint(e){
    const r=field.getBoundingClientRect();
    return nearestInside({x:(e.clientX-r.left)/r.width*640,y:(e.clientY-r.top)/r.height*600});
  }
  let dragging=false;
  field.addEventListener('pointerdown',e=>{dragging=true;field.setPointerCapture(e.pointerId);pos=fieldPoint(e);updateVisual()});
  field.addEventListener('pointermove',e=>{if(!dragging)return;pos=fieldPoint(e);updateVisual()});
  field.addEventListener('pointerup',()=>dragging=false);
  field.addEventListener('pointercancel',()=>dragging=false);
  field.addEventListener('keydown',e=>{
    const amount=e.shiftKey?20:8;
    if(e.key==='ArrowLeft')pos.x-=amount;
    else if(e.key==='ArrowRight')pos.x+=amount;
    else if(e.key==='ArrowUp')pos.y-=amount;
    else if(e.key==='ArrowDown')pos.y+=amount;
    else return;
    e.preventDefault(); pos=nearestInside(pos); updateVisual();
  });
  resetBtn.addEventListener('click',()=>{pos={x:320,y:300};updateVisual()});

  document.querySelectorAll('.core button').forEach(btn=>{
    btn.addEventListener('click',()=>{
      document.querySelectorAll('.core button').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active'); coreName=btn.dataset.core; bpmRead.textContent=patterns[coreName].bpm;
      if(playing){ step=0; nextTime=audio.ctx.currentTime+.05; }
    });
  });

  function makeImpulse(ctx, seconds=2.2, decay=3.2){
    const len=Math.floor(ctx.sampleRate*seconds), b=ctx.createBuffer(2,len,ctx.sampleRate);
    for(let ch=0;ch<2;ch++){
      const data=b.getChannelData(ch);
      for(let i=0;i<len;i++) data[i]=(Math.random()*2-1)*Math.pow(1-i/len,decay);
    }
    return b;
  }
  function makeNoise(ctx){
    const b=ctx.createBuffer(1,ctx.sampleRate,ctx.sampleRate);
    const d=b.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1;
    return b;
  }
  function initAudio(){
    if(audio) return;
    const AC=window.AudioContext||window.webkitAudioContext;
    const ctx=new AC();

    const master=ctx.createGain(); master.gain.value=.54;
    const comp=ctx.createDynamicsCompressor();
    comp.threshold.value=-11; comp.knee.value=8; comp.ratio.value=7; comp.attack.value=.003; comp.release.value=.16;
    master.connect(comp).connect(ctx.destination);

    const dry=ctx.createGain(), delayIn=ctx.createGain(), reverbIn=ctx.createGain();
    const delay=ctx.createDelay(1.0), feedback=ctx.createGain(), delayPan=ctx.createStereoPanner();
    const convolver=ctx.createConvolver(), verbGain=ctx.createGain();
    convolver.buffer=makeImpulse(ctx);
    dry.connect(master);
    delayIn.connect(delay); delay.connect(feedback); feedback.connect(delay); delay.connect(delayPan).connect(master);
    reverbIn.connect(convolver).connect(verbGain).connect(master);

    audio={ctx,master,dry,delayIn,reverbIn,delay,feedback,delayPan,verbGain};
    noiseBuffer=makeNoise(ctx);
    updateAudioParams();
  }
  function updateAudioParams(){
    if(!audio)return;
    const t=audio.ctx.currentTime;
    const delayAmt=blend('delay'), verb=blend('verb'), width=blend('width');
    audio.delay.delayTime.setTargetAtTime(.065 + delayAmt*.31,t,.025);
    audio.feedback.gain.setTargetAtTime(Math.min(.68,blend('feedback')),t,.025);
    audio.delayPan.pan.setTargetAtTime(-.75+width*1.5,t,.025);
    audio.verbGain.gain.setTargetAtTime(verb*.62,t,.025);
  }
  function connectVoice(node, dryGain=1, sendD=.15, sendR=.1){
    const ctx=audio.ctx;
    const g=ctx.createGain();g.gain.value=dryGain;node.connect(g).connect(audio.dry);
    const d=ctx.createGain();d.gain.value=sendD;node.connect(d).connect(audio.delayIn);
    const r=ctx.createGain();r.gain.value=sendR;node.connect(r).connect(audio.reverbIn);
  }
  function satCurve(amount){
    const n=256, c=new Float32Array(n), k=1+amount*40;
    for(let i=0;i<n;i++){const x=i*2/n-1;c[i]=(1+k)*x/(1+k*Math.abs(x))}
    return c;
  }
  function kick(t,vel=1){
    const ctx=audio.ctx, osc=ctx.createOscillator(), g=ctx.createGain(), sh=ctx.createWaveShaper(), pan=ctx.createStereoPanner();
    const hz=blend('kickHz'), decay=blend('kickDecay'), drive=blend('kickDrive'), drop=blend('kickDrop');
    osc.type='sine'; osc.frequency.setValueAtTime(hz*(2.4+drop*2.6),t); osc.frequency.exponentialRampToValueAtTime(hz,t+.025+drop*.025);
    g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.95*vel,t+.004);g.gain.exponentialRampToValueAtTime(.0001,t+decay);
    sh.curve=satCurve(drive);sh.oversample='2x';pan.pan.value=0;
    osc.connect(g).connect(sh).connect(pan); connectVoice(pan,.9,.04+blend('delay')*.12,.02+blend('verb')*.10);
    osc.start(t);osc.stop(t+decay+.06);
  }
  function snare(t,vel=1){
    const ctx=audio.ctx, n=ctx.createBufferSource(), bp=ctx.createBiquadFilter(), g=ctx.createGain(), pan=ctx.createStereoPanner();
    n.buffer=noiseBuffer;bp.type='bandpass';bp.frequency.value=1300+blend('snareBright')*4800;bp.Q.value=.7;
    g.gain.setValueAtTime(.55*vel,t);g.gain.exponentialRampToValueAtTime(.0001,t+.065+blend('verb')*.08);
    pan.pan.value=blend('panSnare');
    n.connect(bp).connect(g).connect(pan);connectVoice(pan,.74,.10+blend('delay')*.42,.05+blend('verb')*.36);
    n.start(t);n.stop(t+.16);
  }
  function hat(t,vel=.7){
    const ctx=audio.ctx,n=ctx.createBufferSource(),hp=ctx.createBiquadFilter(),g=ctx.createGain(),pan=ctx.createStereoPanner();
    n.buffer=noiseBuffer;hp.type='highpass';hp.frequency.value=5200+blend('filter')*.30;
    g.gain.setValueAtTime(.18*vel,t);g.gain.exponentialRampToValueAtTime(.0001,t+.025+blend('width')*.025);
    pan.pan.value=(Math.random()-.5)*blend('width')*.9;
    n.connect(hp).connect(g).connect(pan);connectVoice(pan,.72,.04+blend('delay')*.12,.03+blend('verb')*.12);
    n.start(t);n.stop(t+.08);
  }
  function bass(t,vel=.7){
    const ctx=audio.ctx,o=ctx.createOscillator(),lp=ctx.createBiquadFilter(),g=ctx.createGain(),pan=ctx.createStereoPanner();
    const sub=blend('sub'), base=38+weights[1]*4+weights[2]*3;
    o.type=weights[4]>.28?'sawtooth':'sine';o.frequency.value=base;
    lp.type='lowpass';lp.frequency.value=90+sub*330;lp.Q.value=.8+weights[1]*2.2;
    g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime((.22+.30*sub)*vel,t+.012);g.gain.exponentialRampToValueAtTime(.0001,t+.16+.22*sub);
    pan.pan.value=0;o.connect(lp).connect(g).connect(pan);connectVoice(pan,.95,.01+blend('delay')*.09,.01+blend('verb')*.06);
    o.start(t);o.stop(t+.48);
  }
  function stab(t,vel=.65){
    const ctx=audio.ctx, sum=ctx.createGain(), filt=ctx.createBiquadFilter(), g=ctx.createGain(), pan=ctx.createStereoPanner();
    const freqs=[261.63,329.63,392.0]; freqs.forEach((f,i)=>{const o=ctx.createOscillator();o.type=i===0?'triangle':'square';o.frequency.value=f*(weights[2]>.35?1:2);o.connect(sum);o.start(t);o.stop(t+.18)});
    filt.type='bandpass';filt.frequency.value=650+blend('filter')*.18;filt.Q.value=1.5;
    g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.07*vel*(.4+blend('stab')),t+.006);g.gain.exponentialRampToValueAtTime(.0001,t+.11);
    pan.pan.value=-.2+weights[2]*.55;sum.connect(filt).connect(g).connect(pan);connectVoice(pan,.55,.12+blend('delay')*.60,.10+blend('verb')*.45);
  }

  function scheduleStep(i,t){
    const p=patterns[coreName];
    const swing=blend('swing');
    const swung = (i%2===1) ? (60/p.bpm/4)*(swing*.30) : 0;
    t += swung;

    if(p.kick[i]) kick(t,1);
    if(p.snare[i]) snare(t,.92);
    if(p.hat[i] && Math.random()<(.60+blend('hat')*.40)) hat(t,.72);
    if(p.bass[i] && Math.random()<(.30+blend('sub')*.70)) bass(t,.78);
    if((p.stab[i] || (i%4===2 && Math.random()<blend('stab')*.22)) && Math.random()<(.2+blend('stab')*.8)) stab(t,.8);

    const density=blend('density'), breakiness=blend('breakiness'), off=blend('offbeat');
    if(!p.hat[i] && Math.random()<density*.12) hat(t+.005,.45);
    if(!p.snare[i] && i%2===1 && Math.random()<breakiness*.045) snare(t+.008,.32);
    if(!p.kick[i] && (i%4===3) && Math.random()<off*.055) kick(t+.004,.48);
  }
  function scheduler(){
    if(!playing || !audio)return;
    const ctx=audio.ctx,p=patterns[coreName], sixteenth=60/p.bpm/4;
    while(nextTime<ctx.currentTime+.10){
      scheduleStep(step,nextTime);
      nextTime+=sixteenth;step=(step+1)%16;
    }
  }
  playBtn.addEventListener('click',async()=>{
    initAudio();
    if(audio.ctx.state==='suspended') await audio.ctx.resume();
    playing=!playing;
    if(playing){
      playBtn.textContent='■ STOP';playBtn.classList.add('active');step=0;nextTime=audio.ctx.currentTime+.05;
      timer=setInterval(scheduler,25);scheduler();
    }else{
      playBtn.textContent='▶ START AUDIO';playBtn.classList.remove('active');clearInterval(timer);
    }
  });

  updateVisual();
})();
