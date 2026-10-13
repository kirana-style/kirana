import * as stylex from "@stylexjs/stylex"
import { spacing } from "./tokens.stylex"

export const colors = stylex.defineVars({ ink: "black" })
export const sizes = stylex.defineConsts({ gap: "1rem" })
export const brand = stylex.createTheme(colors, { ink: "navy" })
export const spin = stylex.keyframes({ to: { transform: "rotate(360deg)" } })
export const fieldMarker = stylex.defineMarker()

const styles = stylex.create({
  root: {
    color: "black",
    backgroundColor: {
      default: "white",
      ":hover": "grey",
    },
    outlineColor: {
      default: null,
      ":focus": "blue",
    },
    opacity: {
      default: 1,
      [stylex.when.ancestor("[data-disabled]", fieldMarker)]: 0.5,
      [stylex.when.siblingBefore(":checked")]: 0.8,
    },
  },
  size: (width: number) => ({ width }),
})

export function Field({ style }: { style?: stylex.StyleXStyles }) {
  const attributes = stylex.props(styles.root, style)
  return (
    <div {...stylex.props(styles.root, fieldMarker, stylex.defaultMarker())}>
      <span {...attributes} />
      <i {...stylex.props(styles.size(spacing.x))} />
    </div>
  )
}
