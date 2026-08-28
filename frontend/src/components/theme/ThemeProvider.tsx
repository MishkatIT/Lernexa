"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  THEME_STORAGE_KEY,
  type ResolvedTheme,
  type ThemeChoice,
} from "@/lib/theme";

type ThemeContextValue = {
  theme: ThemeChoice;
  resolved: ResolvedTheme;
  setTheme: (choice: ThemeChoice) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const systemPrefersDark = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-color-scheme: dark)").matches;

const resolve = (choice: ThemeChoice): ResolvedTheme =>
  choice === "system" ? (systemPrefersDark() ? "dark" : "light") : choice;

const apply = (resolved: ResolvedTheme) => {
  const el = document.documentElement;
  el.setAttribute("data-theme", resolved);
  el.style.colorScheme = resolved;
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeChoice>("system");
  const [resolved, setResolved] = useState<ResolvedTheme>("light");

  // Adopt whatever the pre-paint script already resolved.
  useEffect(() => {
    const stored =
      (localStorage.getItem(THEME_STORAGE_KEY) as ThemeChoice | null) ??
      "system";
    setThemeState(stored);
    setResolved(resolve(stored));
  }, []);

  // Follow the OS while in system mode, with no reload.
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const next: ResolvedTheme = mq.matches ? "dark" : "light";
      setResolved(next);
      apply(next);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = useCallback((choice: ThemeChoice) => {
    setThemeState(choice);
    localStorage.setItem(THEME_STORAGE_KEY, choice);
    const next = resolve(choice);
    setResolved(next);
    apply(next);
  }, []);

  const value = useMemo(
    () => ({ theme, resolved, setTheme }),
    [theme, resolved, setTheme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
