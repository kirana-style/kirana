/**
 * The reader's colour mode, from the cookie `ThemeProvider` keeps it in: read from the request on
 * the server, so the page renders in the saved mode with no flash, and from `document.cookie` in
 * the browser, so a client-side navigation asks nothing of the server.
 */
import { createIsomorphicFn } from "@tanstack/react-start"
import { getCookie } from "@tanstack/react-start/server"

import {
  isThemeMode,
  readThemeCookie,
} from "@workspace/ui/theme/theme-provider"
import type { ThemeMode } from "@workspace/ui/theme/themes"

export const THEME_COOKIE = "kirana-theme"

export const readThemeMode = createIsomorphicFn()
  .server((): ThemeMode => {
    const value = getCookie(THEME_COOKIE)
    return isThemeMode(value) ? value : "system"
  })
  .client(
    (): ThemeMode => readThemeCookie(document.cookie, THEME_COOKIE) ?? "system"
  )
