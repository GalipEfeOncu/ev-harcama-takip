"use client";

import { Check, Monitor, Moon, Sun, SunMoon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

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
  const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  themeColor?.setAttribute("content", theme === "dark" ? "#121412" : "#F6F5F2");
}

const choices = [
  { value: "system", label: "Sistem", icon: Monitor },
  { value: "light", label: "Açık", icon: Sun },
  { value: "dark", label: "Koyu", icon: Moon },
] as const;

export default function ThemeControl({ full = false }: { full?: boolean }) {
  const [choice, setChoice] = useState<ThemeChoice>("system");
  const menuRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const syncTheme = () => {
      const currentChoice = document.documentElement.dataset.themeChoice ?? null;
      const nextChoice = isThemeChoice(currentChoice) ? currentChoice : readSavedChoice();
      setChoice(nextChoice);
      applyTheme(nextChoice, media.matches);
    };
    syncTheme();
    media.addEventListener("change", syncTheme);
    window.addEventListener("ev-hesap-theme-change", syncTheme);

    return () => {
      media.removeEventListener("change", syncTheme);
      window.removeEventListener("ev-hesap-theme-change", syncTheme);
    };
  }, []);

  function changeTheme(nextChoice: ThemeChoice) {
    try {
      window.localStorage.setItem(THEME_KEY, nextChoice);
    } catch {
      // Keep the selected theme for this visit when persistence is blocked.
    }
    applyTheme(nextChoice, window.matchMedia("(prefers-color-scheme: dark)").matches);
    setChoice(nextChoice);
    window.dispatchEvent(new Event("ev-hesap-theme-change"));
    menuRef.current?.removeAttribute("open");
  }

  const selectedLabel = choices.find((item) => item.value === choice)?.label ?? "Sistem";

  return (
    <details className={`theme-control${full ? " theme-control--full" : ""}`} ref={menuRef}>
      <summary aria-label={`Görünüm teması: ${selectedLabel}`} title={`Görünüm teması: ${selectedLabel}`}>
        <SunMoon aria-hidden="true" size={17} />
        {full && <span>Görünüm: {selectedLabel}</span>}
      </summary>
      <div className="theme-control__menu" role="group" aria-label="Görünüm teması seçimi">
        {choices.map((item) => {
          const Icon = item.icon;
          return (
            <button aria-pressed={choice === item.value} className={choice === item.value ? "is-selected" : ""} key={item.value} onClick={() => changeTheme(item.value)} type="button">
              <Icon aria-hidden="true" size={16} />
              <span>{item.label}</span>
              {choice === item.value && <Check aria-hidden="true" className="theme-control__check" size={15} />}
            </button>
          );
        })}
      </div>
    </details>
  );
}
