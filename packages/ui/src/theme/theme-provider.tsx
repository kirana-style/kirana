"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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

/** A year: the choice outlives the session, and every choice renews it. */
const MAX_AGE = 60 * 60 * 24 * 365

export function isThemeMode(value: unknown): value is ThemeMode {
  return THEME_MODES.includes(value as ThemeMode)
}

/** The mode saved in a `Cookie` header or `document.cookie`, if it names one. */
export function readThemeCookie(
  cookies: string | undefined,
  name: string
): ThemeMode | undefined {
  const value = cookies
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1)
  return isThemeMode(value) ? value : undefined
}

/**
 * Holds the colour mode for everything under it.
 *
 * With `cookie`, the choice is kept: the provider writes it to that cookie, so the server can
 * render the next page in it (pass what it reads as `defaultMode`) and a reload keeps it, and
 * tells every other tab of the site over a `BroadcastChannel` of the same name, so they switch
 * with it. A page restored from the back-forward cache missed those messages and reads the
 * cookie again. Without `cookie`, the mode lasts as long as the page.
 */
export function ThemeProvider({
  children,
  defaultMode = "system",
  cookie,
}: {
  children: React.ReactNode
  defaultMode?: ThemeMode
  /** The cookie, and the channel, that keep the choice across reloads and tabs. */
  cookie?: string
}) {
  const [mode, setModeState] = useState<ThemeMode>(defaultMode)
  const channel = useRef<BroadcastChannel | null>(null)

  useEffect(() => {
    if (!cookie) return
    const other =
      typeof BroadcastChannel === "undefined"
        ? null
        : new BroadcastChannel(cookie)
    channel.current = other
    if (other)
      other.onmessage = (event: MessageEvent) => {
        if (isThemeMode(event.data)) setModeState(event.data)
      }
    const onShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return
      const saved = readThemeCookie(document.cookie, cookie)
      if (saved) setModeState(saved)
    }
    window.addEventListener("pageshow", onShow)
    return () => {
      other?.close()
      channel.current = null
      window.removeEventListener("pageshow", onShow)
    }
  }, [cookie])

  const setMode = useCallback(
    (next: ThemeMode) => {
      setModeState(next)
      if (!cookie) return
      document.cookie = `${cookie}=${next}; path=/; max-age=${MAX_AGE}; samesite=lax`
      channel.current?.postMessage(next)
    },
    [cookie]
  )

  const cycleMode = useCallback(() => {
    setMode(CYCLE[(CYCLE.indexOf(mode) + 1) % CYCLE.length]!)
  }, [mode, setMode])

  const value = useMemo(
    () => ({ mode, setMode, cycleMode }),
    [mode, setMode, cycleMode]
  )

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
