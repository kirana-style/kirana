import { css } from "@kirana-style/core"

export const bad = css({
  colour: "red",
  width: 5,
  color: "",
  margin: "1px;",
  padding: "var(--unknown)",
  ":hover": { color: "red" },
  base: "x",
  display: { "hover": "block", [Symbol.iterator as never]: "x" },
  opacity: true,
  "::bogus": { color: "red" },
  "::before": "not an object",
  top: { "*": "not null" },
  left: { ":hover": { "*": null } },
  backgroundColour: null,
})
export const badAtRuntime = (value: string) => css({ borderColour: value })
