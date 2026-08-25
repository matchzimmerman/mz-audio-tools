'use client';

import { useEffect, useRef, useState } from 'react';

const SECTORS = 8;
const WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4,
  five: 5, six: 6, seven: 7, eight: 8,
};

type Invader = { id: number; sector: number; r: number; speed: number; wobble: number };
type Blast = { sector: number; life: number };

function parseSector(text: string) {
  const t = text.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  for (const [word, n] of Object.entries(WORDS)) {
    if (
      t.includes(`sector ${word}`) ||
      t.includes(`sector ${n}`) ||
      t === word ||
      t === String(n)
    ) return n;
  }
  return null;
}

export default function ObasSectorDefensePage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const invadersRef = useRef<Invader[]>([]);
  const blastsRef = useRef<Blast[]>([]);
  const nextIdRef = useRef(1);
  const recognitionRef = useRef<any>(null);
  const shouldListenRef = useRef(false);

  const [score, setScore] = useState(0);
  const [core, setCore] = useState(100);
  const [heard, setHeard] = useState('VOICE OFFLINE');
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const [started, setStarted] = useState(false);

  function fireSector(sector: number) {
    blastsRef.current.push({ sector, life: 1 });
    let hits = 0;
    invadersRef.current = invadersRef.current.filter((inv) => {
      if (inv.sector === sector) { hits += 1; return false; }
      return true;
    });
    if (hits) setScore((s) => s + hits * 100);
    setHeard(`SECTOR ${sector} // FIRE`);
  }

  useEffect(() => {
    const Recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Recognition) {
      setSupported(false);
      setHeard('VOICE UNSUPPORTED IN THIS BROWSER');
      return;
    }

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setListening(true);
      setHeard('LISTENING // SAY “SECTOR THREE”');
    };

    recognition.onresult = (event: any) => {
      let transcript = '';
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const chunk = event.results[i]?.[0]?.transcript || '';
        transcript += chunk;
        if (event.results[i]?.isFinal) finalTranscript += chunk;
      }

      if (transcript.trim()) setHeard(transcript.trim().toUpperCase());

      if (finalTranscript.trim()) {
        const sector = parseSector(finalTranscript);
        if (sector) fireSector(sector);
        else setHeard(`${finalTranscript.trim().toUpperCase()} // NO SECTOR MATCH`);
      }
    };

    recognition.onerror = (event: any) => {
      const code = String(event?.error || 'unknown').toUpperCase();
      setHeard(`VOICE ERROR // ${code}`);
      if (code === 'NOT-ALLOWED' || code === 'SERVICE-NOT-ALLOWED') {
        shouldListenRef.current = false;
        setListening(false);
      }
    };

    recognition.onend = () => {
      setListening(false);
      if (shouldListenRef.current) {
        window.setTimeout(() => {
          if (!shouldListenRef.current) return;
          try { recognition.start(); } catch {}
        }, 180);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      shouldListenRef.current = false;
      recognitionRef.current = null;
      try { recognition.abort(); } catch {}
    };
  }, []);

  function toggleVoice() {
    const recognition = recognitionRef.current;
    if (!recognition) {
      setHeard('VOICE ENGINE NOT READY');
      return;
    }

    if (!shouldListenRef.current) {
      shouldListenRef.current = true;
      setHeard('REQUESTING MICROPHONE // SAY “SECTOR THREE”');
      try {
        recognition.start();
      } catch (err: any) {
        setHeard(`VOICE START ERROR // ${String(err?.message || err).toUpperCase()}`);
      }
    } else {
      shouldListenRef.current = false;
      setListening(false);
      try { recognition.stop(); } catch {}
      setHeard('VOICE OFFLINE');
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    let last = performance.now();
    let spawnClock = 0;

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

    const draw = (now: number) => {
      const dt = Math.min(40, now - last);
      last = now;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const cx = w / 2;
      const cy = h / 2;
      const radius = Math.max(100, Math.min(w, h) * 0.44);

      ctx.fillStyle = '#050505';
      ctx.fillRect(0, 0, w, h);

      for (let i = 0; i < SECTORS; i++) {
        const a0 = -Math.PI / 2 + i * (Math.PI * 2 / SECTORS);
        const a1 = a0 + Math.PI * 2 / SECTORS;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, radius, a0, a1);
        ctx.closePath();
        ctx.strokeStyle = 'rgba(218,255,0,.16)';
        ctx.lineWidth = 1;
        ctx.stroke();

        const am = (a0 + a1) / 2;
        ctx.fillStyle = 'rgba(218,255,0,.72)';
        ctx.font = '11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`S${i + 1}`, cx + Math.cos(am) * (radius - 18), cy + Math.sin(am) * (radius - 18));
      }

      if (started) {
        spawnClock += dt;
        if (spawnClock > 820) {
          spawnClock = 0;
          invadersRef.current.push({
            id: nextIdRef.current++,
            sector: 1 + Math.floor(Math.random() * SECTORS),
            r: radius - 20,
            speed: 0.025 + Math.random() * 0.018,
            wobble: Math.random() * Math.PI * 2,
          });
        }
      }

      const survivors: Invader[] = [];
      for (const inv of invadersRef.current) {
        inv.r -= inv.speed * dt;
        inv.wobble += dt * 0.003;
        if (inv.r < 34) {
          setCore((v) => Math.max(0, v - 8));
          continue;
        }
        survivors.push(inv);
        const am = -Math.PI / 2 + (inv.sector - 0.5) * (Math.PI * 2 / SECTORS);
        const drift = Math.sin(inv.wobble) * 0.05;
        const x = cx + Math.cos(am + drift) * inv.r;
        const y = cy + Math.sin(am + drift) * inv.r;
        ctx.fillStyle = '#daff00';
        ctx.fillRect(Math.round(x - 6), Math.round(y - 6), 12, 12);
        ctx.fillStyle = '#050505';
        ctx.fillRect(Math.round(x - 2), Math.round(y - 2), 4, 4);
      }
      invadersRef.current = survivors;

      blastsRef.current = blastsRef.current.filter((b) => {
        b.life -= dt * 0.0045;
        if (b.life <= 0) return false;
        const a0 = -Math.PI / 2 + (b.sector - 1) * (Math.PI * 2 / SECTORS);
        const a1 = a0 + Math.PI * 2 / SECTORS;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, radius, a0, a1);
        ctx.closePath();
        ctx.fillStyle = `rgba(218,255,0,${Math.max(0, b.life) * 0.82})`;
        ctx.fill();
        return true;
      });

      ctx.beginPath();
      ctx.arc(cx, cy, 22, 0, Math.PI * 2);
      ctx.fillStyle = '#daff00';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy, 8 + Math.sin(now * 0.006) * 2, 0, Math.PI * 2);
      ctx.fillStyle = '#050505';
      ctx.fill();

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [started]);

  return (
    <main style={{ minHeight: '100vh', background: '#050505', color: '#daff00', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', padding: '18px' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 12, fontSize: 12, letterSpacing: '.12em' }}>
          <span>HARIL OS // OBAS SECTOR DEFENSE</span>
          <span>SCORE {String(score).padStart(6, '0')} // CORE {core}%</span>
        </div>

        <div style={{ border: '1px solid #313131', background: '#000' }}>
          <canvas ref={canvasRef} style={{ width: '100%', height: 'min(68vw, 680px)', minHeight: 420, display: 'block' }} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 8, marginTop: 10 }}>
          {Array.from({ length: 8 }, (_, i) => i + 1).map((n) => (
            <button key={n} onClick={() => fireSector(n)} style={{ minHeight: 44, border: '1px solid #daff00', background: '#050505', color: '#daff00', font: 'inherit', cursor: 'pointer' }}>
              SECTOR {n}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
          <button onClick={() => setStarted((v) => !v)} style={{ minHeight: 46, padding: '0 18px', border: '1px solid #daff00', background: started ? '#daff00' : '#050505', color: started ? '#050505' : '#daff00', font: 'inherit', cursor: 'pointer' }}>
            {started ? 'PAUSE INVASION' : 'START INVASION'}
          </button>
          <button onClick={toggleVoice} disabled={!supported} style={{ minHeight: 46, padding: '0 18px', border: '1px solid #daff00', background: listening ? '#daff00' : '#050505', color: listening ? '#050505' : '#daff00', font: 'inherit', cursor: supported ? 'pointer' : 'not-allowed', opacity: supported ? 1 : .4 }}>
            {supported ? (listening ? 'VOICE ACTIVE' : 'ENABLE VOICE') : 'VOICE UNSUPPORTED'}
          </button>
          <div style={{ flex: '1 1 280px', minHeight: 46, border: '1px solid #313131', display: 'flex', alignItems: 'center', padding: '0 14px', color: '#eee', fontSize: 12 }}>
            {heard}
          </div>
        </div>

        <p style={{ color: '#8c8c8c', fontSize: 12, lineHeight: 1.5, marginTop: 10 }}>
          Call “Sector one” through “Sector eight.” The status panel now shows the live transcript or the exact browser speech error. Manual sector keys remain active as fallback controls.
        </p>
      </div>
    </main>
  );
}
