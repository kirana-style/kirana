/**
 * The site footer: the link columns, a dithered field in the page's accent
 * fading in from one corner. (The name drawn large in outline is off for now.)
 */
import { css } from "@kirana-style/core"
import { useRouterState } from "@tanstack/react-router"

import { accent, accents } from "@workspace/docs-ui/accent.ts"
import type { AccentName } from "@workspace/docs-ui/accent.ts"
import { theme } from "@workspace/ui/theme/semantic"
import { breakpoint } from "@workspace/ui/tokens/breakpoints"
import { spacing } from "@workspace/ui/tokens/spacing"
import {
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
} from "@workspace/ui/tokens/typography"

import { DocsLink } from "@/components/docs-link"

import { FOOTER } from "./nav"
import { Rail } from "./patterns"
import { PixelField } from "./pixel-field"

/** Which accent the footer takes on a given page; everything else is neutral blue. */
const ROUTE_ACCENTS: readonly [prefix: string, accent: AccentName][] = [
  ["/sponsors", "neutral"],
  ["/brand", "violet"],
  ["/blog", "amber"],
  ["/docs/migration", "orange"],
  ["/play", "emerald"],
]

const styles = {
  footer: css({
    borderTopWidth: "1px",
    borderTopStyle: "solid",
    borderTopColor: theme.border,
  }),
  inner: css({
    position: "relative",
    overflow: "hidden",
    display: "grid",
    gap: spacing[12],
    paddingInline: { base: spacing[4], [breakpoint.md]: spacing[10] },
    paddingBlockStart: spacing[14],
    // Was the wordmark's job; kept while the wordmark is off.
    paddingBlockEnd: spacing[14],
  }),
  field: css({
    maskImage:
      "radial-gradient(ellipse 60% 80% at 100% 0%, black 10%, transparent 70%)",
  }),
  columns: css({
    position: "relative",
    display: "grid",
    gap: spacing[8],
    gridTemplateColumns: {
      base: "repeat(2, minmax(0, 1fr))",
      [breakpoint.md]: "repeat(4, minmax(0, 1fr))",
    },
  }),
  column: css({ display: "grid", gap: spacing["2.5"], alignContent: "start" }),
  columnTitle: css({
    marginBlockEnd: spacing[1],
    fontSize: fontSize.xs,
    lineHeight: lineHeight.xs,
    fontWeight: fontWeight.semibold,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    color: theme.mutedForeground,
  }),
  link: css({
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    textDecorationLine: "none",
    color: { base: theme.mutedForeground, ":hover": theme.foreground },
  }),
  note: css({
    position: "relative",
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    color: theme.mutedForeground,
  }),
  wordmark: css({
    position: "relative",
    display: "block",
    width: "100%",
    height: "auto",
    marginBlockEnd: { base: "-0.6rem", [breakpoint.md]: "-1.4rem" },
    fontFamily: fontFamily.heading,
    fontWeight: fontWeight.bold,
    color: accent.base,
  }),
}

/** The giant outlined wordmark; not rendered for now (see the footer below). */
export function Wordmark() {
  return (
    <svg viewBox="0 0 1000 190" sx={styles.wordmark} aria-hidden="true">
      <defs>
        <linearGradient id="footer-wordmark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.25" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.9" />
        </linearGradient>
      </defs>
      <text
        x="0"
        y="170"
        textLength="1000"
        lengthAdjust="spacingAndGlyphs"
        fontSize="220"
        fill="none"
        stroke="url(#footer-wordmark)"
        strokeWidth="1.5"
      >
        kirana
      </text>
    </svg>
  )
}

export function SiteFooter() {
  const path = useRouterState({ select: (state) => state.location.pathname })
  const name =
    ROUTE_ACCENTS.find(([prefix]) => path.startsWith(prefix))?.[1] ?? "blue"

  return (
    <footer sx={[styles.footer, accents[name]]}>
      <Rail sx={styles.inner}>
        <PixelField sx={styles.field} opacity={0.4} />
        <div sx={styles.columns}>
          {FOOTER.map((column) => (
            <div key={column.title} sx={styles.column}>
              <p sx={styles.columnTitle}>{column.title}</p>
              {column.links.map((link) => (
                <DocsLink key={link.href} href={link.href} sx={styles.link}>
                  {link.label}
                </DocsLink>
              ))}
            </div>
          ))}
        </div>
        <p sx={styles.note}>
          Built in the open, for the web. MIT licensed, pre-release, and not yet
          published to npm.
        </p>
        {/* The outlined wordmark is off until the logo is settled.
            <Wordmark /> */}
      </Rail>
    </footer>
  )
}
