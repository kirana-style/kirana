import { runtime as __kirana_runtime } from "@kirana-style/core/internal";
const __k = /* @__PURE__ */ __kirana_runtime("k", "className");

import { fixed, theme } from "./tokens"

export const brand = "ktbTwq"
export const coloured = "ktLqfH"
export const broken = "ktyEA8"
export const notVariable = "ktyEA8"
export const invalid = undefined
// A condition key is not a token name: skipped.
export const conditional = "ktyEA8"
// Two fixed tokens holding the same variable token.
export const aliases = {"a": "var(--kvHzaz)", "b": "var(--kvHzaz)"}

export function Root({ current }: { current: "system" | "light" | "dark" }) {
  return (
    <html className="km-dark ktbTwq k52_ap5c">
      <body {...__k.sx([({"system": "k52_f6nz", "light": "km-light k52_purd", "dark": "km-dark k52_ap5c"}[current])], [], [])} />
      <header {...__k.sx([(current === "dark") ? "ktbTwq" : "", "ktbTwq"], [], [])} />
      <main className="k52_f6nz" data-unknown={String({"system": "k52_f6nz", "light": "km-light k52_purd", "dark": "km-dark k52_ap5c"}.nope)} />
    </html>
  )
}
