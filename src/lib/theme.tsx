import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

type ThemeMode = "light" | "dark";

const STORAGE_KEY = "tikka.theme";

type ThemeContextValue = {
  theme: ThemeMode;
  toggle: () => void;
};

const ThemeContext = createContext<ThemeContextValue>({ theme: "light", toggle: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeMode>("light");

  // أول زيارة: نحترم إعداد النظام. بعد كده الاختيار المحفوظ هو الأساس.
  useEffect(() => {
    let initial: ThemeMode = "light";
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === "light" || saved === "dark") {
        initial = saved;
      } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
        initial = "dark";
      }
    } catch {
      initial = "light";
    }
    setTheme(initial);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((current) => {
      const next: ThemeMode = current === "dark" ? "light" : "dark";
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* التخزين المحلي ممكن يكون مقفول — منكسرش التطبيق. */
      }
      return next;
    });
  }, []);

  return <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
