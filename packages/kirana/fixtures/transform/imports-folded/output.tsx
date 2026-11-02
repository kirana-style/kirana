import { runtime as __kirana_runtime } from "@kirana-style/core/internal";
const __k = /* @__PURE__ */ __kirana_runtime("k", "className");
import "./base"
import type { Face } from "./pure"




import { effectColor } from "./effect"
import { klassColor } from "./klass"
import { defaultColor } from "./klassDefault"
import { calledColor } from "./called"
import { newedColor } from "./newed"
import { spreadColor } from "./spread"
import { sideColor } from "./sideEffect"
import { plainColor } from "./fromPlain"
import { nowhereColor } from "./fromNowhere"
import { againColor } from "./reexportEffect"
import { effectColor as starColor } from "./starEffect"
import { cycleColor } from "./cycleA"
import { base } from "./base"

import { reads } from "./pure"
import { uncleanColor } from "./unclean"
import { viaUnclean } from "./loadsUnclean"
import { glow } from "./glow"


// Folded away: the imports of `./pure`, `./namespace`, `./fnDefault` (the default import is never
// read) and `kit`, an installed package the application never compiles, go: compiling them adds
// nothing. `./glow` stays, as its compile declares its variables; so do `./unclean` and
// `./loadsUnclean`, as compiling them reports a diagnostic. The rest name modules that act when they
// load, and stay.
export const folded = "k0_HV2H kJ_ASX8 ka_zgUg k50_D9ur k44_LB88 kk_SiD8 k8b_49ob k4U_mjaJ k3B_u0lV k57_kEmz k9D_YxdK k5T_F2Xx k9j_D9ur k66_D9ur k7e_KDNf k1v_OVfB k1m_JXuo k5_Q6sa k9L_mjaJ"

// Read at runtime: `./base` stays. Read in a style that a runtime call is handed, which compiles to
// its classes inside the call: `./branch` goes.
export function Box({ wide, choose }: { wide: number; choose: (style: unknown) => unknown }) {
  return <div {...__k.sx([/* @__PURE__ */ __k.b("kaF_ZFLY", "--kaF", (wide * base)), (choose("k50_wB7n"))], [], [])} />
}

// Read as a type: kept, for the type checker. Never read (`reads`): left as written.
export const shape: Face | undefined = undefined
