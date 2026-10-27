import { runtime as __kirana_runtime } from "@kirana-style/core/internal";
const __k = /* @__PURE__ */ __kirana_runtime("k", "className");

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
const late = /* @__PURE__ */ __k.cx(/* @__PURE__ */ __k.b("k50_OuAg", "--k50", (theme.late)))
const accent = theme.accent
const shade = tone

export const box = /* @__PURE__ */ __k.cx(/* @__PURE__ */ __k.b("k50_OuAg", "--k50", (accent)), /* @__PURE__ */ __k.b("kk_aMNl", "--kk", (shade)))
