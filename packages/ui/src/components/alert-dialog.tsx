import { css, props as styleProps } from "@kirana-style/core"
import { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog"

import type { Sx } from "../lib/sx"
import { overlayStyles } from "../recipes/overlay"
import { Button } from "./button"
import { ctx } from "../theme/context"
import { alertDialogContentMarker } from "../theme/markers"
import { alpha, radius, theme } from "../theme/semantic"
import { blur } from "../tokens/blur"
import { breakpoint } from "../tokens/breakpoints"
import { spacing } from "../tokens/spacing"
import { fontSize, fontWeight, lineHeight } from "../tokens/typography"
import { zIndex } from "../tokens/z-index"

/**
 * The `default`-size dialog, read from the content element: a plain condition
 * string the compiler inlines into each relation read.
 */
const WIDE_DEFAULT = '[data-size="default"]'

const styles = {
  overlay: css({
    position: "fixed",
    inset: 0,
    isolation: "isolate",
    zIndex: zIndex.overlay,
    backgroundColor: "rgb(0 0 0 / 0.1)",
    backdropFilter: {
      "@supports (backdrop-filter: blur(1px))": `blur(${blur.xs})`,
    },
  }),
  content: css({
    position: "fixed",
    left: "50%",
    top: "50%",
    zIndex: zIndex.popover,
    display: "grid",
    width: "100%",
    translate: "-50% -50%",
    gap: spacing[4],
    borderRadius: radius.xl,
    backgroundColor: theme.popover,
    padding: spacing[4],
    color: theme.popoverForeground,
    boxShadow: `0 0 0 1px ${alpha.foreground10}`,
    outlineStyle: "none",
    maxWidth: {
      base: "20rem",
      [breakpoint.sm]: { base: "20rem", '[data-size="default"]': "24rem" },
    },
  }),

  /**
   * Centred by default, which is how a compact confirmation reads best.
   *
   * The `default` size relaxes into a left-aligned layout once there is width for
   * it. Every condition for a given property is declared together: styles merge
   * per property, so splitting these across two namespaces would let the second
   * one drop the centring along with the conditions it meant to add.
   */
  header: css({
    display: "grid",
    gap: spacing["1.5"],
    gridTemplateRows: {
      base: "auto 1fr",
      ':has([data-slot="alert-dialog-media"])': {
        base: "auto auto 1fr",
        [alertDialogContentMarker.within(WIDE_DEFAULT)]: {
          base: "auto auto 1fr",
          [breakpoint.sm]: "auto 1fr",
        },
      },
    },
    columnGap: {
      ':has([data-slot="alert-dialog-media"])': spacing[4],
    },
    placeItems: {
      base: "center",
      [alertDialogContentMarker.within(WIDE_DEFAULT)]: {
        base: "center",
        [breakpoint.sm]: "start",
      },
    },
    textAlign: {
      base: "center",
      [alertDialogContentMarker.within(WIDE_DEFAULT)]: {
        base: "center",
        [breakpoint.sm]: "start",
      },
    },
  }),

  footer: css({
    marginInline: `calc(${spacing[4]} * -1)`,
    marginBottom: `calc(${spacing[4]} * -1)`,
    display: {
      base: "flex",
      [alertDialogContentMarker.within('[data-size="sm"]')]: "grid",
    },
    gridTemplateColumns: {
      [alertDialogContentMarker.within('[data-size="sm"]')]:
        "repeat(2, minmax(0, 1fr))",
    },
    flexDirection: { base: "column-reverse", [breakpoint.sm]: "row" },
    justifyContent: { [breakpoint.sm]: "flex-end" },
    gap: spacing[2],
    borderEndStartRadius: radius.xl,
    borderEndEndRadius: radius.xl,
    borderTopWidth: "1px",
    borderTopStyle: "solid",
    borderTopColor: theme.border,
    backgroundColor: alpha.muted50,
    padding: spacing[4],
  }),

  media: css({
    marginBottom: spacing[2],
    display: "inline-flex",
    width: spacing[10],
    height: spacing[10],
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    backgroundColor: theme.muted,
    [ctx.iconSize]: "1.5rem",
    gridRow: {
      [breakpoint.sm]: {
        [alertDialogContentMarker.within('[data-size="default"]')]: "span 2",
      },
    },
  }),

  title: css({
    fontSize: fontSize.base,
    lineHeight: lineHeight.base,
    fontWeight: fontWeight.semibold,
  }),
  description: css({
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    textWrap: { base: "balance", [breakpoint.md]: "pretty" },
    color: theme.mutedForeground,
  }),
}

function AlertDialog({ ...props }: AlertDialogPrimitive.Root.Props) {
  return <AlertDialogPrimitive.Root data-slot="alert-dialog" {...props} />
}

function AlertDialogTrigger({ ...props }: AlertDialogPrimitive.Trigger.Props) {
  return (
    <AlertDialogPrimitive.Trigger data-slot="alert-dialog-trigger" {...props} />
  )
}

function AlertDialogPortal({ ...props }: AlertDialogPrimitive.Portal.Props) {
  return (
    <AlertDialogPrimitive.Portal data-slot="alert-dialog-portal" {...props} />
  )
}

function AlertDialogOverlay({
  sx,
  ...props
}: Omit<AlertDialogPrimitive.Backdrop.Props, "className"> & { sx?: Sx }) {
  return (
    <AlertDialogPrimitive.Backdrop
      data-slot="alert-dialog-overlay"
      {...props}
      {...styleProps(overlayStyles.backdrop, styles.overlay, sx)}
    />
  )
}

function AlertDialogContent({
  sx,
  size = "default",
  ...props
}: Omit<AlertDialogPrimitive.Popup.Props, "className"> & {
  size?: "default" | "sm"
  sx?: Sx
}) {
  return (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <AlertDialogPrimitive.Popup
        data-slot="alert-dialog-content"
        data-size={size}
        {...props}
        {...styleProps(
          alertDialogContentMarker.anchor,
          overlayStyles.modal,
          styles.content,
          sx
        )}
      />
    </AlertDialogPortal>
  )
}

type El = Omit<React.ComponentProps<"div">, "className"> & { sx?: Sx }

function AlertDialogHeader({ sx, ...props }: El) {
  return (
    <div data-slot="alert-dialog-header" {...props} sx={[styles.header, sx]} />
  )
}

function AlertDialogFooter({ sx, ...props }: El) {
  return (
    <div data-slot="alert-dialog-footer" {...props} sx={[styles.footer, sx]} />
  )
}

function AlertDialogMedia({ sx, ...props }: El) {
  return (
    <div data-slot="alert-dialog-media" {...props} sx={[styles.media, sx]} />
  )
}

function AlertDialogTitle({
  sx,
  ...props
}: Omit<
  React.ComponentProps<typeof AlertDialogPrimitive.Title>,
  "className"
> & { sx?: Sx }) {
  return (
    <AlertDialogPrimitive.Title
      data-slot="alert-dialog-title"
      {...props}
      {...styleProps(styles.title, sx)}
    />
  )
}

function AlertDialogDescription({
  sx,
  ...props
}: Omit<
  React.ComponentProps<typeof AlertDialogPrimitive.Description>,
  "className"
> & { sx?: Sx }) {
  return (
    <AlertDialogPrimitive.Description
      data-slot="alert-dialog-description"
      {...props}
      {...styleProps(styles.description, sx)}
    />
  )
}

function AlertDialogAction({ ...props }: React.ComponentProps<typeof Button>) {
  return <Button data-slot="alert-dialog-action" {...props} />
}

function AlertDialogCancel({
  variant = "outline",
  size = "default",
  ...props
}: Omit<AlertDialogPrimitive.Close.Props, "className"> &
  Pick<React.ComponentProps<typeof Button>, "variant" | "size">) {
  return (
    <AlertDialogPrimitive.Close
      data-slot="alert-dialog-cancel"
      render={<Button variant={variant} size={size} />}
      {...props}
    />
  )
}

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
  AlertDialogTrigger,
}
