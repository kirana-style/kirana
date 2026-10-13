import { css, recipe } from "@kirana-style/core"

import { Separator } from "./separator"

const size = (width) => css({ width })
const button = recipe({ variants: { tone: { quiet: {}, loud: {} } } })

export const Uses = () => (
  <>
    <Separator sx={css({ alignSelf: "auto", color: "#0af" })} />
    <Separator className="legacy" sx={size("1px")} />
    <p sx={[size("2px"), button({ tone: "quiet" })]} />
  </>
)
