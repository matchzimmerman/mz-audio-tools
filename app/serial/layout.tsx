import type { Metadata } from "next";

const siteUrl = "https://matchzimmerman.github.io/mz-audio-tools";
const previewImage = `${siteUrl}/serial-og.png`;
const title = "Serial — Sequential Effects Lab";
const description =
  "A playable introduction to audio effect chains. Drag, snap, listen, and reorder real effects in the browser.";

export const dynamic = "force-static";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  openGraph: {
    title,
    description,
    type: "website",
    images: [
      {
        url: previewImage,
        width: 1200,
        height: 630,
        alt: "Serial sequential effects lab signal chain",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [previewImage],
  },
};

export default function SerialLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
