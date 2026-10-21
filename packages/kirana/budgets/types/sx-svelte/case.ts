// `sx` on Svelte elements, through the augmentation `@kirana-style/core/svelte` adds.
/// <reference types="@kirana-style/core/svelte" />
import { css } from "@kirana-style/core"
import type { HTMLAttributes, SVGAttributes } from "svelte/elements"

const row = css({ display: "flex", gap: "0.5rem" })

export const div: HTMLAttributes<HTMLDivElement> = { sx: [row, false] }
export const svg: SVGAttributes<SVGSVGElement> = { sx: row }
// @ts-expect-error -- a number is not a style.
export const wrong: HTMLAttributes<HTMLDivElement> = { sx: 42 }
