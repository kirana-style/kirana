import { Suspense, lazy } from "react"
import { HeadContent, Scripts, createRootRoute } from "@tanstack/react-router"
import { css, props as styleProps } from "@kirana-style/core"

import kiranaCss from "@kirana-style/core/stylesheet.css?url"
import siteCss from "@/styles/site.css?url"
import { DirectionProvider } from "@workspace/ui/components/direction"
import { Toaster } from "@workspace/ui/components/toast"
import { TooltipProvider } from "@workspace/ui/components/tooltip"
import {
  ThemeProvider,
  themeStyles,
  useTheme,
} from "@workspace/ui/theme/theme-provider"
import { theme } from "@workspace/ui/theme/semantic"
import { THEME_MODES } from "@workspace/ui/theme/themes"
import type { ThemeMode } from "@workspace/ui/theme/themes"
import { fontFamily } from "@workspace/ui/tokens/typography"

import { schemeMarker } from "@workspace/docs-ui/scheme.ts"

import { SiteDocsProvider } from "@/components/docs-config"
import { NotFound } from "@/components/not-found"
import { THEME_COOKIE, readThemeMode } from "@/lib/theme-mode"

// The font lab is a development tool: under `vite build` this branch is dead, so production bundles
// leave the lab out entirely.
const FontLab = import.meta.env.DEV
  ? lazy(() =>
      import("@/components/site/font-lab").then((module) => ({
        default: module.FontLab,
      }))
    )
  : null

const styles = {
  body: css({
    backgroundColor: theme.background,
    color: theme.foreground,
    fontFamily: fontFamily.sans,
  }),
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Kirana: styling, compiled" },
      {
        name: "description",
        content:
          "CSS-in-JS with a Rust engine of its own. Write typed style objects, read every element's CSS on its line in your editor, and ship one small, atomic stylesheet.",
      },
    ],
    links: [
      // First, so its `@layer reset, base, kirana` statement fixes the layer
      // order before globals.css opens the reset and base layers.
      { rel: "stylesheet", href: kiranaCss },
      { rel: "stylesheet", href: siteCss },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "icon", href: "/favicon.ico", sizes: "48x48" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/manifest.json" },
    ],
  }),
  // The saved colour mode, before the document renders: the server writes `<html>` in it.
  beforeLoad: () => ({ mode: readThemeMode() }),
  notFoundComponent: NotFound,
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  const { mode } = Route.useRouteContext()
  return (
    <DirectionProvider direction="ltr">
      <ThemeProvider defaultMode={mode} cookie={THEME_COOKIE}>
        <ThemedDocument>{children}</ThemedDocument>
      </ThemeProvider>
    </DirectionProvider>
  )
}

/** `<html>`'s classes in a mode: its theme, and the anchor an image per scheme reads. */
function documentProps(mode: ThemeMode) {
  return styleProps(themeStyles(mode), schemeMarker.anchor)
}

/**
 * Puts the saved mode on `<html>` before the first paint. A prerendered page is written in the
 * system mode, and the provider applies the saved one only once the page's scripts run, so without
 * this a reader who chose dark would see the light page first on a slow connection. It writes the
 * classes the document renders for that mode, so React finds them as it renders them.
 */
const MODE_SCRIPT = `(() => {
  const classes = ${JSON.stringify(Object.fromEntries(THEME_MODES.map((mode) => [mode, documentProps(mode).className ?? ""])))}
  const saved = document.cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith("${THEME_COOKIE}="))?.slice(${THEME_COOKIE.length + 1})
  if (!saved || !(saved in classes)) return
  document.documentElement.className = classes[saved]
  document.documentElement.dataset.mode = saved
})()`

/**
 * The paper and the night ground, for the browser's own chrome. Written in `<head>` directly:
 * TanStack Router keeps one `meta` per `name`, so a pair that differs only in `media` lost its
 * light half through `head()`, and a light-mode reader got dark browser chrome.
 */
function ThemeColorMeta() {
  return (
    <>
      <meta
        name="theme-color"
        content="#fcfbf8"
        media="(prefers-color-scheme: light)"
      />
      <meta
        name="theme-color"
        content="#110e0b"
        media="(prefers-color-scheme: dark)"
      />
    </>
  )
}

function ThemedDocument({ children }: { children: React.ReactNode }) {
  const { mode } = useTheme()

  // `color-scheme` goes on the root element, not the body: the root decides the
  // page's scrollbars and canvas.
  return (
    // `data-mode` with the scheme anchor: what an image per scheme (a brand
    // logo) reads, since `light-dark()` only switches colours.
    // The classes come from `documentProps`, as MODE_SCRIPT's do. Until the provider reads the
    // cookie, a prerendered page hydrates in the system mode while the script has already set the
    // saved one: React keeps the attributes it finds rather than warning about them.
    <html
      lang="en"
      data-mode={mode}
      {...documentProps(mode)}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: MODE_SCRIPT }} />
        <HeadContent />
        <ThemeColorMeta />
      </head>
      <body sx={styles.body}>
        <TooltipProvider>
          <SiteDocsProvider>{children}</SiteDocsProvider>
          {FontLab ? (
            <Suspense fallback={null}>
              <FontLab />
            </Suspense>
          ) : null}
        </TooltipProvider>
        <Toaster />
        <Scripts />
      </body>
    </html>
  )
}
