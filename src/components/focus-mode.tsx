"use client";

import { useEffect } from "react";

export default function FocusMode() {
  useEffect(() => {
    const root = document.documentElement;
    const useKeyboardFocus = () => { root.dataset.inputModality = "keyboard"; };
    const usePointerFocus = () => { delete root.dataset.inputModality; };

    window.addEventListener("keydown", useKeyboardFocus);
    window.addEventListener("pointerdown", usePointerFocus);

    return () => {
      window.removeEventListener("keydown", useKeyboardFocus);
      window.removeEventListener("pointerdown", usePointerFocus);
    };
  }, []);

  return null;
}
