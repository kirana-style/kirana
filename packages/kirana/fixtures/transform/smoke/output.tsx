import { runtime as __kirana_runtime } from "@kirana-style/core/internal";
const __k = /* @__PURE__ */ __kirana_runtime("k", "className");

import { md, space, theme } from "./tokens"

const styles = {
  row: "k5O_23ai kJ_pnCg k0_Elck k0-0w85_HV2H k50_NYVC k50-KFHz_wERY k7X_iNo1",
  active: "k50_D9ur k87*_",
}

export function Row({ active, width, sx }: { active: boolean; width: number; sx?: string }) {
  return (
    <div {...__k.sx(["k5O_23ai kJ_pnCg k0_Elck k0-0w85_HV2H k50_NYVC k50-KFHz_wERY k7X_iNo1", (active) ? "k50_D9ur k87*_" : "", (sx)], [], [])}>
      <span className="k50_D9ur" />
      <p {...__k.sx([/* @__PURE__ */ __k.b("k75_NvtF", "--k75", (`${width}%`))], ["x"], [])} />
      {"k5O_23ai kJ_pnCg k0_Elck k0-0w85_HV2H k50-KFHz_wERY k7X_iNo1 k50_D9ur k87*_"}
    </div>
  )
}
