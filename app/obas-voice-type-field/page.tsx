'use client';

import { useEffect, useRef, useState } from 'react';

type Metrics = {
  rms: number;
  peak: number;
  attack: number;
  pause: number;
  rate: number;
};

const MAX_WORDS = 4;

function tailWords(value: string, count = MAX_WORDS) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  return words.slice(-count).join(' ').toUpperCase();
}

export default function ObasVoiceTypeFieldPage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const shouldListenRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const prevRmsRef = useRef(0);
  const lastVoiceAtRef = useRef(performance.now());
  const lastTranscriptAtRef = useRef(performance.now());
  const recentWordsRef = useRef<string[]>([]);
  const wordTimesRef = useRef<number[]>([]);

  const [active, setActive] = useState(false);
  const [supported, setSupported] = useState(true);
  const [status, setStatus] = useState('VOICE FIELD OFFLINE');
  const [text, setText] = useState('SPEAK');
  const [metrics, setMetrics] = useState<Metrics>({ rms: 0, peak: 0, attack: 0, pause: 0, rate: 0 });

  useEffect(() => {
    const Recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Recognition) {
      setSupported(false);
      setStatus('SPEECH RECOGNITION UNSUPPORTED');
      return;
    }

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setActive(true);
      setStatus('LISTENING');
    };

    recognition.onresult = (event: any) => {
      const now = performance.now();
      let newest = '';

      // Always take the newest recognition hypothesis instead of waiting for a phrase to finalize.
      for (let i = event.results.length - 1; i >= 0; i--) {
        const chunk = event.results[i]?.[0]?.transcript?.trim();
        if (chunk) {
          newest = chunk;
          break;
        }
      }

      if (!newest) return;
      lastTranscriptAtRef.current = now;

      const words = newest.split(/\s+/).filter(Boolean);
      recentWordsRef.current = words.slice(-MAX_WORDS);
      const shown = recentWordsRef.current.join(' ').toUpperCase();
      setText(shown || 'SPEAK');

      wordTimesRef.current.push(now);
      wordTimesRef.current = wordTimesRef.current.filter((t) => now - t < 1800);
      const rate = wordTimesRef.current.length / 1.8;
      setMetrics((m) => ({ ...m, rate }));
    };

    recognition.onerror = (event: any) => {
      const code = String(event?.error || 'unknown').toUpperCase();
      setStatus(`VOICE ERROR // ${code}`);
      if (code === 'NOT-ALLOWED' || code === 'SERVICE-NOT-ALLOWED') {
        shouldListenRef.current = false;
        setActive(false);
      }
    };

    recognition.onend = () => {
      setActive(false);
      if (shouldListenRef.current) {
        window.setTimeout(() => {
          if (!shouldListenRef.current) return;
          try { recognition.start(); } catch {}
        }, 120);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      shouldListenRef.current = false;
      try { recognition.abort(); } catch {}
      recognitionRef.current = null;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      audioContextRef.current?.close().catch(() => {});
    };
  }, []);

  function startMeter() {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const data = new Uint8Array(analyser.fftSize);

    const tick = () => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      let peak = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        const av = Math.abs(v);
        sum += v * v;
        if (av > peak) peak = av;
      }

      const rms = Math.sqrt(sum / data.length);
      const attack = Math.max(0, rms - prevRmsRef.current);
      prevRmsRef.current = rms;

      const now = performance.now();
      if (rms > 0.025) lastVoiceAtRef.current = now;
      const pause = Math.min(1, (now - lastVoiceAtRef.current) / 900);

      // Clear stale recognition text fast so old words do not hang on screen.
      if (shouldListenRef.current && now - lastTranscriptAtRef.current > 650 && pause > 0.45) {
        recentWordsRef.current = [];
        setText('');
      }

      setMetrics((m) => ({
        rms: m.rms * 0.62 + rms * 0.38,
        peak: Math.max(peak, m.peak * 0.82),
        attack: m.attack * 0.5 + attack * 0.5,
        pause,
        rate: m.rate * 0.94,
      }));

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }

  async function startVoiceField() {
    if (!supported) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false },
      });
      streamRef.current = stream;

      const AudioCtor = window.AudioContext || (window as any).webkitAudioContext;
      const context = new AudioCtor();
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.35;
      source.connect(analyser);
      audioContextRef.current = context;
      analyserRef.current = analyser;
      startMeter();

      shouldListenRef.current = true;
      lastTranscriptAtRef.current = performance.now();
      setStatus('REQUESTING SPEECH ENGINE');
      try { recognitionRef.current?.start(); } catch {}
    } catch (err: any) {
      setStatus(`MIC ERROR // ${String(err?.name || err).toUpperCase()}`);
    }
  }

  function stopVoiceField() {
    shouldListenRef.current = false;
    try { recognitionRef.current?.stop(); } catch {}
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    audioContextRef.current?.close().catch(() => {});
    audioContextRef.current = null;
    analyserRef.current = null;
    recentWordsRef.current = [];
    wordTimesRef.current = [];
    setActive(false);
    setStatus('VOICE FIELD OFFLINE');
    setText('SPEAK');
    setMetrics({ rms: 0, peak: 0, attack: 0, pause: 0, rate: 0 });
  }

  const energy = Math.min(1, metrics.rms * 5.6);
  const attack = Math.min(1, metrics.attack * 14);
  const hue = Math.round((18 + energy * 290 + metrics.rate * 22) % 360);
  const hue2 = (hue + 105) % 360;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Intentionally tiny internal resolution. The browser enlarges this with nearest-neighbor scaling.
    const W = 240;
    const H = 135;
    canvas.width = W;
    canvas.height = H;
    ctx.imageSmoothingEnabled = false;

    ctx.clearRect(0, 0, W, H);

    const display = (text || '').trim();
    if (!display) return;

    const words = display.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    if (words.length <= 2) {
      lines.push(display);
    } else {
      const midpoint = Math.ceil(words.length / 2);
      lines.push(words.slice(0, midpoint).join(' '));
      lines.push(words.slice(midpoint).join(' '));
    }

    const maxChars = Math.max(...lines.map((line) => line.length), 1);
    const baseSize = Math.max(17, Math.min(52, 310 / Math.max(4, maxChars)));
    const pulse = 1 + energy * 0.12 + attack * 0.18;
    const fontSize = Math.round(baseSize * pulse);
    const lineHeight = Math.round(fontSize * 0.86);
    const centerY = H / 2 - ((lines.length - 1) * lineHeight) / 2;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `900 ${fontSize}px Arial Black, Arial, sans-serif`;
    ctx.lineJoin = 'miter';

    lines.forEach((line, index) => {
      const y = Math.round(centerY + index * lineHeight);
      const x = Math.round(W / 2);

      // Hard stepped outline copies create the OBAS/pixel-block edge without smoothing.
      const offsets = [
        [-3, 0], [3, 0], [0, -3], [0, 3],
        [-2, -2], [2, -2], [-2, 2], [2, 2],
      ];
      ctx.fillStyle = `hsl(${hue2} 100% 48%)`;
      for (const [ox, oy] of offsets) ctx.fillText(line, x + ox, y + oy);

      if (attack > 0.12) {
        const jump = 3 + Math.round(attack * 7);
        ctx.fillStyle = `hsl(${(hue + 190) % 360} 100% 52%)`;
        ctx.fillText(line, x + jump, y);
      }

      ctx.fillStyle = `hsl(${hue} 100% ${54 + energy * 18}%)`;
      ctx.fillText(line, x, y);
    });
  }, [text, energy, attack, hue, hue2]);

  return (
    <main
      style={{
        minHeight: '100vh',
        position: 'relative',
        overflow: 'hidden',
        background: '#050505',
        color: '#f4f4f4',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      }}
    >
      <section
        style={{
          minHeight: '88vh',
          display: 'grid',
          placeItems: 'center',
          padding: '28px 18px 90px',
        }}
      >
        <canvas
          ref={canvasRef}
          aria-label={text || 'Live voice transcription'}
          style={{
            width: 'min(96vw, 1440px)',
            height: 'auto',
            aspectRatio: '16 / 9',
            display: 'block',
            imageRendering: 'pixelated',
          }}
        />
      </section>

      <div
        style={{
          position: 'absolute',
          left: 16,
          right: 16,
          bottom: 14,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          fontSize: 10,
          letterSpacing: '.08em',
          textTransform: 'uppercase',
          color: '#8c8c8c',
        }}
      >
        <div>
          <div>{status}</div>
          <div style={{ marginTop: 4 }}>
            LEVEL {energy.toFixed(2)} // ATTACK {attack.toFixed(2)} // RATE {metrics.rate.toFixed(2)} // PAUSE {metrics.pause.toFixed(2)}
          </div>
        </div>
        <button
          type="button"
          onClick={active || shouldListenRef.current ? stopVoiceField : startVoiceField}
          disabled={!supported}
          style={{
            minHeight: 44,
            padding: '0 14px',
            border: '1px solid #555',
            background: '#050505',
            color: '#d8d8d8',
            font: 'inherit',
            cursor: supported ? 'pointer' : 'not-allowed',
            opacity: supported ? 1 : 0.45,
          }}
        >
          {active || shouldListenRef.current ? 'STOP' : supported ? 'START LISTENING' : 'UNSUPPORTED'}
        </button>
      </div>
    </main>
  );
}
