import Link from "next/link";

export default function ClubFieldPage() {
  return (
    <main className="cf-shell">
      <style>{`
        .cf-shell{min-height:100vh;background:var(--paper,#eee9dc);color:var(--ink,#1d1d1b);padding:0;margin:0}
        .cf-top{height:44px;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0 15px;border-bottom:1px solid var(--ink,#1d1d1b);font:800 9px/1 ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;letter-spacing:.09em;text-transform:uppercase}
        .cf-top b{background:var(--acid,#dfff00);border:1px solid var(--ink,#1d1d1b);padding:6px 8px}
        .cf-top a{color:inherit;text-decoration:none;border-bottom:1px solid currentColor;padding-bottom:2px}
        .cf-frame{display:block;width:100%;height:calc(100vh - 44px);border:0;background:#eee9dc}
        @media(max-width:600px){.cf-top{height:40px;font-size:8px}.cf-frame{height:calc(100vh - 40px)}}
      `}</style>
      <header className="cf-top">
        <b>MZCMG_SL · CLUB FIELD · V0.1</b>
        <Link href="/">← FIELD STATION INDEX</Link>
      </header>
      <iframe className="cf-frame" src="/club-field/index.html" title="MZCMG Sonic Lab Club Field prototype" allow="autoplay" />
    </main>
  );
}
