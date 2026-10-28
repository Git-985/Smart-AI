"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type AccessibilityPreferences = {
  fontScale: 100 | 125 | 150 | 175;
  highContrast: boolean;
  voiceGuide: boolean;
};

type AccessibilityContextValue = {
  preferences: AccessibilityPreferences;
  updatePreferences: (patch: Partial<AccessibilityPreferences>) => void;
};

const defaults: AccessibilityPreferences = {
  fontScale: 100,
  highContrast: false,
  voiceGuide: false,
};

const AccessibilityContext = createContext<AccessibilityContextValue | null>(null);
const storageKey = "smart-ai:accessibility";

export function AccessibilityProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const [preferences, setPreferences] = useState(defaults);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (parsed && typeof parsed === "object") {
          const value = parsed as Record<string, unknown>;
          setPreferences({
            fontScale: [100, 125, 150, 175].includes(value.fontScale as number) ? value.fontScale as AccessibilityPreferences["fontScale"] : defaults.fontScale,
            highContrast: typeof value.highContrast === "boolean" ? value.highContrast : defaults.highContrast,
            voiceGuide: typeof value.voiceGuide === "boolean" ? value.voiceGuide : defaults.voiceGuide,
          });
        }
      }
    } catch {
      // Storage may be disabled; keep the in-memory defaults.
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!loaded) return;
    document.documentElement.dataset.fontScale = String(preferences.fontScale);
    document.documentElement.dataset.contrast = preferences.highContrast ? "high" : "normal";
    try {
      localStorage.setItem(storageKey, JSON.stringify(preferences));
    } catch {
      // Preferences remain active for this page load if storage is unavailable.
    }
  }, [loaded, preferences]);

  function updatePreferences(patch: Partial<AccessibilityPreferences>) {
    setPreferences((current) => ({ ...current, ...patch }));
  }

  return (
    <AccessibilityContext.Provider value={{ preferences, updatePreferences }}>
      {children}
    </AccessibilityContext.Provider>
  );
}

export function useAccessibilityPreferences() {
  const context = useContext(AccessibilityContext);
  if (!context) throw new Error("Accessibility controls must be inside AccessibilityProvider.");
  return context;
}
