'use client';

import { useEffect, useRef, useState } from 'react';

export default function ObasVoiceTypeFieldPage() {
  const recognitionRef = useRef<any>(null);
  const shouldListenRef = useRef(false);

  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const [text, setText] = useState('');

  useEffect(() => {
    const Recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Recognition) {
      setSupported(false);
      return;
    }

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => setListening(true);

    recognition.onresult = (event: any) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i]?.[0]?.transcript || '';
      }
      const next = transcript.trim();
      if (next) setText(next.toUpperCase());
    };

    recognition.onerror = (event: any) => {
      const code = String(event?.error || '').toLowerCase();
      if (code === 'not-allowed' || code === 'service-not-allowed') {
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

  function toggleMic() {
    const recognition = recognitionRef.current;
    if (!recognition || !supported) return;

    if (!shouldListenRef.current) {
      shouldListenRef.current = true;
      setText('');
      try { recognition.start(); } catch {}
    } else {
      shouldListenRef.current = false;
      setListening(false);
      try { recognition.stop(); } catch {}
    }
  }

  return (
    <main style={{ minHeight: '100vh', background: '#050505', color: '#f2f2f2', display: 'grid', gridTemplateRows: '1fr auto', padding: '24px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}>
      <section style={{ display: 'grid', placeItems: 'center', textAlign: 'center', padding: '24px', minWidth: 0 }}>
        <div aria-live="polite" style={{ width: '100%', maxWidth: 1500, fontSize: 'clamp(2.5rem, 9vw, 9rem)', lineHeight: 0.98, fontWeight: 700, letterSpacing: '-0.04em', overflowWrap: 'anywhere' }}>
          {text || (listening ? '...' : '')}
        </div>
      </section>
      <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 8 }}>
        <button type="button" onClick={toggleMic} disabled={!supported} style={{ minHeight: 48, padding: '0 18px', border: '1px solid #777', background: listening ? '#f2f2f2' : '#050505', color: listening ? '#050505' : '#f2f2f2', font: 'inherit', letterSpacing: '.08em', cursor: supported ? 'pointer' : 'not-allowed', opacity: supported ? 1 : 0.45 }}>
          {supported ? 'MIC ON' : 'MIC UNSUPPORTED'}
        </button>
      </div>
    </main>
  );
}
