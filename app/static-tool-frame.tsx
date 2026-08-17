"use client";

import { useCallback, useRef } from "react";

type StaticToolFrameProps = {
  src: string;
  title: string;
  unitId: string;
  variant: "spectral" | "visual";
};

export default function StaticToolFrame({ src, title, unitId, variant }: StaticToolFrameProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);

  const patchLegacyBrand = useCallback(() => {
    const doc = frameRef.current?.contentDocument;
    if (!doc) return;

    doc.title = `MZCMG // SONIC LAB · ${unitId} · ${title}`;

    if (variant === "spectral") {
      const brand = doc.querySelector<HTMLElement>(".brand");
      if (brand) brand.textContent = `MZCMG // SONIC LAB · ${unitId} · ${title}`;
    } else {
      const strong = doc.querySelector<HTMLElement>(".brand strong");
      if (strong) strong.textContent = `MZCMG // SONIC LAB · ${unitId} · ${title}`;
      const rack = doc.querySelector<HTMLElement>(".rack-title strong");
      if (rack) rack.textContent = "MZCMG // SONIC LAB · VISUAL SEND RACK";
    }
  }, [title, unitId, variant]);

  return (
    <iframe
      ref={frameRef}
      className="sonic-static-frame"
      src={src}
      title={`${title} — ${unitId}`}
      allow="microphone; fullscreen; autoplay"
      onLoad={patchLegacyBrand}
    />
  );
}
