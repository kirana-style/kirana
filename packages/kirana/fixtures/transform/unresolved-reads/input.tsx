import { css } from "@kirana-style/core"
import DESIGN_SCRIPT from "virtual:design-script"
import { theme, useTheme } from "virtual:theme"
import { Head } from "./head"
import { tone } from "./loop-a"

// No style reads these: a prop, a callee and a component's name are runtime values, and an
// unresolved import or an import cycle behind them is not reported (KF-045).
export function Root() {
  const mode = useTheme()
  return <Head script={DESIGN_SCRIPT} mode={mode} late={late} accent={accent} shade={shade} />
}

// Asked about by the props above first, then read by a style: reported where the style reads them.
const late = css({ color: theme.late })
const accent = theme.accent
const shade = tone

export const box = css({ color: accent, borderColor: shade })
