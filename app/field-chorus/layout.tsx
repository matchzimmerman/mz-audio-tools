import type { Metadata } from "next";
import type { ReactNode } from "react";
import FieldChorusBrandPatch from "./brand-patch";

export const metadata: Metadata = {
  title: "Field Chorus — Mid-Atlantic Ecology Mixer",
  description:
    "A procedural sonic ecology instrument for building Maryland, Pennsylvania, and Delaware forest soundscapes by season, hour, and habitat.",
};

export default function FieldChorusLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <>
      <style>{BRAND_STYLES}</style>
      <div className="fc-brandbar" aria-label="Studio credit">
        <strong>MZCMG</strong>
        <span>Match Zimmerman Creative Media Group</span>
      </div>
      <FieldChorusBrandPatch />
      {children}
      <div className="fc-brandfoot">
        <span>MZCMG</span>
        <strong>Match Zimmerman Creative Media Group</strong>
        <span>FIELD CHORUS / MZ–07</span>
      </div>
    </>
  );
}

const BRAND_STYLES = `
.fc-brandbar,
.fc-brandfoot{
  width:min(100%,1720px);
  margin:0 auto;
  background:var(--paper);
  color:var(--ink);
  font-family:var(--mono);
  text-transform:uppercase;
  letter-spacing:.1em;
}
.fc-brandbar{
  display:flex;
  align-items:center;
  gap:12px;
  padding:10px 30px 9px;
  border-bottom:1px solid var(--ink);
  font-size:9px;
}
.fc-brandbar strong{
  display:inline-grid;
  place-items:center;
  min-height:24px;
  padding:0 8px;
  background:var(--acid);
  border:1px solid var(--ink);
  font-size:9px;
}
.fc-brandbar span{ font-weight:800; }
.fc-brandfoot{
  display:flex;
  justify-content:space-between;
  gap:12px;
  flex-wrap:wrap;
  padding:12px 30px 16px;
  border-top:1px solid var(--ink);
  color:var(--muted);
  font-size:8px;
  font-weight:800;
}
.fc-brandfoot strong{ color:var(--ink); }
@media(max-width:820px){
  .fc-brandbar{ padding:9px 15px 8px; flex-wrap:wrap; }
  .fc-brandfoot{ padding:10px 15px 14px; }
}
`;
