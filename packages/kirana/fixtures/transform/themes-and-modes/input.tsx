import { defineTheme, defineTokens, media, mode } from "@kirana-style/core"
import { fixed, theme } from "./tokens"

export const brand = defineTheme(theme, {
  primary: "oklch(0.7 0.2 40)",
  blend: { light: "multiply", dark: "screen" },
  group: { inner: "2px" },
})
export const coloured = defineTheme(theme, { primary: { light: "white", dark: "black" } })
export const broken = defineTheme(theme, { missing: "x", group: "y", primary: { weird: 1 } })
export const notVariable = defineTheme(fixed, { size: "2px" })
export const invalid = defineTheme("theme")
// A condition key is not a token name: skipped.
export const conditional = defineTheme(theme, { [media("(min-width: 1px)") as never]: "x" })
// Two fixed tokens holding the same variable token.
export const aliases = defineTokens("aliases", { a: theme.primary, b: theme.primary })

export function Root({ current }: { current: "system" | "light" | "dark" }) {
  return (
    <html sx={[mode.dark, brand]}>
      <body sx={mode[current]} />
      <header sx={[current === "dark" && brand, brand]} />
      <main sx={mode.system} data-unknown={String(mode.nope)} />
    </html>
  )
}
