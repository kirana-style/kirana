import { css } from "@kirana-style/core"

import type { Sx } from "../lib/sx"
import { ctx } from "../theme/context"
import { peer, tooltipContentMarker } from "../theme/markers"
import { alpha, radius, theme } from "../theme/semantic"
import { spacing } from "../tokens/spacing"
import {
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
} from "../tokens/typography"

const styles = {
  root: css({
    pointerEvents: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing[1],
    height: spacing[5],
    width: "fit-content",
    minWidth: spacing[5],
    paddingInline: spacing[1],
    // Tucked into an InputGroup addon, which carries the default relation, the
    // key cap follows the group's inner radius.
    borderRadius: {
      base: radius.sm,
      [peer.within('[data-slot="input-group-addon"]')]:
        `calc(${radius.base} - 5px)`,
    },
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    lineHeight: lineHeight.xs,
    fontWeight: fontWeight.medium,
    userSelect: "none",
    [ctx.iconSize]: "0.75rem",

    // Inside a tooltip the colours invert, because the tooltip itself is inverted.
    backgroundColor: {
      base: theme.muted,
      [tooltipContentMarker.within("[data-slot]")]: alpha.background20,
    },
    color: {
      base: theme.mutedForeground,
      [tooltipContentMarker.within("[data-slot]")]: theme.background,
    },
  }),
  group: css({
    display: "inline-flex",
    alignItems: "center",
    gap: spacing[1],
  }),
}

function Kbd({
  sx,
  ...props
}: Omit<React.ComponentProps<"kbd">, "className"> & { sx?: Sx }) {
  return <kbd data-slot="kbd" {...props} sx={[styles.root, sx]} />
}

function KbdGroup({
  sx,
  ...props
}: Omit<React.ComponentProps<"kbd">, "className"> & { sx?: Sx }) {
  return <kbd data-slot="kbd-group" {...props} sx={[styles.group, sx]} />
}

export { Kbd, KbdGroup }
