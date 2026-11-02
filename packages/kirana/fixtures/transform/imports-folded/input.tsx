import "./base"
import type { Face } from "./pure"
import { css } from "@kirana-style/core"
import fnDefault, { radius } from "./fnDefault"
import * as namespace from "./namespace"
import { space } from "./pure"
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
import { accent } from "./branch"
import { reads } from "./pure"
import { uncleanColor } from "./unclean"
import { viaUnclean } from "./loadsUnclean"
import { glow } from "./glow"
import { kitColor } from "kit"

// Folded away: the imports of `./pure`, `./namespace`, `./fnDefault` (the default import is never
// read) and `kit`, an installed package the application never compiles, go: compiling them adds
// nothing. `./glow` stays, as its compile declares its variables; so do `./unclean` and
// `./loadsUnclean`, as compiling them reports a diagnostic. The rest name modules that act when they
// load, and stay.
export const folded = css({
  padding: space.md,
  gap: namespace.gap,
  borderRadius: radius,
  color: effectColor,
  backgroundColor: klassColor,
  borderColor: defaultColor,
  outlineColor: calledColor,
  caretColor: newedColor,
  accentColor: spreadColor,
  columnRuleColor: sideColor,
  textDecorationColor: plainColor,
  fill: nowhereColor,
  stroke: againColor,
  floodColor: starColor,
  lightingColor: cycleColor,
  borderBlockColor: uncleanColor,
  borderInlineColor: viaUnclean,
  margin: glow.soft,
  textEmphasisColor: kitColor,
})

// Read at runtime: `./base` stays. Read in a style that a runtime call is handed, which compiles to
// its classes inside the call: `./branch` goes.
export function Box({ wide, choose }: { wide: number; choose: (style: unknown) => unknown }) {
  return <div sx={[css({ width: wide * base }), choose(css({ color: accent }))]} />
}

// Read as a type: kept, for the type checker. Never read (`reads`): left as written.
export const shape: Face | undefined = undefined
