import { css, select } from "@kirana-style/core"

export const icons = css({
  [select.descendant("svg")]: { width: "1rem", height: { base: "1rem", ":hover": "2rem" } },
  [select.child('[data-slot="icon"]')]: { marginInlineStart: "-0.25rem", "::after": { content: "''" } },
  [select.descendant("svg[data-icon]")]: { flexShrink: 0 },
  // A pseudo-class narrows the target (D-061): the last span child, a hovered link.
  [select.child("span:last-child")]: { overflow: "hidden" },
  [select.descendant("a:hover:not([data-disabled])")]: { textDecorationLine: "underline" },
})
export const invalid = css({
  color: { [select.descendant("svg")]: "red" },
  [select.descendant(".class")]: { color: "red" },
  [select.child("a > b")]: { color: "red" },
  [select.descendant("9x")]: { color: "red" },
  [select.child("")]: { color: "red" },
  [select.child("svg::before")]: { color: "red" },
  "::after": { [select.descendant("svg")]: { color: "red" } },
})
export const nested = css({ [select.descendant("svg")]: { "::before": { "::after": { color: "red" } } } })
export const notObject = css({ [select.descendant("svg")]: "red" })
