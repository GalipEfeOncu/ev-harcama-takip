"use client";

import { SunMoon } from "lucide-react";
import { useEffect } from "react";

export type ThemeChoice = "system" | "light" | "dark";

const THEME_KEY = "ev-hesap-theme";

function isThemeChoice(value: string | null): value is ThemeChoice {
  return value === "system" || value === "light" || value === "dark";
}

function readSavedChoice(): ThemeChoice {
  try {
    const saved = window.localStorage.getItem(THEME_KEY);
    return isThemeChoice(saved) ? saved : "system";
  } catch {
    return "system";
  }
}

function applyTheme(choice: ThemeChoice, systemPrefersDark: boolean) {
  const theme = choice === "system" ? (systemPrefersDark ? "dark" : "light") : choice;
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.dataset.themeChoice = choice;
  document.querySelectorAll<HTMLSelectElement>('select[aria-label="Görünüm teması"]').forEach((select) => {
    select.value = choice;
  });

  const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  themeColor?.setAttribute("content", theme === "dark" ? "#18130F" : "#EFE5D4");
}

export default function ThemeControl() {
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const syncTheme = () => {
      const currentChoice = document.documentElement.dataset.themeChoice ?? null;
      const choice = isThemeChoice(currentChoice) ? currentChoice : readSavedChoice();
      applyTheme(choice, media.matches);
    };
    syncTheme();
    media.addEventListener("change", syncTheme);

    return () => media.removeEventListener("change", syncTheme);
  }, []);

  function changeTheme(nextChoice: ThemeChoice) {
    try {
      window.localStorage.setItem(THEME_KEY, nextChoice);
    } catch {
      // Keep the selected theme for this visit when persistence is blocked.
    }
    applyTheme(nextChoice, window.matchMedia("(prefers-color-scheme: dark)").matches);
  }

  return (
    <label className="theme-control">
      <SunMoon aria-hidden="true" size={17} />
      <span className="visually-hidden">Görünüm teması</span>
      <select
        aria-label="Görünüm teması"
        onChange={(event) => changeTheme(event.target.value as ThemeChoice)}
        defaultValue="system"
      >
        <option value="system">Sistem</option>
        <option value="light">Açık</option>
        <option value="dark">Koyu</option>
      </select>
    </label>
  );
}
