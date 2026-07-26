import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Er·d — Six-Voice Percussion Synth",
  description: "A playable browser drum machine: one oscillator, one modulator, one decay envelope per voice, tuned to D Phrygian.",
  openGraph: {
    title: "Er·d — Six-Voice Percussion Synth",
    description: "One oscillator, one modulator, one decay per voice — a 16-step percussion synthesizer in the browser.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Er·d six-voice percussion synth" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Er·d — Six-Voice Percussion Synth",
    description: "A playable browser drum machine tuned to D Phrygian.",
    images: ["/og.png"],
  },
};

export default function ErdLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <>{children}</>;
}
