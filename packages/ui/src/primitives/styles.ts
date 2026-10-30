/**
 * The finite prop vocabulary the primitives index into, every entry compiled
 * ahead of time. Colour props are restricted to the semantic palette, so no
 * component can reach for a raw `red500` background and break dark mode.
 */

import { css } from "@kirana-style/core"

import { spacing } from "../tokens/spacing"
import { fontSize, fontWeight, leading, lineHeight } from "../tokens/typography"
import { radius, theme } from "../theme/semantic"

const SPACE = [
  "0",
  "px",
  "0.5",
  "1",
  "1.5",
  "2",
  "2.5",
  "3",
  "3.5",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11",
  "12",
  "14",
  "16",
  "20",
  "24",
  "28",
  "32",
  "36",
  "40",
  "44",
  "48",
  "52",
  "56",
  "60",
  "64",
  "72",
  "80",
  "96",
] as const

export type Space = (typeof SPACE)[number]

export const padding = {
  "0": css({ padding: spacing[0] }),
  px: css({ padding: spacing.px }),
  "0.5": css({ padding: spacing["0.5"] }),
  "1": css({ padding: spacing[1] }),
  "1.5": css({ padding: spacing["1.5"] }),
  "2": css({ padding: spacing[2] }),
  "2.5": css({ padding: spacing["2.5"] }),
  "3": css({ padding: spacing[3] }),
  "3.5": css({ padding: spacing["3.5"] }),
  "4": css({ padding: spacing[4] }),
  "5": css({ padding: spacing[5] }),
  "6": css({ padding: spacing[6] }),
  "7": css({ padding: spacing[7] }),
  "8": css({ padding: spacing[8] }),
  "9": css({ padding: spacing[9] }),
  "10": css({ padding: spacing[10] }),
  "11": css({ padding: spacing[11] }),
  "12": css({ padding: spacing[12] }),
  "14": css({ padding: spacing[14] }),
  "16": css({ padding: spacing[16] }),
  "20": css({ padding: spacing[20] }),
  "24": css({ padding: spacing[24] }),
}

export const paddingInline = {
  "0": css({ paddingInline: spacing[0] }),
  px: css({ paddingInline: spacing.px }),
  "0.5": css({ paddingInline: spacing["0.5"] }),
  "1": css({ paddingInline: spacing[1] }),
  "1.5": css({ paddingInline: spacing["1.5"] }),
  "2": css({ paddingInline: spacing[2] }),
  "2.5": css({ paddingInline: spacing["2.5"] }),
  "3": css({ paddingInline: spacing[3] }),
  "3.5": css({ paddingInline: spacing["3.5"] }),
  "4": css({ paddingInline: spacing[4] }),
  "5": css({ paddingInline: spacing[5] }),
  "6": css({ paddingInline: spacing[6] }),
  "8": css({ paddingInline: spacing[8] }),
  "10": css({ paddingInline: spacing[10] }),
  "12": css({ paddingInline: spacing[12] }),
  "16": css({ paddingInline: spacing[16] }),
}

export const paddingBlock = {
  "0": css({ paddingBlock: spacing[0] }),
  px: css({ paddingBlock: spacing.px }),
  "0.5": css({ paddingBlock: spacing["0.5"] }),
  "1": css({ paddingBlock: spacing[1] }),
  "1.5": css({ paddingBlock: spacing["1.5"] }),
  "2": css({ paddingBlock: spacing[2] }),
  "2.5": css({ paddingBlock: spacing["2.5"] }),
  "3": css({ paddingBlock: spacing[3] }),
  "3.5": css({ paddingBlock: spacing["3.5"] }),
  "4": css({ paddingBlock: spacing[4] }),
  "5": css({ paddingBlock: spacing[5] }),
  "6": css({ paddingBlock: spacing[6] }),
  "8": css({ paddingBlock: spacing[8] }),
  "10": css({ paddingBlock: spacing[10] }),
  "12": css({ paddingBlock: spacing[12] }),
  "16": css({ paddingBlock: spacing[16] }),
}

export const gap = {
  "0": css({ gap: spacing[0] }),
  px: css({ gap: spacing.px }),
  "0.5": css({ gap: spacing["0.5"] }),
  "1": css({ gap: spacing[1] }),
  "1.5": css({ gap: spacing["1.5"] }),
  "2": css({ gap: spacing[2] }),
  "2.5": css({ gap: spacing["2.5"] }),
  "3": css({ gap: spacing[3] }),
  "3.5": css({ gap: spacing["3.5"] }),
  "4": css({ gap: spacing[4] }),
  "5": css({ gap: spacing[5] }),
  "6": css({ gap: spacing[6] }),
  "8": css({ gap: spacing[8] }),
  "10": css({ gap: spacing[10] }),
  "12": css({ gap: spacing[12] }),
  "16": css({ gap: spacing[16] }),
}

export const bg = {
  transparent: css({ backgroundColor: "transparent" }),
  background: css({ backgroundColor: theme.background }),
  foreground: css({ backgroundColor: theme.foreground }),
  card: css({ backgroundColor: theme.card }),
  popover: css({ backgroundColor: theme.popover }),
  primary: css({ backgroundColor: theme.primary }),
  secondary: css({ backgroundColor: theme.secondary }),
  muted: css({ backgroundColor: theme.muted }),
  accent: css({ backgroundColor: theme.accent }),
  destructive: css({ backgroundColor: theme.destructive }),
  sidebar: css({ backgroundColor: theme.sidebar }),
}

export const fg = {
  inherit: css({ color: "inherit" }),
  foreground: css({ color: theme.foreground }),
  background: css({ color: theme.background }),
  cardForeground: css({ color: theme.cardForeground }),
  popoverForeground: css({ color: theme.popoverForeground }),
  primary: css({ color: theme.primary }),
  primaryForeground: css({ color: theme.primaryForeground }),
  secondaryForeground: css({ color: theme.secondaryForeground }),
  mutedForeground: css({ color: theme.mutedForeground }),
  accentForeground: css({ color: theme.accentForeground }),
  destructive: css({ color: theme.destructive }),
  sidebarForeground: css({ color: theme.sidebarForeground }),
}

export const rounded = {
  none: css({ borderRadius: 0 }),
  sm: css({ borderRadius: radius.sm }),
  md: css({ borderRadius: radius.md }),
  lg: css({ borderRadius: radius.lg }),
  xl: css({ borderRadius: radius.xl }),
  "2xl": css({ borderRadius: radius["2xl"] }),
  "3xl": css({ borderRadius: radius["3xl"] }),
  full: css({ borderRadius: radius.full }),
}

export const size = {
  xs: css({ fontSize: fontSize.xs, lineHeight: lineHeight.xs }),
  sm: css({ fontSize: fontSize.sm, lineHeight: lineHeight.sm }),
  base: css({ fontSize: fontSize.base, lineHeight: lineHeight.base }),
  lg: css({ fontSize: fontSize.lg, lineHeight: lineHeight.lg }),
  xl: css({ fontSize: fontSize.xl, lineHeight: lineHeight.xl }),
  "2xl": css({ fontSize: fontSize["2xl"], lineHeight: lineHeight["2xl"] }),
  "3xl": css({ fontSize: fontSize["3xl"], lineHeight: lineHeight["3xl"] }),
  "4xl": css({ fontSize: fontSize["4xl"], lineHeight: lineHeight["4xl"] }),
}

export const weight = {
  light: css({ fontWeight: fontWeight.light }),
  normal: css({ fontWeight: fontWeight.normal }),
  medium: css({ fontWeight: fontWeight.medium }),
  semibold: css({ fontWeight: fontWeight.semibold }),
  bold: css({ fontWeight: fontWeight.bold }),
}

export const lead = {
  tight: css({ lineHeight: leading.tight }),
  snug: css({ lineHeight: leading.snug }),
  normal: css({ lineHeight: leading.normal }),
  relaxed: css({ lineHeight: leading.relaxed }),
}

export const align = {
  start: css({ alignItems: "flex-start" }),
  center: css({ alignItems: "center" }),
  end: css({ alignItems: "flex-end" }),
  stretch: css({ alignItems: "stretch" }),
  baseline: css({ alignItems: "baseline" }),
}

export const justify = {
  start: css({ justifyContent: "flex-start" }),
  center: css({ justifyContent: "center" }),
  end: css({ justifyContent: "flex-end" }),
  between: css({ justifyContent: "space-between" }),
  around: css({ justifyContent: "space-around" }),
}

export const wrap = {
  wrap: css({ flexWrap: "wrap" }),
  nowrap: css({ flexWrap: "nowrap" }),
  reverse: css({ flexWrap: "wrap-reverse" }),
}

export const direction = {
  row: css({ flexDirection: "row" }),
  column: css({ flexDirection: "column" }),
  rowReverse: css({ flexDirection: "row-reverse" }),
  columnReverse: css({ flexDirection: "column-reverse" }),
}

export const columns = {
  "1": css({ gridTemplateColumns: "repeat(1, minmax(0, 1fr))" }),
  "2": css({ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }),
  "3": css({ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }),
  "4": css({ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }),
  "5": css({ gridTemplateColumns: "repeat(5, minmax(0, 1fr))" }),
  "6": css({ gridTemplateColumns: "repeat(6, minmax(0, 1fr))" }),
  "8": css({ gridTemplateColumns: "repeat(8, minmax(0, 1fr))" }),
  "12": css({ gridTemplateColumns: "repeat(12, minmax(0, 1fr))" }),
}
