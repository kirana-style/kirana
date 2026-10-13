import { css } from "@kirana-style/core"

const styles = {
  card: css({
    display: "grid",
    gap: "0.25rem",
    maxWidth: "18rem",
    borderRadius: "0.75rem",
    padding: { base: "1rem", "@media (min-width: 40rem)": "1.25rem" },
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: {
      base: "light-dark(oklch(0.92 0 0), oklch(0.3 0 0))",
      ":hover": "light-dark(oklch(0.7 0 0), oklch(0.5 0 0))",
    },
    transitionProperty: "border-color",
    transitionDuration: "150ms",
  }),
  title: css({ fontWeight: 600 }),
  text: css({
    fontSize: "0.875rem",
    color: "light-dark(oklch(0.45 0 0), oklch(0.7 0 0))",
  }),
}

export default function CompileCard() {
  return (
    <article sx={styles.card}>
      <h3 sx={styles.title}>One class per declaration</h3>
      <p sx={styles.text}>Hover the card: the condition lives in its value.</p>
    </article>
  )
}
