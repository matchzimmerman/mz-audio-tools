"use client";

import { useEffect } from "react";

export default function EmbedMode() {
  useEffect(() => {
    if (window.self !== window.top) {
      document.documentElement.classList.add("sonic-lab-embedded");
      document.body.classList.add("sonic-lab-embedded-body");
    }

    return () => {
      document.documentElement.classList.remove("sonic-lab-embedded");
      document.body.classList.remove("sonic-lab-embedded-body");
    };
  }, []);

  return null;
}
