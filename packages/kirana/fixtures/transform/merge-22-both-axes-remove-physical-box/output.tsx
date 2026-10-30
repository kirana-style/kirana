

// A component pads its box per breakpoint, and a caller clears both axes: together they hold the
// box's four sides, so the component's `padding` goes too and cannot outrank the caller at a wider
// screen (KF-076).
const empty = "k0_MKOQ k0-0w85_n6h8"
const over = "k0*_ k2*_ k3*_ k4*_ k1*_ kS*_ kT*_ kU*_ kS_n4P8 kP*_ kQ*_ kR*_ kP_n4P8"

export const A = () => <div className="kS_n4P8 kP_n4P8" />

// The four logical sides one by one, other boxes, and `null` for `"*": null`.
export const sides = "k4j/s.n*_ k4w/t.o*_ k4x/r.m*_ k4C/q.l*_ k4f/q.r.s.t.l.m.n.o*_ kf*_ ku*_ k5*_ k7*_ k8*_ k9*_ k6*_ kx*_ ky*_ kv*_ kw*_ kaF*_ k6V*_ kj*_ kh*_ kg*_ ki*_ kV/X*_ kW*_ kV/W*_ kX*_ kY/10*_ kZ*_ kY/Z*_ k10*_ k14*_ k15*_ k16*_ k11*_ k12*_ k13*_ k4h/1A.1x*_ k4i/1z.1w*_ k4g/1z.1A.1w.1x*_ k1s*_ k1t*_ k1u*_ k4u/1r.1o*_ k4v/1q.1n*_ k4t/1q.1r.1n.1o*_ k1j*_ k1k*_ k1l*_ k75*_ k4e*_ k4e_5QUl"

// The physical sides one by one take the logical ones likewise.
export const physical = "kS*_ kP*_ kQ*_ kR*_ kT*_ kU*_ k0/1.2.3*_ k4*_ k0/1.2.4*_ k3*_ k0/2.3.4*_ k1*_ k0/1.3.4*_ k2*_ k2_oD60"

// One axis alone, or both under a condition, keeps to what it names: which physical sides an axis
// is depends on the writing mode.
export const oneAxis = "k0_MKOQ k0-0w85_n6h8 kS*_ kT*_ kU*_ kS_n4P8"
export const hovered = "k0_MKOQ k0-0w85_n6h8 kS-KFHz_ kT-KFHz_ kU-KFHz_ kP-KFHz_ kQ-KFHz_ kR-KFHz_"
