import "@kirana-style/core/stylesheet.css"
import { css, cx } from "@kirana-style/core"
import { space } from "./tokens.ts"

const box = css({ display: "grid", gap: space[4] })
document.querySelector("#app")!.className = String(cx(box))
