import { css, keyframes } from "@kirana-style/core"
import { motion } from "./tokens"

export const spin = keyframes({ to: { transform: "rotate(360deg)" } })
export const pulse = keyframes({ "0%, 100%": { opacity: 1 }, "50%": { opacity: motion.fade, padding: "1px" } })
export const animated = css({ animationName: spin, animation: `${pulse} 1s infinite` })
export const invalid = keyframes("spin")
export const badFrame = keyframes({ to: "x" })
export const badDeclaration = keyframes({ to: { colour: "red" } })
export function Dynamic({ value }: { value: string }) {
  return keyframes({ to: { opacity: value } })
}
