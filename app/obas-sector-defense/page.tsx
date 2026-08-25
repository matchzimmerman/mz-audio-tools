'use client';

import { useEffect, useRef, useState } from 'react';

const SECTORS = 8;
const STEPS = 16;
const VOICES = ['KICK', 'SNARE', 'CLOSED HAT', 'OPEN HAT', 'CLAP', 'TOM', 'PERC', 'FX'];
const COLORS = ['#daff00', '#ff5a36', '#f2f2f2', '#6ee7ff', '#ff85d7', '#ffcf40', '#b6ff7a', '#a890ff'];

type Grid = boolean[][];

function blankGrid(): Grid {
  return Array.from({ length: STEPS }, () => Array(SECTORS).fill(false));
}

function starterGrid(): Grid {
  const g = blankGrid();
  [0, 4, 8, 12].forEach((s) => (g[s][0] = true));
  [4, 12].forEach((s) => (g[s][1] = true));
  for (let s = 0; s < STEPS; s += 2) g[s][2] = true;
  g[7][4] = true;
  g[15][5] = true;
  return g;
}

export default function ObasSectorDefensePage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const gridRef = useRef<Grid>(starterGrid());
  const runningRef = useRef(false);
  const bpmRef = useRef(112);
  const startTimeRef = useRef(0);
  const lastTriggeredRef = useRef(-1);
  const phaseRef = useRef(0);
  const dragPaintRef = useRef<boolean | null>(null);
  const lastPaintCellRef = useRef('');

  const [gridVersion, setGridVersion] = useState(0);
  const [running, setRunning] = useState(false);
  const [bpm, setBpm] = useState(112);
  const [status, setStatus] = useState('PAINT THE FIELD // PRESS PLAY');
  const [step, setStep] = useState(0);

  function ensureAudio() {
    if (!audioRef.current) {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (Ctx) audioRef.current = new Ctx();
    }
    if (audioRef.current?.state === 'suspended') audioRef.current.resume();
    return audioRef.current;
  }

  function noiseBuffer(ctx: AudioContext, seconds: number) {
    const buffer = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * seconds)), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
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

    if ([1, 2, 3, 4, 6].includes(sector)) {
      const src = ctx.createBufferSource();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      const dur = sector === 2 ? 0.045 : sector === 3 ? 0.16 : 0.11;
      src.buffer = noiseBuffer(ctx, dur);
      filter.type = sector === 2 || sector === 3 ? 'highpass' : 'bandpass';
      filter.frequency.value = sector === 2 ? 7000 : sector === 3 ? 5200 : sector === 1 ? 1700 : 1100 + sector * 180;
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

  function triggerStep(index: number) {
    const voices = gridRef.current[index];
    let count = 0;
    voices.forEach((on, sector) => {
      if (on) {
        count += 1;
        playVoice(sector);
      }
    });
    setStep(index);
    setStatus(count ? `STEP ${String(index + 1).padStart(2, '0')} // ${count} VOICE${count === 1 ? '' : 'S'}` : `STEP ${String(index + 1).padStart(2, '0')} // SILENCE`);
  }

  function toggleRun() {
    ensureAudio();
    const next = !runningRef.current;
    runningRef.current = next;
    setRunning(next);
    if (next) {
      const stepMs = 60000 / bpmRef.current / 4;
      startTimeRef.current = performance.now() - phaseRef.current * stepMs;
      lastTriggeredRef.current = Math.floor(phaseRef.current) - 1;
      setStatus('RUNNING // PAINT WHILE IT MOVES');
    } else {
      setStatus('PAUSED // PATTERN HELD');
    }
  }

  function changeBpm(value: number) {
    const next = Math.max(40, Math.min(220, value));
    bpmRef.current = next;
    setBpm(next);
    if (runningRef.current) {
      const stepMs = 60000 / next / 4;
      startTimeRef.current = performance.now() - phaseRef.current * stepMs;
      lastTriggeredRef.current = Math.floor(phaseRef.current) - 1;
    }
  }

  function mutateGrid(mode: 'clear' | 'random') {
    if (mode === 'clear') gridRef.current = blankGrid();
    else {
      const g = blankGrid();
      for (let s = 0; s < STEPS; s++) {
        for (let v = 0; v < SECTORS; v++) {
          const density = v === 2 ? 0.36 : v < 2 ? 0.2 : 0.1;
          g[s][v] = Math.random() < density;
        }
      }
      gridRef.current = g;
    }
    setGridVersion((v) => v + 1);
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
      canvas.width = Math.max(1, Math.floor(r.width * dpr));
      canvas.height = Math.max(1, Math.floor(r.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const geometry = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const cx = w / 2;
      const cy = h / 2;
      const outer = Math.max(150, Math.min(w, h) * 0.45);
      const inner = Math.max(38, outer * 0.13);
      return { w, h, cx, cy, outer, inner, wedge: Math.PI * 2 / SECTORS };
    };

    const ringRadius = (stepIndex: number, stepFloat: number, inner: number, outer: number) => {
      const delta = ((stepIndex - stepFloat) % STEPS + STEPS) % STEPS;
      return inner + (delta / (STEPS - 1)) * (outer - inner);
    };

    const paintFromPointer = (event: PointerEvent, first = false) => {
      const r = canvas.getBoundingClientRect();
      const x = event.clientX - r.left;
      const y = event.clientY - r.top;
      const { cx, cy, outer, inner, wedge } = geometry();
      const dx = x - cx;
      const dy = y - cy;
      const radial = Math.sqrt(dx * dx + dy * dy);
      if (radial < inner * 0.72 || radial > outer + 14) return;

      let angle = Math.atan2(dy, dx) + Math.PI / 2;
      if (angle < 0) angle += Math.PI * 2;
      const sector = Math.min(SECTORS - 1, Math.floor(angle / wedge));
      const stepFloat = phaseRef.current;
      let bestStep = 0;
      let bestDistance = Infinity;
      for (let s = 0; s < STEPS; s++) {
        const rr = ringRadius(s, stepFloat, inner, outer);
        const d = Math.abs(rr - radial);
        if (d < bestDistance) { bestDistance = d; bestStep = s; }
      }
      if (bestDistance > Math.max(16, (outer - inner) / STEPS * 0.7)) return;

      const key = `${bestStep}:${sector}`;
      if (key === lastPaintCellRef.current && !first) return;
      lastPaintCellRef.current = key;

      if (first || dragPaintRef.current === null) dragPaintRef.current = !gridRef.current[bestStep][sector];
      gridRef.current[bestStep][sector] = Boolean(dragPaintRef.current);
      setGridVersion((v) => v + 1);
      if (dragPaintRef.current) playVoice(sector);
    };

    const onDown = (event: PointerEvent) => {
      canvas.setPointerCapture(event.pointerId);
      dragPaintRef.current = null;
      lastPaintCellRef.current = '';
      paintFromPointer(event, true);
    };
    const onMove = (event: PointerEvent) => {
      if (!canvas.hasPointerCapture(event.pointerId)) return;
      paintFromPointer(event, false);
    };
    const onUp = (event: PointerEvent) => {
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      dragPaintRef.current = null;
      lastPaintCellRef.current = '';
    };

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);

    const draw = (now: number) => {
      const { w, h, cx, cy, outer, inner, wedge } = geometry();
      ctx.fillStyle = '#050505';
      ctx.fillRect(0, 0, w, h);

      const stepMs = 60000 / bpmRef.current / 4;
      if (runningRef.current) phaseRef.current = (now - startTimeRef.current) / stepMs;
      const stepFloat = phaseRef.current;
      const absoluteStep = Math.floor(stepFloat);

      if (runningRef.current && absoluteStep > lastTriggeredRef.current) {
        while (lastTriggeredRef.current < absoluteStep) {
          lastTriggeredRef.current += 1;
          triggerStep(((lastTriggeredRef.current % STEPS) + STEPS) % STEPS);
        }
      }

      for (let s = 0; s < SECTORS; s++) {
        const a0 = -Math.PI / 2 + s * wedge;
        const a1 = a0 + wedge;
        const am = (a0 + a1) / 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a0) * outer, cy + Math.sin(a0) * outer);
        ctx.strokeStyle = 'rgba(255,255,255,.12)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = COLORS[s];
        ctx.font = '700 11px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(VOICES[s], cx + Math.cos(am) * (outer + 26), cy + Math.sin(am) * (outer + 26));
      }

      for (let s = 0; s < STEPS; s++) {
        const rr = ringRadius(s, stepFloat, inner, outer);
        const downbeat = s % 4 === 0;
        ctx.beginPath();
        ctx.arc(cx, cy, rr, 0, Math.PI * 2);
        ctx.strokeStyle = downbeat ? 'rgba(218,255,0,.34)' : 'rgba(255,255,255,.12)';
        ctx.lineWidth = downbeat ? 1.6 : 1;
        ctx.stroke();

        for (let sector = 0; sector < SECTORS; sector++) {
          if (!gridRef.current[s][sector]) continue;
          const a0 = -Math.PI / 2 + sector * wedge + 0.025;
          const a1 = a0 + wedge - 0.05;
          const band = Math.max(5, (outer - inner) / STEPS * 0.34);
          ctx.beginPath();
          ctx.arc(cx, cy, rr + band, a0, a1);
          ctx.arc(cx, cy, Math.max(inner * 0.7, rr - band), a1, a0, true);
          ctx.closePath();
          ctx.fillStyle = COLORS[sector];
          ctx.globalAlpha = rr < inner + 16 ? 1 : 0.82;
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }

      ctx.beginPath();
      ctx.arc(cx, cy, inner, 0, Math.PI * 2);
      ctx.fillStyle = '#050505';
      ctx.fill();
      ctx.strokeStyle = '#daff00';
      ctx.lineWidth = 3;
      ctx.stroke();

      const pulse = runningRef.current ? 1 - (stepFloat - Math.floor(stepFloat)) : 0;
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(8, inner * 0.34 + pulse * 5), 0, Math.PI * 2);
      ctx.fillStyle = '#daff00';
      ctx.fill();

      ctx.fillStyle = 'rgba(255,255,255,.55)';
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.round(bpmRef.current)} BPM`, cx, cy + 3);

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
    };
  }, [gridVersion]);

  return (
    <main style={{ minHeight: '100vh', background: '#050505', color: '#daff00', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', padding: 18 }}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 12, fontSize: 12, letterSpacing: '.12em' }}>
          <span>HARIL OS // OBAS POLAR SEQUENCER</span>
          <span>STEP {String(step + 1).padStart(2, '0')} / {STEPS}</span>
        </div>

        <div style={{ border: '1px solid #313131', background: '#000' }}>
          <canvas ref={canvasRef} style={{ width: '100%', height: 'min(74vw, 760px)', minHeight: 520, display: 'block', touchAction: 'none', cursor: 'crosshair' }} />
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginTop: 12 }}>
          <button onClick={toggleRun} style={{ minHeight: 46, padding: '0 18px', border: '1px solid #daff00', background: running ? '#daff00' : '#050505', color: running ? '#050505' : '#daff00', font: 'inherit', cursor: 'pointer' }}>
            {running ? 'PAUSE' : 'PLAY'}
          </button>
          <button onClick={() => mutateGrid('clear')} style={{ minHeight: 46, padding: '0 16px', border: '1px solid #555', background: '#050505', color: '#eee', font: 'inherit', cursor: 'pointer' }}>CLEAR</button>
          <button onClick={() => mutateGrid('random')} style={{ minHeight: 46, padding: '0 16px', border: '1px solid #555', background: '#050505', color: '#eee', font: 'inherit', cursor: 'pointer' }}>MUTATE</button>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 46, padding: '0 12px', border: '1px solid #313131', color: '#eee', fontSize: 12 }}>
            BPM
            <input type="range" min="40" max="220" value={bpm} onChange={(e) => changeBpm(Number(e.target.value))} style={{ width: 150 }} />
            <strong style={{ color: '#daff00', minWidth: 34 }}>{bpm}</strong>
          </label>
          <div style={{ flex: '1 1 280px', minHeight: 46, border: '1px solid #313131', display: 'flex', alignItems: 'center', padding: '0 14px', color: '#eee', fontSize: 12 }}>
            {status}
          </div>
        </div>

        <p style={{ color: '#8c8c8c', fontSize: 12, lineHeight: 1.55, marginTop: 10 }}>
          Paint directly into the moving polar grid. Pie slices are voices; concentric circles are 16th-note steps. Rings travel inward at the selected BPM. When a painted cell reaches the center ring, that voice sounds. Drag across the field to draw rhythmic shapes while the sequence is running.
        </p>
      </div>
    </main>
  );
}
