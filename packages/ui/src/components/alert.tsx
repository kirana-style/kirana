import { css } from "@kirana-style/core"

import type { Sx } from "../lib/sx"
import { mergeSx } from "../lib/sx"
import type { IconProps } from "../primitives/icon"
import { Icon } from "../primitives/icon"
import type { VariantProps } from "../recipes/recipe"
import { recipe } from "../recipes/recipe"
import { ctx } from "../theme/context"
import { alertMarker } from "../theme/markers"
import { alpha, radius, theme } from "../theme/semantic"
import { breakpoint } from "../tokens/breakpoints"
import { spacing } from "../tokens/spacing"
import { fontSize, fontWeight, lineHeight } from "../tokens/typography"

/** An alert carrying an action reserves room for it on the trailing edge. */
/** An alert with a leading icon becomes two columns. */

const styles = {
  base: css({
    position: "relative",
    display: "grid",
    width: "100%",
    gap: spacing["0.5"],
    borderRadius: radius.lg,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: theme.border,
    paddingInline: spacing["2.5"],
    paddingInlineEnd: {
      base: spacing["2.5"],
      ':has([data-slot="alert-action"])': "4.5rem",
    },
    paddingBlock: spacing[2],
    textAlign: "start",
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    [ctx.iconSize]: "1rem",
    // Read by the link rule in globals.css.
    "--inline-link-hover": theme.foreground,

    gridTemplateColumns: {
      ':has([data-slot="alert-icon"])': "auto 1fr",
    },
    columnGap: {
      ':has([data-slot="alert-icon"])': spacing[2],
    },
  }),
  default: css({ backgroundColor: theme.card, color: theme.cardForeground }),
  destructive: css({ backgroundColor: theme.card, color: theme.destructive }),

  /**
   * The leading icon. Was `*:[svg]:row-span-2`, reaching into whatever svg
   * happened to be a direct child; now an explicit slot so the grid placement
   * and the `:has()` query above both have something real to match.
   */
  icon: css({
    gridRow: "span 2",
    translate: `0 ${spacing["0.5"]}`,
    color: "currentColor",
  }),

  title: css({
    fontWeight: fontWeight.medium,
    gridColumnStart: {
      [alertMarker.within(':has([data-slot="alert-icon"])')]: 2,
    },
  }),
  description: css({
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    // `text-balance` on small screens, `text-pretty` once there is room for it.
    textWrap: { base: "balance", [breakpoint.md]: "pretty" },
    // Was `*:data-[slot=alert-description]:text-destructive/90` on the variant.
    color: {
      base: theme.mutedForeground,
      [alertMarker.within('[data-variant="destructive"]')]: alpha.destructive90,
    },
    gridColumnStart: {
      [alertMarker.within(':has([data-slot="alert-icon"])')]: 2,
    },
  }),

  action: css({
    position: "absolute",
    insetInlineEnd: spacing[2],
    top: spacing[2],
  }),
}

const alert = recipe({
  base: styles.base,
  variants: {
    variant: { default: styles.default, destructive: styles.destructive },
  },
  defaults: { variant: "default" },
})

type El = Omit<React.ComponentProps<"div">, "className"> & { sx?: Sx }

function Alert({ sx, variant, ...props }: El & VariantProps<typeof alert>) {
  return (
    <div
      data-slot="alert"
      data-variant={variant}
      role="alert"
      {...props}
      sx={[alertMarker.anchor, ...alert({ variant }), sx]}
    />
  )
}

/**
 * The leading icon. Renders the svg itself, as a direct child of the alert, so
 * the alert can lay out around it: `<AlertIcon icon={AlertCircleIcon} />`.
 */
function AlertIcon({ sx, ...props }: IconProps) {
  return (
    <Icon data-slot="alert-icon" {...props} sx={mergeSx(styles.icon, sx)} />
  )
}

function AlertTitle({ sx, ...props }: El) {
  return <div data-slot="alert-title" {...props} sx={[styles.title, sx]} />
}

function AlertDescription({ sx, ...props }: El) {
  return (
    <div
      data-slot="alert-description"
      {...props}
      sx={[styles.description, sx]}
    />
  )
}

function AlertAction({ sx, ...props }: El) {
  return <div data-slot="alert-action" {...props} sx={[styles.action, sx]} />
}

export {
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  AlertAction,
  alert as alertVariants,
}
