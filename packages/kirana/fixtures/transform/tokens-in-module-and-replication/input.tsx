import { css, defineTokens } from "@kirana-style/core"

export const radius = defineTokens("radius", { lg: "0.5rem", pair: "1px 2px" }, { variable: true })
export const sizes = defineTokens("sizes", { single: { light: "1rem", dark: "2rem" } })
export const box = css({
  borderRadius: radius.lg,
  padding: radius.pair,
  margin: sizes.single,
  gap: `min(${radius.lg}, 10px)`,
  inset: "var(--from-a-library)",
  borderColor: `var(--kvnotaToken)`,
})
export const values = [radius.lg, sizes.single]
export const everything = radius
