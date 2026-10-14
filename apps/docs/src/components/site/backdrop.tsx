/**
 * One of Kirana's landscapes with frosted glass on it: the stage a desktop scene sits on. The
 * picture is a painted highland morning (`public/scenes/`, WebP at 800 and 1600 pixels); the
 * glass is a pane of white at low opacity that blurs what is behind it, with a light rim, and
 * whatever sits on the stage sits inside the pane.
 *
 * The picture is the same in both colour schemes: it is a scene, not a surface.
 */
import { css } from "@kirana-style/core"

import type { Sx } from "@workspace/ui/lib/sx"
import { breakpoint } from "@workspace/ui/tokens/breakpoints"
import { spacing } from "@workspace/ui/tokens/spacing"

const styles = {
  stage: css({
    position: "relative",
    isolation: "isolate",
    overflow: "hidden",
    borderRadius: { base: "1.25rem", [breakpoint.md]: "1.75rem" },
    paddingInline: { base: spacing[3], [breakpoint.md]: "6%" },
    paddingBlockStart: { base: spacing[4], [breakpoint.md]: "6%" },
    paddingBlockEnd: { base: spacing[16], [breakpoint.md]: "11%" },
    backgroundColor: "#6d8fa8",
  }),
  picture: css({
    position: "absolute",
    inset: 0,
    zIndex: -1,
    width: "100%",
    height: "100%",
    objectFit: "cover",
    objectPosition: "50% 40%",
  }),
  glass: css({
    position: "relative",
    padding: { base: spacing["2"], [breakpoint.md]: spacing[3] },
    borderRadius: { base: "1rem", [breakpoint.md]: "1.375rem" },
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "rgb(255 255 255 / 0.5)",
    backgroundColor: "rgb(255 255 255 / 0.18)",
    backdropFilter: "blur(16px) saturate(1.3)",
    boxShadow:
      "inset 0 1px 0 rgb(255 255 255 / 0.35), 0 30px 70px -30px rgb(10 20 30 / 0.6)",
  }),
}

export function Backdrop({
  label,
  sx,
  glassSx,
  children,
  before,
  after,
}: {
  /** What the scene shows, for assistive tech; the picture itself is decoration. */
  label: string
  sx?: Sx
  glassSx?: Sx
  /** The pane's content. */
  children: React.ReactNode
  /** Anything on the stage above the pane (a name). */
  before?: React.ReactNode
  /** Anything on the stage outside the pane (a link pinned to its corner). */
  after?: React.ReactNode
}) {
  return (
    <div sx={[styles.stage, sx]} role="img" aria-label={label}>
      <img
        sx={styles.picture}
        src="/scenes/highlands-800.webp"
        srcSet="/scenes/highlands-800.webp 800w, /scenes/highlands-1600.webp 1600w"
        sizes="(min-width: 64rem) 60vw, 100vw"
        alt=""
        loading="lazy"
        decoding="async"
      />
      {before}
      <div sx={[styles.glass, glassSx]}>{children}</div>
      {after}
    </div>
  )
}
