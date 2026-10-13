import { css } from "@kirana-style/core"

const root = css({ display: "grid", color: "red" })

export const Clean = ({ sx }) => <div sx={[root, sx]} />
