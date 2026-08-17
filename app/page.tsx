import Link from "next/link";

const UNITS = [
  {
    id: "01",
    plate: "MZCMG_SL-01",
    name: "MAGPIE",
    tagline: "AVIAN SIGNAL SYNTHESIZER",
    description: "A playable generative synthesizer for metallic calls, fluttering phrases, and strange field recordings.",
    href: "/magpie",
  },
  {
    id: "02",
    plate: "MZCMG_SL-02",
    name: "SERIAL",
    tagline: "SEQUENTIAL EFFECTS LAB",
    description: "Drag, snap, listen, and reorder real audio effects to hear firsthand why order changes the result.",
    href: "/serial",
  },
  {
    id: "03",
    plate: "MZCMG_SL-03",
    name: "ER·D",
    tagline: "SIX-VOICE PERCUSSION SYNTH",
    description: "One oscillator, one modulator, one decay per voice — a 16-step drum machine tuned to D Phrygian.",
    href: "/erd",
  },
  {
    id: "04",
    plate: "MZCMG_SL-04",
    name: "COASTS",
    tagline: "DUAL SYNTHESIS PHILOSOPHY",
    description: "Toggle between East Coast subtractive control and West Coast complex timbre, touch voltage, and low-pass gates.",
    href: "/coasts",
  },
  {
    id: "05",
    plate: "MZCMG_SL-05",
    name: "SPECTRAL PARTICLES",
    tagline: "FREQUENCY PHYSICS VISUALIZER",
    description: "Load a track or use the microphone to drive five interacting particle behaviors across the audible spectrum.",
    href: "/spectral-particles",
  },
  {
    id: "06",
    plate: "MZCMG_SL-06",
    name: "VISUAL ENGINE",
    tagline: "MULTI-SEND ORGANIC BIT SYSTEM",
    description: "Load separate stems, assign each track a visual role, perform full-screen scenes, and capture audio-reactive video.",
    href: "/visual-engine",
  },
  {
    id: "07",
    plate: "MZCMG_SL-07",
    name: "FIELD CHORUS",
    tagline: "MID-ATLANTIC ECOLOGY MIXER",
    description: "Build a living MD / PA / DE sound field by season, hour, habitat, and species — then let the ecology run itself.",
    href: "/field-chorus",
  },
  {
    id: "08",
    plate: "MZCMG_SL-08",
    name: "EMERGENT FIELD",
    tagline: "GENERATIVE MIX-AWARE INSTRUMENT",
    description: "Six coupled streams compose, negotiate spectral space, adapt event density, and continually redistribute themselves across the stereo field.",
    href: "/emergent-field",
  },
];

export default function IndexPage() {
  return (
    <main className="mz-index">
      <style>{STYLES}</style>
      <header className="mz-masthead">
        <h1>MZCMG // SONIC LAB</h1>
        <p>FIELD STATION OF PLAYABLE BROWSER INSTRUMENTS</p>
      </header>

      <section className="mz-units" aria-label="Instruments">
        {UNITS.map((u) => (
          <Link key={u.id} href={u.href} className="mz-unit">
            <div className="mz-unit-head">
              <span className="mz-index-box">{u.id}</span>
              <span className="mz-unit-plate">{u.plate}</span>
            </div>
            <h2>{u.name}</h2>
            <p className="mz-unit-tagline">{u.tagline}</p>
            <p className="mz-unit-desc">{u.description}</p>
            <span className="mz-unit-open">OPEN →</span>
          </Link>
        ))}
      </section>

      <footer className="mz-foot">
        <span>MZCMG // SONIC LAB</span>
        <span>8 INSTRUMENTS / WEB AUDIO / BROWSER NATIVE</span>
        <span>MATCH ZIMMERMAN CREATIVE MEDIA GROUP</span>
      </footer>
    </main>
  );
}

const STYLES = `
.mz-index{ width:min(100%, 1440px); min-height:100vh; margin:0 auto; padding:24px 30px 30px; box-sizing:border-box; }
.mz-index *{ box-sizing:border-box; }

.mz-masthead{ border-top:2px solid var(--ink); border-bottom:2px solid var(--ink); padding:14px 0 16px; margin-bottom:22px; }
.mz-masthead h1{ margin:0; font-size:clamp(40px,7vw,84px); font-weight:900; letter-spacing:-.06em; line-height:.8; }
.mz-masthead p{ margin:8px 0 0; font:700 10px/1 monospace; letter-spacing:.16em; color:var(--muted); }

.mz-units{ display:grid; grid-template-columns:repeat(3,1fr); border-top:1.5px solid var(--ink); border-bottom:1.5px solid var(--ink); }
.mz-unit{ display:flex; flex-direction:column; gap:8px; min-width:0; padding:18px 18px 20px; border-right:1px solid var(--ink); border-bottom:1px solid var(--ink);
  text-decoration:none; color:var(--ink); transition:background .14s ease; }
.mz-unit:nth-child(3n){ border-right:0; }
.mz-unit:last-child{ border-bottom:0; }
.mz-unit:hover, .mz-unit:focus-visible{ background:var(--paper-light); }
.mz-unit:focus-visible{ outline:3px solid var(--acid); outline-offset:-3px; }
.mz-unit-head{ display:flex; align-items:center; gap:8px; }
.mz-index-box{ width:24px; height:24px; display:grid; place-items:center; border:1px solid var(--ink); background:var(--acid); font:800 9px/1 monospace; }
.mz-unit-plate{ font:700 9px/1 monospace; letter-spacing:.08em; color:var(--muted); }
.mz-unit h2{ margin:2px 0 0; font-size:clamp(20px,2vw,26px); font-weight:900; letter-spacing:-.03em; line-height:1; overflow-wrap:anywhere; }
.mz-unit-tagline{ margin:0; font:700 8px/1 monospace; letter-spacing:.1em; color:var(--muted); }
.mz-unit-desc{ margin:4px 0 0; font-size:12.5px; line-height:1.5; }
.mz-unit-open{ margin-top:auto; padding-top:10px; font:800 9px/1 monospace; letter-spacing:.1em; }

.mz-foot{ display:flex; justify-content:space-between; padding-top:16px; font:700 7px/1 monospace; color:var(--muted); letter-spacing:.08em; flex-wrap:wrap; gap:4px; }

@media(max-width:1100px){
  .mz-units{ grid-template-columns:repeat(2,1fr); }
  .mz-unit:nth-child(3n){ border-right:1px solid var(--ink); }
  .mz-unit:nth-child(2n){ border-right:0; }
}
@media(max-width:650px){
  .mz-index{ padding:16px; }
  .mz-units{ grid-template-columns:1fr; }
  .mz-unit, .mz-unit:nth-child(3n){ border-right:0; border-bottom:1px solid var(--ink); }
  .mz-unit:last-child{ border-bottom:0; }
}
@media(prefers-reduced-motion:reduce){
  .mz-unit{ transition:none; }
}
`;
