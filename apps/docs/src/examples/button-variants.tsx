import { css } from "@kirana-style/core"

const styles = {
  base: css({
    display: "inline-flex",
    alignItems: "center",
    borderRadius: "0.5rem",
    paddingInline: "0.875rem",
    paddingBlock: "0.5rem",
    fontSize: "0.875rem",
    fontWeight: 500,
    // A condition nests inside the value it changes, so the whole story of
    // `background-color` is in one place.
    backgroundColor: {
      base: "light-dark(oklch(0.21 0 0), oklch(0.92 0 0))",
      ":hover": "light-dark(oklch(0.31 0 0), oklch(0.85 0 0))",
    },
    color: "light-dark(oklch(0.98 0 0), oklch(0.21 0 0))",
  }),
  quiet: css({
    backgroundColor: {
      base: "transparent",
      ":hover": "light-dark(oklch(0.95 0 0), oklch(0.27 0 0))",
    },
    color: "light-dark(oklch(0.21 0 0), oklch(0.92 0 0))",
  }),
}

export default function ButtonVariants() {
  return (
    <div sx={css({ display: "flex", gap: "0.75rem" })}>
      <button sx={styles.base}>Save changes</button>
      {/* The later handle wins per entry: `:hover` here replaces the `:hover`
          above, and the base colour replaces the base colour. */}
      <button sx={[styles.base, styles.quiet]}>Cancel</button>
    </div>
  )
}
