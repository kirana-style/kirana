import { css } from "@kirana-style/core"
import * as tokens from "./tokens"
import defaultColour from "./tokens/colors"
import { quarter } from "./tokens/space"
import { cycleA } from "./cycle-a"
import { external } from "some-package"
import data from "./data.json"
import { Component } from "./component"

export const box = css({
  gap: tokens.space[2],
  color: tokens.red,
  backgroundColor: tokens.blue,
  transitionDuration: tokens.motion.fast,
  borderRadius: tokens.radius.lg,
  margin: quarter,
  content: `"${defaultColour}"`,
  width: cycleA,
  height: external,
  top: data,
})
export function helper() { return 1 }
export default css({ opacity: 0.5 })
export { Component }
