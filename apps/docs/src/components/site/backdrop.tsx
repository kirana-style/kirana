/**
 * One of Kirana's landscapes with a pane of frosted glass on it: the stage a desktop scene sits
 * on. The picture is the page's scene (`src/brand/scenes.ts`) or the one given, the same in both
 * colour schemes: it is a scene, not a surface.
 */
import { css } from "@kirana-style/core"

import type { Sx } from "@workspace/ui/lib/sx"
import { theme } from "@workspace/ui/theme/semantic"
import { breakpoint } from "@workspace/ui/tokens/breakpoints"
import { spacing } from "@workspace/ui/tokens/spacing"

import { SCENES, sceneImage, sceneSrcSet } from "@/brand/scenes"
import type { SceneId } from "@/brand/scenes"

import { useScene } from "./scene-context"

const styles = {
  stage: css({
    position: "relative",
    isolation: "isolate",
    overflow: "hidden",
    borderRadius: { base: "1.25rem", [breakpoint.md]: "1.75rem" },
    paddingInline: { base: spacing[3], [breakpoint.md]: "6%" },
    paddingBlockStart: { base: spacing[4], [breakpoint.md]: "6%" },
    paddingBlockEnd: { base: spacing[16], [breakpoint.md]: "11%" },
    // Under the picture until it loads.
    backgroundColor: theme.muted,
  }),
  picture: css({
    position: "absolute",
    inset: 0,
    zIndex: -1,
    width: "100%",
    height: "100%",
    objectFit: "cover",
  }),
  // The same frame as the header menu's: 6 px of glass, and corners the window's radius (0.75rem)
  // plus that frame, so the rim runs parallel to the window inside it.
  glass: css({
    position: "relative",
    padding: spacing["1.5"],
    borderRadius: "1.125rem",
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
  scene: given,
  sx,
  glassSx,
  children,
  before,
  after,
}: {
  /** What the scene shows, for assistive tech; the picture itself is decoration. */
  label: string
  /** The landscape; the page's scene when not given. */
  scene?: SceneId
  sx?: Sx
  glassSx?: Sx
  /** The pane's content. */
  children: React.ReactNode
  /** Anything on the stage above the pane (a name). */
  before?: React.ReactNode
  /** Anything on the stage outside the pane (a link pinned to its corner). */
  after?: React.ReactNode
}) {
  const fromPage = useScene()
  const scene = given ?? fromPage
  return (
    <div sx={[styles.stage, sx]} role="img" aria-label={label}>
      <img
        sx={styles.picture}
        src={sceneImage(scene, 800)}
        srcSet={sceneSrcSet(scene)}
        style={{ objectPosition: SCENES[scene].position }}
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
