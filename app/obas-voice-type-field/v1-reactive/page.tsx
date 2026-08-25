'use client';

import { useEffect, useRef, useState } from 'react';

type Metrics = {
  rms: number;
  peak: number;
  attack: number;
  pause: number;
  rate: number;
};

type Echo = {
  id: number;
  text: string;
  strength: number;
  hue: number;
};

export default function ObasVoiceTypeFieldPage() {
  const recognitionRef = useRef<any>(null);
  const shouldListenRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const prevRmsRef = useRef(0);
  const lastVoiceAtRef = useRef(performance.now());
  const utteranceStartRef = useRef(performance.now());
  const wordCountRef = useRef(0);
  const echoIdRef = useRef(1);

  const [active, setActive] = useState(false);
  const [supported, setSupported] = useState(true);
  const [status, setStatus] = useState('VOICE FIELD OFFLINE');
  const [text, setText] = useState('SPEAK');
  const [finalText, setFinalText] = useState('');
  const [metrics, setMetrics] = useState<Metrics>({ rms: 0, peak: 0, attack: 0, pause: 0, rate: 0 });
  const [echoes, setEchoes] = useState<Echo[]>([]);

  function pushEcho(value: string, strength: number) {
    const cleaned = value.trim();
    if (!cleaned) return;
    const id = echoIdRef.current++;
    const hue = Math.round((210 + strength * 150 + metrics.rate * 9) % 360);
    setEchoes((current) => [...current.slice(-5), { id, text: cleaned, strength, hue }]);
    window.setTimeout(() => {
      setEchoes((current) => current.filter((echo) => echo.id !== id));
    }, 1500);
  }

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
      utteranceStartRef.current = performance.now();
      wordCountRef.current = 0;
    };

    recognition.onresult = (event: any) => {
      let interim = '';
      let finalized = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const chunk = event.results[i]?.[0]?.transcript || '';
        if (event.results[i]?.isFinal) finalized += chunk;
        else interim += chunk;
      }

      const live = (interim || finalized).trim();
      if (live) {
        setText(live.toUpperCase());
        wordCountRef.current = live.split(/\s+/).filter(Boolean).length;
      }

      if (finalized.trim()) {
        const phrase = finalized.trim().toUpperCase();
        const now = performance.now();
        const seconds = Math.max(0.4, (now - utteranceStartRef.current) / 1000);
        const words = phrase.split(/\s+/).filter(Boolean).length;
        const rate = words / seconds;
        setFinalText(phrase);
        setMetrics((m) => ({ ...m, rate }));
        pushEcho(phrase, Math.min(1, metrics.peak * 1.5 + metrics.attack * 3));
        utteranceStartRef.current = now;
        wordCountRef.current = 0;
      }
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
        }, 180);
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
      const pause = Math.min(1, (now - lastVoiceAtRef.current) / 1200);

      setMetrics((m) => ({
        rms: m.rms * 0.72 + rms * 0.28,
        peak: Math.max(peak, m.peak * 0.9),
        attack: m.attack * 0.65 + attack * 0.35,
        pause,
        rate: m.rate,
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
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.65;
      source.connect(analyser);
      audioContextRef.current = context;
      analyserRef.current = analyser;
      startMeter();

      shouldListenRef.current = true;
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
    setActive(false);
    setStatus('VOICE FIELD OFFLINE');
    setMetrics({ rms: 0, peak: 0, attack: 0, pause: 0, rate: 0 });
  }

  const energy = Math.min(1, metrics.rms * 5.2);
  const attack = Math.min(1, metrics.attack * 13);
  const hue = Math.round((28 + energy * 250 + metrics.rate * 16) % 360);
  const hue2 = (hue + 105 + Math.round(metrics.pause * 70)) % 360;
  const outline = 1.5 + energy * 6 + attack * 8;
  const tracking = Math.max(-0.04, 0.02 + metrics.pause * 0.13 - energy * 0.05);
  const scale = 0.96 + energy * 0.08 + attack * 0.08;
  const patternSize = 14 + Math.round(metrics.rate * 8 + energy * 28);
  const background = `
    radial-gradient(circle at 50% 50%, hsla(${hue2}, 100%, 58%, ${0.08 + energy * 0.22}) 0 1px, transparent 2px),
    repeating-conic-gradient(from ${Math.round(metrics.pause * 80)}deg at 50% 50%, hsl(${hue} 100% 50%) 0 2deg, hsl(${hue2} 100% 58%) 2deg 4deg)
  `;

  const displayText = text || finalText || 'SPEAK';

  return (
    <main
      style={{
        minHeight: '100vh',
        overflow: 'hidden',
        position: 'relative',
        display: 'grid',
        placeItems: 'center',
        background,
        backgroundSize: `${patternSize}px ${patternSize}px, cover`,
        color: `hsl(${hue} 100% 50%)`,
        fontFamily: 'Arial Black, Arial, Helvetica, sans-serif',
        transition: 'background-size 120ms linear, color 120ms linear',
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          background: `hsla(${(hue + 180) % 360}, 90%, 8%, ${0.22 + metrics.pause * 0.34})`,
          mixBlendMode: 'multiply',
          pointerEvents: 'none',
        }}
      />

      {echoes.map((echo, index) => {
        const ageScale = 1.05 + index * 0.085 + echo.strength * 0.22;
        const opacity = Math.max(0.06, 0.3 - index * 0.035);
        return (
          <div
            key={echo.id}
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: '8%',
              display: 'grid',
              placeItems: 'center',
              textAlign: 'center',
              fontWeight: 900,
              textTransform: 'uppercase',
              fontSize: 'clamp(3rem, 11vw, 11rem)',
              lineHeight: 0.88,
              letterSpacing: `${tracking}em`,
              color: 'transparent',
              WebkitTextStroke: `${2 + echo.strength * 5}px hsla(${echo.hue}, 100%, 64%, ${opacity})`,
              transform: `scale(${ageScale})`,
              filter: `blur(${Math.max(0, index - 2) * 0.8}px)`,
              pointerEvents: 'none',
            }}
          >
            {echo.text}
          </div>
        );
      })}

      <section
        style={{
          position: 'relative',
          zIndex: 2,
          width: 'min(94vw, 1500px)',
          minHeight: '72vh',
          display: 'grid',
          placeItems: 'center',
          padding: '5vw 3vw 8vw',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: '100%',
            fontSize: 'clamp(3.5rem, 12vw, 13rem)',
            lineHeight: 0.86,
            fontWeight: 900,
            textTransform: 'uppercase',
            letterSpacing: `${tracking}em`,
            color: `hsl(${hue2} 100% ${58 + energy * 18}%)`,
            WebkitTextStroke: `${outline}px hsl(${hue} 100% 38%)`,
            paintOrder: 'stroke fill',
            transform: `scale(${scale})`,
            transformOrigin: 'center',
            textShadow: `
              ${2 + attack * 16}px 0 0 hsla(${(hue + 45) % 360},100%,52%,.45),
              ${-2 - energy * 12}px ${2 + energy * 8}px 0 hsla(${(hue2 + 120) % 360},100%,56%,.32)
            `,
            transition: 'letter-spacing 80ms linear, transform 80ms linear, -webkit-text-stroke-width 80ms linear',
            overflowWrap: 'anywhere',
          }}
        >
          {displayText}
        </div>
      </section>

      <div
        style={{
          position: 'absolute',
          left: 18,
          right: 18,
          bottom: 16,
          zIndex: 4,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          fontSize: 11,
          letterSpacing: '.08em',
          textTransform: 'uppercase',
          color: '#fff',
          mixBlendMode: 'difference',
        }}
      >
        <div>
          <div>{status}</div>
          <div style={{ opacity: 0.7, marginTop: 4 }}>
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
            border: '1px solid currentColor',
            background: 'transparent',
            color: 'inherit',
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
