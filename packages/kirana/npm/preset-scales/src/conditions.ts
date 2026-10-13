/**
 * Breakpoint and container conditions matching Tailwind CSS v4's `sm`–`2xl` and `@3xs`–`@7xl`
 * variants, as Kirana condition values for computed keys:
 *
 *   css({ display: { base: "none", [breakpoint.md]: "block" } })
 */
import { container, media } from "@kirana-style/core"

export const breakpoint = {
  sm: media("(width >= 40rem)"),
  md: media("(width >= 48rem)"),
  lg: media("(width >= 64rem)"),
  xl: media("(width >= 80rem)"),
  "2xl": media("(width >= 96rem)"),
} as const

export const containerQuery = {
  "3xs": container("(width >= 16rem)"),
  "2xs": container("(width >= 18rem)"),
  xs: container("(width >= 20rem)"),
  sm: container("(width >= 24rem)"),
  md: container("(width >= 28rem)"),
  lg: container("(width >= 32rem)"),
  xl: container("(width >= 36rem)"),
  "2xl": container("(width >= 42rem)"),
  "3xl": container("(width >= 48rem)"),
  "4xl": container("(width >= 56rem)"),
  "5xl": container("(width >= 64rem)"),
  "6xl": container("(width >= 72rem)"),
  "7xl": container("(width >= 80rem)"),
} as const
