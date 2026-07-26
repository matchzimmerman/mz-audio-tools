import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MZ Audio Tools",
  description: "A field station of playable browser instruments and audio experiments.",
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
