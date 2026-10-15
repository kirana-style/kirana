import { Suspense, lazy } from "react"
import { HeadContent, Scripts, createRootRoute } from "@tanstack/react-router"
import { css } from "@kirana-style/core"

import kiranaCss from "@kirana-style/core/stylesheet.css?url"
import appCss from "@workspace/ui/globals.css?url"
import highlightCss from "@/generated/highlight.css?url"
import { DirectionProvider } from "@workspace/ui/components/direction"
import { Toaster } from "@workspace/ui/components/toast"
import { TooltipProvider } from "@workspace/ui/components/tooltip"
import {
  ThemeProvider,
  themeStyles,
  useTheme,
} from "@workspace/ui/theme/theme-provider"
import { theme } from "@workspace/ui/theme/semantic"
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
      // The paper and the night ground, for the browser's own chrome.
      {
        name: "theme-color",
        content: "#fcfbf8",
        media: "(prefers-color-scheme: light)",
      },
      {
        name: "theme-color",
        content: "#110e0b",
        media: "(prefers-color-scheme: dark)",
      },
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
      { rel: "stylesheet", href: appCss },
      { rel: "stylesheet", href: highlightCss },
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

function ThemedDocument({ children }: { children: React.ReactNode }) {
  const { mode } = useTheme()

  // `color-scheme` goes on the root element, not the body: the root decides the
  // page's scrollbars and canvas.
  return (
    // `data-mode` with the scheme anchor: what an image per scheme (a brand
    // logo) reads, since `light-dark()` only switches colours.
    <html
      lang="en"
      data-mode={mode}
      sx={[themeStyles(mode), schemeMarker.anchor]}
    >
      <head>
        <HeadContent />
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
