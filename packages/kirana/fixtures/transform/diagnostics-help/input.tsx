import { css, defineTheme, defineTokens, firstThatWorks, recipe, relation } from "@kirana-style/core"

// Each mistake's help names the fix: the nearest name, or nothing when none is near.
export const theme = defineTokens("theme", { primary: "blue", surface: "white" }, { variable: true })
export const dark = defineTheme(theme, { primray: "navy", zzzzzz: "x" })
const field = relation("field")

export const names = css({
  justifyContnet: "center",
  "justify-contnet": "center",
  zzzzzzzz: "red",
  color: theme.primray,
  backgroundColor: theme.qqqqqqqq,
  "::befor": { content: "''" },
  "::zzzzzz": { content: "''" },
  borderColor: { [field.within(":hovr")]: "red" },
  borderTopColor: { ":focus-visble": "blue", hover: "green", "&:active": "black", zzzzzz: "red" },
  outlineColor: { "@meda (width >= 40rem)": "red", md: "blue" },
})

// A misspelt keyword: a warning with the keyword, on a longhand, a box shorthand, a shorthand the
// parser cannot split; a known word rejected, with the keyword near it; none in a fallback, none
// for a custom ident, a substitution or a word too far.
export const keywords = css({
  display: "flx",
  margin: "atuo",
  border: "1px soild red",
  position: "absolue",
  flexDirection: "columns",
  float: "bold",
  alignItems: firstThatWorks("anchr-center", "center"),
  borderBlock: firstThatWorks("1px solid var(--a)", "1px solid var(--b)"),
  animationName: "fdae",
  justifyContent: "var(--flx)",
  overflow: "zzzzzzzz",
})

export const button = recipe({
  slots: ["root", "label"],
  base: { root: { display: "flex" }, lable: { color: "red" }, zzzzzz: {} },
  variants: { tone: { primary: { root: { color: "white" } }, ghost: {} } },
  defaultVariants: { tone: "primay", tnoe: "ghost", zzzzzz: "x" },
  compoundVariants: [{ tone: "zzzzzz", css: {} }],
})

export function View() {
  const one = button({ tone: "ghots" })
  const two = button({ tnoe: "primary" })
  const three = button({ zzzzzz: "primary" })
  const four = button({ tone: "zzzzzz" })
  return [one, two, three, four]
}
