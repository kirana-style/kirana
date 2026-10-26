import { css } from "@kirana-style/core"
import { type Keys, hue, tint } from "./types"
import { palette, tone, tones } from "./value-a"

const name: Keys = "box"

export const box = css({ color: tone, borderColor: tones[0], outlineColor: palette.accent })
export const plain = css({ color: hue, backgroundColor: tint })
export const label = name
