"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TOOLS: Record<string, { id: string; name: string }> = {
  "/magpie": { id: "01", name: "GULL" },
  "/serial": { id: "02", name: "SERIAL" },
  "/erd": { id: "03", name: "ER·D" },
  "/coasts": { id: "04", name: "COASTS" },
  "/spectral-particles": { id: "05", name: "SPECTRAL PARTICLES" },
  "/visual-engine": { id: "06", name: "VISUAL ENGINE" },
  "/field-chorus": { id: "07", name: "FIELD CHORUS" },
  "/emergent-field": { id: "08", name: "EMERGENT FIELD" },
};

const HEADERLESS_ROUTES = new Set([
  "/standalone/polar-sequencer",
  "/obas-polar-sequencer",
]);

export default function SonicLabHeader() {
  const pathname = usePathname();
  const tool = TOOLS[pathname];

  // The integrated host owns the full persistent shell on /lab.
  // Public Vortex routes intentionally present as self-contained instruments
  // without navigation back into the broader SONIC LAB index.
  if (
    pathname === "/lab" ||
    pathname.startsWith("/lab/") ||
    HEADERLESS_ROUTES.has(pathname)
  ) return null;

  return (
    <header className="sonic-lab-global-header">
      <Link href="/" className="sonic-lab-brand" aria-label="MZCMG Sonic Lab index">
        MZCMG // SONIC LAB
      </Link>
      <div className="sonic-lab-current" aria-label={tool ? `${tool.name}, Sonic Lab unit ${tool.id}` : "Sonic Lab field station index"}>
        {tool ? (
          <>
            <span className="sonic-lab-id">MZCMG_SL-{tool.id}</span>
            <strong>{tool.name}</strong>
          </>
        ) : (
          <strong>FIELD STATION INDEX</strong>
        )}
      </div>
    </header>
  );
}
