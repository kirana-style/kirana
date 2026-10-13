import { css } from "@kirana-style/core"

export const box = css({ display: "grid", color: "#ff0000", gap: "1rem" })
export const broken = css({ width: 5 })
export const typing = css({ display: "flex", alignItems: "cen" })

export const Card = () => <div sx={box} />
