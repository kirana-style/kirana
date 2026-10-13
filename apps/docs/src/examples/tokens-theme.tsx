import { css, defineTokens } from "@kirana-style/core"

// A variable token: a typed constant here, a custom property in the CSS.
const brand = defineTokens(
  "demo-brand",
  { accent: "light-dark(oklch(0.55 0.2 260), oklch(0.72 0.15 260))" },
  { variable: true }
)

const styles = {
  row: css({ display: "flex", alignItems: "center", gap: "0.75rem" }),
  // A subtree overrides the value; everything below follows.
  warm: css({
    display: "flex",
    [brand.accent]: "light-dark(oklch(0.62 0.19 45), oklch(0.75 0.15 60))",
  }),
  chip: css({
    borderRadius: "999px",
    paddingInline: "0.875rem",
    paddingBlock: "0.375rem",
    fontSize: "0.875rem",
    fontWeight: 500,
    color: "white",
    backgroundColor: brand.accent,
  }),
}

export default function TokensTheme() {
  return (
    <div sx={styles.row}>
      <span sx={styles.chip}>Default</span>
      <div sx={styles.warm}>
        <span sx={styles.chip}>Overridden</span>
      </div>
    </div>
  )
}
