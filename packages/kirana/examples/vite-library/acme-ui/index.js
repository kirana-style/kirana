// Built JavaScript, as a library publishes it: the `css()` calls are left for the application's
// compiler (KRN-INT-008), and styles are applied with `props()`, which it compiles in plain JS.
import { css, props } from "@kirana-style/core"
import { jsx } from "react/jsx-runtime"

import { space } from "./tokens.js"

export { space }

const styles = {
  probe: css({
    color: "rgb(1, 2, 3)",
    paddingTop: space.gap,
    backgroundColor: { base: "rgb(250, 250, 250)", ":hover": "rgb(4, 5, 6)" },
  }),
}

export function Probe({ children }) {
  return jsx("p", { "data-probe": "", ...props(styles.probe), children })
}
