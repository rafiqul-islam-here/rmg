"use client";

import { useSyncExternalStore } from "react";

/** True while the media query matches. Returns false during server render. */
export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Guideline breakpoints: mobile < 768, tablet 768–1199, desktop ≥ 1200. */
export const MQ = {
  mobile: "(max-width: 767px)",
  desktop: "(min-width: 1200px)",
};
