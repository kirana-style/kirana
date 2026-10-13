import { css } from "@kirana-style/core"
import { ctx, space, theme } from "./tokens"

export const box = css({
  gap: space[1.5],
  paddingInline: space.px,
  color: theme.fg,
  mixBlendMode: theme.blend,
  outlineColor: theme.ring,
  borderColor: theme.accent,
  backgroundColor: theme.mix,
  borderWidth: theme.nested.level.deep,
  zIndex: theme.count,
  [ctx.gap]: { base: "1rem", ":hover": ctx.icon },
  rowGap: ctx.gap,
})
export const missing = css({ color: theme.nope })
export const notVariable = css({ [space.px]: "2px" })
