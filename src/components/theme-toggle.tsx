"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { applyTripBookTheme, THEME_STORAGE_KEY, type TripBookTheme } from "@/components/theme-provider";

export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<TripBookTheme>("dark");

  useEffect(() => {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY) === "light" ? "light" : "dark";
    setTheme(storedTheme);
    applyTripBookTheme(storedTheme);
  }, []);

  const nextTheme: TripBookTheme = theme === "dark" ? "light" : "dark";

  const handleToggle = () => {
    setTheme(nextTheme);
    applyTripBookTheme(nextTheme);
  };

  return (
    <Button type="button" variant="outline" size="sm" onClick={handleToggle} className={className}>
      {theme === "dark" ? <Moon className="w-4 h-4 mr-2" /> : <Sun className="w-4 h-4 mr-2" />}
      {theme === "dark" ? "Dark" : "Light"}
    </Button>
  );
}
