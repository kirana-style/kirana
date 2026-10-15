import { css, props as styleProps } from "@kirana-style/core"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { Cancel01Icon } from "@hugeicons/core-free-icons"

import type { Sx } from "../lib/sx"
import { overlayStyles } from "../recipes/overlay"
import { Button } from "./button"
import { Icon } from "../primitives/icon"
import { VisuallyHidden } from "../primitives/visually-hidden"
import { dialogContentMarker } from "../theme/markers"
import { alpha, radius, theme } from "../theme/semantic"
import { blur } from "../tokens/blur"
import { breakpoint } from "../tokens/breakpoints"
import { spacing } from "../tokens/spacing"
import { fontSize, fontWeight, lineHeight } from "../tokens/typography"
import { zIndex } from "../tokens/z-index"

const styles = {
  overlay: css({
    position: "fixed",
    inset: 0,
    isolation: "isolate",
    zIndex: zIndex.overlay,
    backgroundColor: "rgb(0 0 0 / 0.1)",
    // Only blurs where the browser can do it cheaply. Conditions nest inside
    // the property they apply to.
    backdropFilter: {
      "@supports (backdrop-filter: blur(1px))": `blur(${blur.xs})`,
    },
  }),
  content: css({
    position: "fixed",
    insetInlineStart: "50%",
    top: "50%",
    zIndex: zIndex.popover,
    display: "grid",
    width: "100%",
    maxWidth: { base: "calc(100% - 2rem)", [breakpoint.sm]: "24rem" },
    // `translate` follows writing direction, so this one value replaces the
    // original's `-translate-x-1/2` plus its `rtl:translate-x-1/2` override.
    translate: "-50% -50%",
    gap: spacing[4],
    borderRadius: radius.xl,
    backgroundColor: theme.popover,
    padding: spacing[4],
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    color: theme.popoverForeground,
    boxShadow: `0 0 0 1px ${alpha.foreground10}`,
    outlineStyle: "none",
  }),
  close: css({
    position: "absolute",
    insetInlineEnd: spacing[2],
    top: spacing[2],
  }),
  header: css({ display: "flex", flexDirection: "column", gap: spacing[2] }),
  footer: css({
    marginInline: `calc(${spacing[4]} * -1)`,
    marginBottom: `calc(${spacing[4]} * -1)`,
    display: "flex",
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
  title: css({
    fontSize: fontSize.base,
    lineHeight: 1,
    fontWeight: fontWeight.semibold,
  }),
  description: css({ fontSize: fontSize.sm, color: theme.mutedForeground }),
}

function Dialog({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  sx,
  ...props
}: Omit<DialogPrimitive.Backdrop.Props, "className"> & { sx?: Sx }) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      {...props}
      {...styleProps(overlayStyles.backdrop, styles.overlay, sx)}
    />
  )
}

function DialogContent({
  sx,
  children,
  showCloseButton = true,
  ...props
}: Omit<DialogPrimitive.Popup.Props, "className"> & {
  showCloseButton?: boolean
  sx?: Sx
}) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        {...props}
        {...styleProps(
          dialogContentMarker.anchor,
          overlayStyles.modal,
          styles.content,
          sx
        )}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            render={<Button variant="ghost" size="icon-sm" sx={styles.close} />}
          >
            <Icon icon={Cancel01Icon} strokeWidth={2} />
            <VisuallyHidden>Close</VisuallyHidden>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </DialogPortal>
  )
}

type El = Omit<React.ComponentProps<"div">, "className"> & { sx?: Sx }

function DialogHeader({ sx, ...props }: El) {
  return <div data-slot="dialog-header" {...props} sx={[styles.header, sx]} />
}

function DialogFooter({
  sx,
  showCloseButton = false,
  children,
  ...props
}: El & { showCloseButton?: boolean }) {
  return (
    <div data-slot="dialog-footer" {...props} sx={[styles.footer, sx]}>
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close render={<Button variant="outline" />}>
          Close
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({
  sx,
  ...props
}: Omit<DialogPrimitive.Title.Props, "className"> & { sx?: Sx }) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      {...props}
      {...styleProps(styles.title, sx)}
    />
  )
}

function DialogDescription({
  sx,
  ...props
}: Omit<DialogPrimitive.Description.Props, "className"> & { sx?: Sx }) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      {...props}
      {...styleProps(styles.description, sx)}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
