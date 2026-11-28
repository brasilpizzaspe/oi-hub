import { useEffect, useState } from "react";

const preferenceKey = "brasilpizzas:store-motion";

/** Follow accessibility settings until the visitor explicitly chooses otherwise. */
export function useStoreMotion() {
  const [motionAllowed, setMotionAllowed] = useState<boolean | null>(null);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      let saved: string | null = null;
      try { saved = localStorage.getItem(preferenceKey); } catch { /* Storage is optional. */ }
      setMotionAllowed(saved === "full" ? true : saved === "reduced" ? false : !media.matches);
    };
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  const toggleMotion = () => {
    const next = motionAllowed !== true;
    try { localStorage.setItem(preferenceKey, next ? "full" : "reduced"); } catch { /* Still works for this visit. */ }
    setMotionAllowed(next);
  };
  return { motionAllowed, toggleMotion };
}