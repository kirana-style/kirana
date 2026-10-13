"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react"
import { mode as modes, props as styleProps } from "@kirana-style/core"

import { THEME_MODES } from "./themes"
import type { ThemeMode } from "./themes"

type ThemeContextValue = {
  mode: ThemeMode
  setMode: (mode: ThemeMode) => void
  /** Cycles system → light → dark → system. */
  cycleMode: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

const CYCLE: readonly ThemeMode[] = THEME_MODES

export function ThemeProvider({
  children,
  defaultMode = "system",
}: {
  children: React.ReactNode
  defaultMode?: ThemeMode
}) {
  const [mode, setMode] = useState<ThemeMode>(defaultMode)

  const cycleMode = useCallback(() => {
    setMode((current) => CYCLE[(CYCLE.indexOf(current) + 1) % CYCLE.length]!)
  }, [])

  const value = useMemo(() => ({ mode, setMode, cycleMode }), [mode, cycleMode])

  return <ThemeContext value={value}>{children}</ThemeContext>
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error("useTheme must be used inside a ThemeProvider")
  }
  return context
}

/**
 * The props for a given mode, to spread onto the element that scopes the theme.
 *
 * `system` sets `color-scheme: light dark`, which follows the OS with no
 * JavaScript. `light` and `dark` pin it. The small mode theme carries the few
 * surface tokens that are not colours.
 */
export function themeProps(mode: ThemeMode) {
  return styleProps(themeStyles(mode))
}

/**
 * The same thing as styles rather than props, for when the element also has
 * styles of its own to compose with.
 */
export function themeStyles(mode: ThemeMode) {
  return modes[mode]
}
