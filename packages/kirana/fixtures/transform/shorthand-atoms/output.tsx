import { runtime as __kirana_runtime } from "@kirana-style/core/internal";
const __k = /* @__PURE__ */ __kirana_runtime("k", "className");


// One component: one shorthand atom per box family (D-045).
export const box = "k0_HV2H kJ_pnCg kJ-KFHz_iExv ka_pZ99 kM_vJdK"

// A later longhand keeps the atom and wins at ladder step 5; several components expand as before.
export const override = "k0_HV2H kJ_pnCg kJ-KFHz_iExv ka_pZ99 kM_vJdK k4_oD60 k5_ k9_GvB4 k8_8bbU k6_GvB4 k7_8bbU"

// A removal unfolds the atom into the longhands it keeps; the stylesheet gets their rules.
export const removed = "k0/1.2.3*_ k4*_ kJ-KFHz_ kK-KFHz_ kL-KFHz_"

// Not a family: `border` stays one atom with explicit tombstones; `borderTop` is secondary.
export const border = "k4j_ kk_ k4w_ k4x_ kp_ kf_ kh_ ki_ kj_ kr_ ks_ kt_ km_ kn_ ko_ k4f_liOv kk/m.n.o_ kp/r.s.t_ kf/h.i.j_ kg_ kq_ kl_ k4C_4IBj"

// A family Lightning CSS does not split, and a runtime value.
export function Panel({ size, sx }: { size: string; sx?: string }) {
  return (
    <div
      {...__k.sx(["k0_HV2H kJ_pnCg kJ-KFHz_iExv ka_pZ99 kM_vJdK k1g_mTvr", /* @__PURE__ */ __k.b("ku_OAhx", "--ku", (`${size}px`)), "k0*_ k1*_ k2*_ k3*_ k4*_ kS*_ kP*_ kQ*_ kR*_ kT*_ kU*_", (sx)], [], [])}
    />
  )
}
