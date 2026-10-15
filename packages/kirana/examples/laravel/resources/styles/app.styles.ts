import { css } from "@kirana-style/core"

/**
 * The styles the Blade views name. `kirana-style build` and `kirana-style dev` write their class strings to the
 * class map, which `@kirana(…)` reads.
 */
export const probe = css({
  color: "rgb(1, 2, 3)",
  paddingTop: "7px",
  backgroundColor: { base: "rgb(250, 250, 250)", ":hover": "rgb(4, 5, 6)" },
})

export const quiet = css({ marginLeft: "1px" })
