import { keyframes } from "@kirana-style/core"
export const spreadColor = "olive"
const frames = [{ from: { opacity: 0 }, to: { opacity: 1 } }] as const
export const fade = keyframes(...frames)
