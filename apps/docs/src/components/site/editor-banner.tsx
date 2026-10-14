/**
 * The editor guide's banner: Kirana's name, large and in white, on one of its landscapes, and under
 * it the editors the language server runs in (`EditorsGrid`). No editor is drawn: the editor scene
 * further down the page shows what the server answers. It is also the picture the VS Code
 * extension's README opens with (captured from this page).
 */
import { css } from "@kirana-style/core"

import { breakpoint } from "@workspace/ui/tokens/breakpoints"
import { spacing } from "@workspace/ui/tokens/spacing"

import { KiranaMark } from "@/brand/kirana-mark-svg"
import { PARTS } from "@/brand/kirana-mark"
import type { Part } from "@/brand/kirana-mark"

import { Backdrop } from "./backdrop"
import { EditorsGrid } from "./editors-grid"
import { Wordmark } from "./wordmark"

/** The mark in solid white: every part's gradient is one white stop. */
const WHITE = Object.fromEntries(
  Object.keys(PARTS).map((part) => [
    part,
    [
      [0, "#ffffff"],
      [1, "#ffffff"],
    ],
  ])
) as Record<Part, [number, string][]>

const styles = {
  banner: css({ marginBlock: spacing[6] }),
  stage: css({
    paddingBlockStart: { base: spacing[8], [breakpoint.md]: spacing[12] },
    paddingBlockEnd: { base: spacing[6], [breakpoint.md]: spacing[10] },
  }),
  glass: css({ padding: { base: spacing[2], [breakpoint.md]: spacing[3] } }),
  // The name in white, in the dark scheme so the wordmark's tokens take their light side.
  name: css({
    colorScheme: "dark",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: { base: spacing[3], [breakpoint.md]: spacing[5] },
    marginBlockEnd: { base: spacing[6], [breakpoint.md]: spacing[10] },
    color: "#ffffff",
    // A faint lift off the sky, no more.
    filter: "drop-shadow(0 2px 6px rgb(10 20 30 / 0.18))",
  }),
  mark: css({ height: { base: "3.5rem", [breakpoint.md]: "5.5rem" } }),
  // "style" lighter than "kirana", as the wordmark sets it, but white enough for the sky.
  wordmarkStyle: css({ fontSize: "0.62em", color: "rgb(255 255 255 / 0.85)" }),
  wordmark: css({
    fontSize: { base: "2.75rem", [breakpoint.md]: "4.5rem" },
    color: "#ffffff",
  }),
}

export function EditorBanner() {
  return (
    <div sx={styles.banner}>
      <Backdrop
        sx={styles.stage}
        glassSx={styles.glass}
        label="Kirana, and the editors its language server runs in: VS Code, Cursor, Windsurf, Antigravity, Zed, Neovim, Helix and any other LSP editor"
        before={
          <div sx={styles.name}>
            <KiranaMark title={null} stops={WHITE} sx={styles.mark} />
            <Wordmark sx={styles.wordmark} styleSx={styles.wordmarkStyle} />
          </div>
        }
      >
        <EditorsGrid />
      </Backdrop>
    </div>
  )
}
