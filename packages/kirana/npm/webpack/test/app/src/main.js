import "@kirana-style/core/stylesheet.css"
import { css, cx } from "@kirana-style/core"
import { space } from "./tokens.js"
import { late } from "./late.js"
import { answer } from "./plain.js"

const box = css({ display: "grid", gap: space[4] })
document.querySelector("#app").className = String(cx(box, late))
document.body.dataset.answer = String(answer)
