import { css } from "@kirana-style/core"

// A codebase from StyleX writes the same unsplittable value everywhere: one warning, with the count.
export const row = css({ borderColor: "var(--divider)", borderBottomWidth: "1px" })
export const cell = css({ borderColor: "var(--divider)" })
export const head = css({ padding: "4px", borderColor: { base: "var(--divider)", ":hover": "var(--divider)" } })
// Another value is its own warning.
export const card = css({ borderColor: "var(--card-border)" })
// One declaration read by two styles is one occurrence, not two.
const shared = { borderColor: "var(--shared)" }
export const left = css(shared)
export const right = css(shared, { color: "red" })
