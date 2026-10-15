/**
 * The editors Kirana's language server runs in, as cells of frosted glass on a landscape: each
 * editor's logo in white, its name, and how it gets the server — the extension, Open VSX, or the
 * editor's own LSP configuration. Cells are split by 1px gutters of the glass's rim.
 */
import { css } from "@kirana-style/core"
import { CommandLineIcon } from "@hugeicons/core-free-icons"

import { BrandIcon } from "@workspace/docs-ui/brand-icon.tsx"
import type { Sx } from "@workspace/ui/lib/sx"
import { Icon } from "@workspace/ui/primitives/icon"
import { breakpoint } from "@workspace/ui/tokens/breakpoints"
import { spacing } from "@workspace/ui/tokens/spacing"
import { fontFamily, fontWeight } from "@workspace/ui/tokens/typography"

import { SVGL } from "@/generated/svgl-icons.gen"

/** In the order the editor guide sets them up. */
export const EDITORS = [
  { icon: SVGL.vscode, name: "VS Code", how: "extension" },
  { icon: SVGL.cursor, name: "Cursor", how: "Open VSX" },
  { icon: SVGL.windsurf, name: "Windsurf", how: "Open VSX" },
  { icon: SVGL.antigravity, name: "Antigravity", how: "Open VSX" },
  { icon: SVGL.zed, name: "Zed", how: "extension" },
  { icon: SVGL.neovim, name: "Neovim", how: "vim.lsp.config" },
  { icon: SVGL.helix, name: "Helix", how: "languages.toml" },
] as const

const styles = {
  grid: css({
    display: "grid",
    gridTemplateColumns: {
      base: "repeat(2, minmax(0, 1fr))",
      [breakpoint.md]: "repeat(4, minmax(0, 1fr))",
    },
    gap: "1px",
    overflow: "hidden",
    borderRadius: { base: "0.75rem", [breakpoint.md]: "1rem" },
    // The gutters: the glass's rim showing between the cells.
    backgroundColor: "rgb(255 255 255 / 0.35)",
  }),
  cell: css({
    display: "grid",
    justifyItems: "center",
    alignContent: "center",
    gap: spacing[2],
    paddingInline: spacing[3],
    paddingBlock: { base: spacing[5], [breakpoint.md]: spacing[7] },
    backgroundColor: "rgb(12 16 22 / 0.55)",
    textAlign: "center",
    color: "#ffffff",
  }),
  // Every logo in white, so the grid reads as one set; the name says which it is.
  logo: css({ filter: "brightness(0) invert(1)" }),
  name: css({ fontSize: "0.9375rem", fontWeight: fontWeight.semibold }),
  how: css({
    fontFamily: fontFamily.mono,
    fontSize: "0.75rem",
    color: "rgb(255 255 255 / 0.7)",
  }),
}

export function EditorsGrid({ size = "2rem", sx }: { size?: string; sx?: Sx }) {
  return (
    <div sx={[styles.grid, sx]}>
      {EDITORS.map(({ icon, name, how }) => (
        <div key={name} sx={styles.cell}>
          <BrandIcon icon={icon} scheme="dark" size={size} sx={styles.logo} />
          <span sx={styles.name}>{name}</span>
          <span sx={styles.how}>{how}</span>
        </div>
      ))}
      {/* The eighth cell: the server itself, in any other editor. */}
      <div sx={styles.cell}>
        <Icon icon={CommandLineIcon} size={size} />
        <span sx={styles.name}>Any LSP editor</span>
        <span sx={styles.how}>kirana-style lsp</span>
      </div>
    </div>
  )
}
