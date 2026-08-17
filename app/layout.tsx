import type { Metadata } from "next";
import "./globals.css";
import SonicLabHeader from "./sonic-lab-header";

export const metadata: Metadata = {
  title: "MZCMG // SONIC LAB",
  description: "A field station of playable browser instruments and audio experiments from Match Zimmerman Creative Media Group.",
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
      <body>
        <SonicLabHeader />
        {children}
      </body>
    </html>
  );
}
