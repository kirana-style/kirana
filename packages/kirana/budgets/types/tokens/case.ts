// A theme: nested token groups with light and dark values, registered and variable tokens, a
// scoped theme and tokens read in a style.
import { css, defineTheme, defineTokens } from "@kirana-style/core"

export const color = defineTokens(
  "color",
  {
    background: { light: "white", dark: "black" },
    foreground: { light: "black", dark: "white" },
    muted: {
      base: { light: "whitesmoke", dark: "#222" },
      foreground: { light: "gray", dark: "silver" },
    },
    accent: {
      base: { light: "royalblue", dark: "cornflowerblue" },
      on: { light: "white", dark: "black" },
    },
    border: { light: "gainsboro", dark: "#333" },
    ring: { value: "royalblue", variable: true },
  },
  { variable: true }
)

export const space = defineTokens("space", {
  1: "0.25rem",
  2: "0.5rem",
  3: "0.75rem",
  4: "1rem",
  progress: { value: "0%", syntax: "<length-percentage>" },
})

export const ocean = defineTheme(color, {
  accent: { base: { light: "teal", dark: "turquoise" } },
  ring: "teal",
})

export const surface = css({
  backgroundColor: { base: color.background, ":hover": color.muted.base },
  color: color.foreground,
  borderColor: color.border,
  padding: space[4],
  gap: space[2],
})
