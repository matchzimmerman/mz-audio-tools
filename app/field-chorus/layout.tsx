import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Field Chorus — Mid-Atlantic Ecology Mixer",
  description:
    "A procedural sonic ecology instrument for building Maryland, Pennsylvania, and Delaware forest soundscapes by season, hour, and habitat.",
};

export default function FieldChorusLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
