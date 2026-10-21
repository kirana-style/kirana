// `sx` on Vue elements, through the augmentation `@kirana-style/core/vue` adds.
/// <reference types="@kirana-style/core/vue" />
import { css } from "@kirana-style/core"
import type { HTMLAttributes, SVGAttributes } from "vue"

const row = css({ display: "flex", gap: "0.5rem" })

export const div: HTMLAttributes = { sx: [row, false] }
export const svg: SVGAttributes = { sx: row }
// @ts-expect-error -- a number is not a style.
export const wrong: HTMLAttributes = { sx: 42 }
