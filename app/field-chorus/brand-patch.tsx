"use client";

import { useEffect } from "react";

export default function FieldChorusBrandPatch() {
  useEffect(() => {
    const mainLabel = document.querySelector<HTMLElement>(".fc-master > span");
    if (mainLabel) mainLabel.textContent = "MAIN";
  }, []);

  return null;
}
