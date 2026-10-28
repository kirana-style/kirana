import { runtime as __kirana_runtime } from "@kirana-style/core/internal";
const __k = /* @__PURE__ */ __kirana_runtime("k", "className");


// A part pads its sides, and a caller resets the whole box: `"*": null` on `padding` drops the
// part's `paddingInline` too, which would otherwise outrank the later `padding` (KF-064).
const content = "kP_2Xcz kS_Ms6K"
const flush = "k0*_ k1*_ k2*_ k3*_ k4*_ kS*_ kP*_ kQ*_ kR*_ kT*_ kU*_ k0_wwfA"

export const merged = "k0*_ k1*_ k2*_ k3*_ k4*_ kS*_ kP*_ kQ*_ kR*_ kT*_ kU*_ k0_wwfA"

// `padding: null` is a whole removal too; so is `borderRadius`'s, for its logical corners.
export const nulled = "k0*_ k1*_ k2*_ k3*_ k4*_ kS*_ kP*_ kQ*_ kR*_ kT*_ kU*_"
export const corners = "ka*_ kb*_ kc*_ kd*_ ke*_ k4B*_ k4A*_ k4m*_ k4l*_ ka_wwfA"

// One side, or a removal under a condition, keeps to the property it names: which logical side
// `paddingLeft` is depends on the direction.
export const oneSide = "kP_2Xcz kS_Ms6K k0/1.3.4*_ k2*_"
export const hovered = "kP_2Xcz kS_Ms6K k0-KFHz_ k1-KFHz_ k2-KFHz_ k3-KFHz_ k4-KFHz_"

export function Card({ wide }: { wide: boolean }) {
  return <div {...__k.sx(["kP_2Xcz kS_Ms6K", (wide) ? "k0*_ k1*_ k2*_ k3*_ k4*_ kS*_ kP*_ kQ*_ kR*_ kT*_ kU*_ k0_wwfA" : ""], [], [])} />
}
