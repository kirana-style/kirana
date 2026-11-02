import { runtime as __kirana_runtime } from "@kirana-style/core/internal";
const __k = /* @__PURE__ */ __kirana_runtime("k", "className");


import { Card, Inset, Loose, Panel } from "./card"

// KF-083: one logical axis keeps to its logical sides, so Card's paddingTop and paddingBottom still
// win over this paddingBlock: reported here.
export const Cleared = () => <Card sx={"kS*_ kT*_ kU*_ kS_FV0c"} />
export const Set = () => <Panel sx={"kT_vqnf"} />
// The other way round: Inset's paddingInlineStart sets fewer longhands than this padding.
export const Reset = () => <Inset sx={"k0_wwfA"} />

// Not reported: the physical sides themselves, a logical axis Card writes logically too, a value only
// known at runtime, and a component whose own styles are only known at runtime.
export const Physical = () => <Card sx={"k4_oD60 k1_oD60"} />
export const Inline = () => <Card sx={"kP_FV0c"} />
export const Runtime = ({ size }: { size: string }) => <Card sx={/* @__PURE__ */ __k.cx(/* @__PURE__ */ __k.b("kS_lOT1", "--kS", (size)))} />
export const Unknown = ({ tone }: { tone: never }) => <Loose tone={tone} sx={"kS_FV0c"} />
export const Empty = () => <Card sx />
// The caller's own mixed sides are its own report, not Card's.
export const Own = () => <Card sx={"k4_eK8R kT_kbjD"} />
