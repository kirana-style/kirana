import { css, defineTokens, keyframes } from "@kirana-style/core"
import { fade, plain } from "./tokens"

// A registered token animates through keyframes that assign it.
const grow = keyframes({ from: { [fade.size]: "0px" }, to: { [fade.size]: "2rem" } })
export const masked = css({
  animationName: grow,
  maskImage: `linear-gradient(#000 calc(100% - ${fade.size}), transparent)`,
  rotate: fade.angle,
})
// A token that is not a variable cannot be a keyframe key.
export const invalid = keyframes({ to: { [plain.gap]: "2rem" } })

// Rejected: not a syntax string, a syntax that breaks out of its string, and modes.
export const rejected = defineTokens("rejected", {
  badSyntax: { value: "0px", syntax: 4 },
  quoted: { value: "0px", syntax: '<length>"' },
  modes: { light: "0px", dark: "1px", syntax: "<length>" },
})

// The universal syntax may start unset: references fall back to nothing, as Tailwind's filters do.
export const layer = defineTokens("layer", {
  blur: { syntax: "*", inherits: false },
  grey: { syntax: "*", inherits: false },
  noValue: { syntax: "<length>" },
})
export const filtered = css({
  [layer.grey]: "grayscale(100%)",
  filter: `${layer.blur} ${layer.grey}`,
})
