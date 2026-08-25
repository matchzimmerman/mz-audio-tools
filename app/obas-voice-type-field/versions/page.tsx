export default function ObasVoiceTypeFieldVersionsPage() {
  const versions = [
    { href: '/obas-voice-type-field/v1-reactive', label: 'V1 — Reactive field', note: 'Color/pattern background, voice metrics, expanding text echoes.' },
    { href: '/obas-voice-type-field/v2-pixel', label: 'V2 — Pixel text', note: 'Low-resolution pixel rendering with fast word buffer and voice-driven color.' },
    { href: '/obas-voice-type-field/v3-transcript', label: 'V3 — Simple transcript', note: 'Large live transcription with a single mic control.' },
    { href: '/obas-voice-type-field', label: 'LATEST', note: 'Current working iteration.' },
  ];

  return (
    <main style={{ minHeight: '100vh', background: '#050505', color: '#f2f2f2', padding: 28, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>
        <h1 style={{ fontSize: 24, marginBottom: 8 }}>OBAS VOICE TYPE FIELD // VERSIONS</h1>
        <p style={{ color: '#999', marginBottom: 28 }}>Each iteration is preserved as a separate live route for side-by-side testing.</p>
        <div style={{ display: 'grid', gap: 12 }}>
          {versions.map((version) => (
            <a key={version.href} href={version.href} style={{ display: 'block', border: '1px solid #444', padding: 18, color: 'inherit', textDecoration: 'none' }}>
              <div style={{ fontSize: 18, marginBottom: 6 }}>{version.label}</div>
              <div style={{ color: '#999', fontSize: 13, lineHeight: 1.5 }}>{version.note}</div>
            </a>
          ))}
        </div>
      </div>
    </main>
  );
}
