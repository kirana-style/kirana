import { css, defineTokens, mode, props as styleProps, relation } from "@kirana-style/core"

const styles = { root: css({ display: "grid" }), empty: css({}) }

// A static `props()` call is inlined as an object literal, which `{` at the start of an arrow's
// body or of a statement would read as a block: it is written in parentheses (KF-128).
export const root = () => styleProps(styles.root)
export const empty = () => styleProps(styles.empty)
export const nothing = () => styleProps()
export function returned(on: boolean) {
  if (on) styleProps(styles.root)
  return styleProps(styles.root)
}
export const sequence = () => (console.log("render"), styleProps(styles.root))
export const spread = () => <div {...styleProps(styles.root)} />

// At the start of a statement in a list, after a semicolon: the statement before ends without one,
// and a parenthesis would call it.
styleProps(styles.root)
export function statements() {
  console.log("render")
  styleProps(styles.root).class
  mode.dark
}

// The other object literals written in place of an expression: `mode`, a relation, fixed tokens.
export const modes = () => mode
const field = relation("field")
export const scope = () => relation("scope")
export const sizes = () => defineTokens("sizes", { small: "2px" })
export const label = css({ opacity: { [field.within("[data-disabled]")]: 0.5 } })
export const anchored = () => <div sx={field.anchor} />
