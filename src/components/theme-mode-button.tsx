"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

const STORAGE_KEY = "beauty_os_color_mode";

type ColorMode = "light" | "dark";

function preferredMode(): ColorMode {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyMode(mode: ColorMode | null) {
  const root = document.documentElement;
  if (mode) {
    root.dataset.colorMode = mode;
  } else {
    delete root.dataset.colorMode;
  }
}

export function ThemeModeButton() {
  const [mode, setMode] = useState<ColorMode>("light");

  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");

    const sync = () => {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      const explicit = stored === "dark" || stored === "light" ? stored : null;
      const next = explicit ?? preferredMode();
      applyMode(explicit);
      setMode(next);
    };

    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  const toggle = () => {
    const next = mode === "dark" ? "light" : "dark";
    window.localStorage.setItem(STORAGE_KEY, next);
    applyMode(next);
    setMode(next);
  };

  const isDark = mode === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      className="grid size-11 place-items-center rounded-[18px] border border-white/65 bg-white/58 text-muted hover:text-ink"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Light mode" : "Dark mode"}
    >
      {isDark ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  );
}
