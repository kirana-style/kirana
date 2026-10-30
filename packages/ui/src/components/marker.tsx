import { css, props as styleProps } from "@kirana-style/core"
import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"

import type { Sx } from "../lib/sx"
import type { VariantProps } from "../recipes/recipe"
import { recipe } from "../recipes/recipe"
import { ctx } from "../theme/context"
import { markerRowMarker } from "../theme/markers"
import { theme } from "../theme/semantic"
import { spacing } from "../tokens/spacing"
import { fontSize, lineHeight } from "../tokens/typography"

/**
 * A Marker is an annotation row — a label, optionally with rules running out to
 * either side of it. Links inside the content use the `Link` primitive, so the
 * row never reaches into markup a caller writes.
 */

const styles = {
  base: css({
    position: "relative",
    display: "flex",
    minHeight: spacing[4],
    width: "100%",
    alignItems: "center",
    gap: spacing[2],
    textAlign: "left",
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    color: theme.mutedForeground,
    [ctx.iconSize]: "1rem",
  }),
  default: css({}),
  /** Rules on both sides, so the label reads as a divider with text in it. */
  separator: css({
    "::before": {
      content: "''",
      marginInlineEnd: spacing[1],
      height: "1px",
      minWidth: 0,
      flex: 1,
      backgroundColor: theme.border,
    },
    "::after": {
      content: "''",
      marginInlineStart: spacing[1],
      height: "1px",
      minWidth: 0,
      flex: 1,
      backgroundColor: theme.border,
    },
  }),
  border: css({
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: theme.border,
    paddingBottom: spacing[2],
  }),

  icon: css({
    width: spacing[4],
    height: spacing[4],
    flexShrink: 0,
    [ctx.iconSize]: "1rem",
  }),
  content: css({
    minWidth: 0,
    overflowWrap: "break-word",
    flex: {
      [markerRowMarker.within('[data-variant="separator"]')]: "none",
    },
    textAlign: {
      [markerRowMarker.within('[data-variant="separator"]')]: "center",
    },
  }),
}

const marker = recipe({
  base: styles.base,
  variants: {
    variant: {
      default: styles.default,
      separator: styles.separator,
      border: styles.border,
    },
  },
  defaults: { variant: "default" },
})

function Marker({
  sx,
  variant = "default",
  render,
  ...props
}: Omit<useRender.ComponentProps<"div">, "className"> &
  VariantProps<typeof marker> & { sx?: Sx }) {
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      styleProps(markerRowMarker.anchor, ...marker({ variant }), sx),
      props
    ),
    render,
    state: { slot: "marker", variant },
  })
}

type El<T extends keyof React.JSX.IntrinsicElements = "span"> = Omit<
  React.ComponentProps<T>,
  "className"
> & { sx?: Sx }

function MarkerIcon({ sx, ...props }: El) {
  return (
    <span
      data-slot="marker-icon"
      aria-hidden="true"
      {...props}
      sx={[styles.icon, sx]}
    />
  )
}

function MarkerContent({ sx, ...props }: El) {
  return (
    <span data-slot="marker-content" {...props} sx={[styles.content, sx]} />
  )
}

export { Marker, MarkerIcon, MarkerContent, marker as markerVariants }
