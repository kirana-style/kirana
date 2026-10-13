import { css, cx } from "@kirana-style/core"

export const style = css({ "--gap": "1rem" }, css({ "--gap": "2rem", gap: "var(--gap)" }))
