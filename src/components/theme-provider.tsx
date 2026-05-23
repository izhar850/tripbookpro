"use client";

import { useEffect } from "react";

export type TripBookTheme = "light" | "dark";

const THEME_STORAGE_KEY = "tripbook-theme";

function getStoredTheme(): TripBookTheme {
  if (typeof window === "undefined") return "dark";
  return window.localStorage.getItem(THEME_STORAGE_KEY) === "light" ? "light" : "dark";
}

export function applyTripBookTheme(theme: TripBookTheme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    applyTripBookTheme(getStoredTheme());
  }, []);

  return <>{children}</>;
}

export { THEME_STORAGE_KEY };
