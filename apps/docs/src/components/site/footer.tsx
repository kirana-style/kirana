/**
 * The site footer: who Kirana is in two lines, the three link groups, then the page's own scene
 * in pixels, dissolving up into the paper. Every page ends in the place it stood in, so the
 * footer changes with the page instead of being one colour everywhere.
 */
import { css, props as styleProps } from "@kirana-style/core"
import { Link } from "@tanstack/react-router"

import { accents } from "@workspace/docs-ui/accent.ts"
import { theme } from "@workspace/ui/theme/semantic"
import { breakpoint, pointer } from "@workspace/ui/tokens/breakpoints"
import { spacing } from "@workspace/ui/tokens/spacing"
import {
  fontFamily,
  fontSize,
  fontWeight,
  letterSpacing,
  lineHeight,
  textLeading,
  textSize,
  textTracking,
} from "@workspace/ui/tokens/typography"

import { KiranaMark } from "@/brand/kirana-mark-svg"
import { SCENES } from "@/brand/scenes"
import type { SceneId } from "@/brand/scenes"
import { DocsLink } from "@/components/docs-link"

import { FOOTER } from "./nav"
import { Rail } from "./patterns"
import { useScene } from "./scene-context"
import { ScenePixels } from "./scene-pixels"
import { Wordmark } from "./wordmark"

const styles = {
  footer: css({
    borderTopWidth: "1px",
    borderTopStyle: "solid",
    borderTopColor: theme.border,
  }),
  inner: css({
    display: "grid",
    gap: { base: spacing[12], [breakpoint.lg]: spacing[10] },
    gridTemplateColumns: {
      base: "minmax(0, 1fr)",
      [breakpoint.lg]: "minmax(0, 1fr) minmax(0, 2fr)",
    },
    paddingInline: { base: spacing[5], [breakpoint.md]: spacing[10] },
    paddingBlock: { base: spacing[14], [breakpoint.md]: spacing[16] },
  }),
  identity: css({ display: "grid", gap: spacing[4], alignContent: "start" }),
  brand: css({
    // A finger-sized target on a touch screen.
    minHeight: { [pointer.coarse]: "2.75rem" },
    display: "inline-flex",
    alignItems: "center",
    gap: spacing[2],
    justifySelf: "start",
    color: theme.foreground,
    textDecorationLine: "none",
  }),
  logo: css({ height: "21px", width: "auto" }),
  line: css({
    maxWidth: "24rem",
    fontFamily: fontFamily.heading,
    fontSize: fontSize["2xl"],
    fontWeight: fontWeight.medium,
    lineHeight: lineHeight["2xl"],
    letterSpacing: letterSpacing.tight,
    color: theme.foreground,
    textWrap: "balance",
  }),
  note: css({
    maxWidth: "22rem",
    fontSize: fontSize.sm,
    lineHeight: "1.6",
    color: theme.mutedForeground,
  }),
  groups: css({
    display: "grid",
    gap: spacing[8],
    gridTemplateColumns: {
      base: "repeat(2, minmax(0, 1fr))",
      [breakpoint.md]: "repeat(3, minmax(0, 1fr))",
    },
  }),
  group: css({ display: "grid", gap: spacing["2.5"], alignContent: "start" }),
  groupTitle: css({
    marginBlockEnd: spacing[1],
    fontFamily: fontFamily.mono,
    fontSize: textSize.label,
    lineHeight: textLeading.label,
    letterSpacing: textTracking.label,
    textTransform: "uppercase",
    fontWeight: fontWeight.medium,
    color: theme.foreground,
  }),
  link: css({
    justifySelf: "start",
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    textDecorationLine: "none",
    color: { base: theme.mutedForeground, ":hover": theme.foreground },
  }),
  // The scene: the rail's width, dissolving up into the links.
  scene: css({
    position: "relative",
    height: { base: "9rem", [breakpoint.md]: "13rem" },
  }),
}

export function SiteFooter({ scene: given }: { scene?: SceneId }) {
  const fromPage = useScene()
  const scene = given ?? fromPage
  return (
    <footer sx={[styles.footer, accents[SCENES[scene].hue]]}>
      <Rail sx={styles.inner}>
        <div sx={styles.identity}>
          <Link to="/" aria-label="Kirana, home" {...styleProps(styles.brand)}>
            <KiranaMark variant="solid" title={null} sx={styles.logo} />
            <Wordmark />
          </Link>
          <p sx={styles.line}>
            Styles next to your components, one stylesheet in the build.
          </p>
          <p sx={styles.note}>
            Built in the open, MIT licensed. On npm as a pre-release.
          </p>
        </div>
        <nav sx={styles.groups} aria-label="Footer">
          {FOOTER.map((group) => (
            <div key={group.title} sx={styles.group}>
              <p sx={styles.groupTitle}>{group.title}</p>
              {group.links.map((link) => (
                <DocsLink key={link.href} href={link.href} sx={styles.link}>
                  {link.label}
                </DocsLink>
              ))}
            </div>
          ))}
        </nav>
      </Rail>
      <Rail sx={styles.scene}>
        <ScenePixels scene={scene} dissolve="up" fade={0.85} />
      </Rail>
    </footer>
  )
}
