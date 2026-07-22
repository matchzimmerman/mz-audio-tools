import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Magpie — Avian Signal Synthesizer",
  description: "A playable generative browser synthesizer for metallic calls, fluttering phrases, and strange field recordings.",
  openGraph: {
    title: "Magpie — Avian Signal Synthesizer",
    description: "Shape metallic calls, fluttering phrases, and strange synthetic field recordings.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Magpie avian signal synthesizer" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Magpie — Avian Signal Synthesizer",
    description: "A playable generative browser instrument.",
    images: ["/og.png"],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
