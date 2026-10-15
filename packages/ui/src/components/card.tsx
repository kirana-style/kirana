import { css } from "@kirana-style/core"

import type { Sx } from "../lib/sx"
import { ctx } from "../theme/context"
import { cardMarker } from "../theme/markers"
import { alpha, radius, theme } from "../theme/semantic"
import { containerName } from "../tokens/container"
import { spacing } from "../tokens/spacing"
import { fontSize, fontWeight, leading, lineHeight } from "../tokens/typography"

/** A footer sits flush to the bottom edge, so the card drops its own bottom pad. */

const styles = {
  root: css({
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    borderRadius: radius.xl,
    backgroundColor: theme.card,
    color: theme.cardForeground,
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    boxShadow: `0 0 0 1px ${alpha.foreground10}`,

    gap: ctx.cardSpacing,
    paddingBottom: {
      base: ctx.cardSpacing,
      ':has([data-slot="card-footer"])': 0,
    },
    // Was `has-[>img:first-child]:pt-0`: a card led by an image is edge to edge.
    paddingTop: { base: ctx.cardSpacing, ":has(> img:first-child)": 0 },
  }),

  // The inner rhythm, handed down to every part of the card. Was the
  // `--card-spacing` custom property, now a typed contextual variable.
  //
  // Picked by the `size` prop rather than written as
  // `{ base: 4, '[data-size="sm"]': 3 }`, kept from the StyleX port, which
  // emitted a custom property's plain value outside the cascade layers. In
  // Kirana every rule is layered, so the conditional form would also work.
  sizeDefault: css({ [ctx.cardSpacing]: spacing[4] }),
  sizeSm: css({ [ctx.cardSpacing]: spacing[3] }),

  header: css({
    // `@container/card-header`: a size container, as in the original. Besides
    // naming the container, it keeps a long description from widening a card
    // that sizes to its content (`mx-auto max-w-md`).
    containerType: "inline-size",
    containerName: containerName.cardHeader,
    display: "grid",
    gridAutoRows: "min-content",
    alignItems: "start",
    gap: spacing[1],
    borderStartStartRadius: radius.xl,
    borderStartEndRadius: radius.xl,
    paddingInline: ctx.cardSpacing,
    gridTemplateColumns: {
      ':has([data-slot="card-action"])': "1fr auto",
    },
    gridTemplateRows: {
      ':has([data-slot="card-description"])': "auto auto",
    },
  }),
  /**
   * Was `[.border-b]:pb-(--card-spacing)`, which fired when a caller happened to
   * add a `border-b` class. Class names are hashed now, so the intent became an
   * explicit prop.
   */
  headerBordered: css({
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: theme.border,
    paddingBottom: ctx.cardSpacing,
  }),

  title: css({
    fontSize: {
      base: fontSize.base,
      [cardMarker.within('[data-size="sm"]')]: fontSize.sm,
    },
    lineHeight: leading.snug,
    fontWeight: fontWeight.semibold,
  }),
  description: css({ fontSize: fontSize.sm, color: theme.mutedForeground }),
  action: css({
    gridColumnStart: 2,
    // `row-span-2 row-start-1`: longhands, because `gridRow: "span 2"` leaves
    // the end at `auto` once the start is set, and the action spans one row.
    gridRowStart: 1,
    gridRowEnd: "span 2",
    alignSelf: "start",
    justifySelf: "end",
  }),
  content: css({ paddingInline: ctx.cardSpacing }),
  footer: css({
    display: "flex",
    alignItems: "center",
    borderEndStartRadius: radius.xl,
    borderEndEndRadius: radius.xl,
    borderTopWidth: "1px",
    borderTopStyle: "solid",
    borderTopColor: theme.border,
    backgroundColor: alpha.muted50,
    padding: ctx.cardSpacing,
  }),
  /**
   * Was `*:[img:first-child]:rounded-t-xl`, styling whichever image happened to
   * be first. An image that should follow the card's corners uses this instead.
   */
  image: css({
    width: "100%",
    borderStartStartRadius: { ":first-child": radius.xl },
    borderStartEndRadius: { ":first-child": radius.xl },
    borderEndStartRadius: { ":last-child": radius.xl },
    borderEndEndRadius: { ":last-child": radius.xl },
  }),
}

type El<T extends keyof React.JSX.IntrinsicElements = "div"> = Omit<
  React.ComponentProps<T>,
  "className"
> & { sx?: Sx }

function Card({
  sx,
  size = "default",
  ...props
}: El & { size?: "default" | "sm" }) {
  return (
    <div
      data-slot="card"
      data-size={size}
      {...props}
      sx={[
        cardMarker.anchor,
        styles.root,
        size === "sm" ? styles.sizeSm : styles.sizeDefault,
        sx,
      ]}
    />
  )
}

function CardHeader({
  sx,
  bordered,
  ...props
}: El & {
  /** Draws a divider beneath the header and pads it away from the content. */
  bordered?: boolean
}) {
  return (
    <div
      data-slot="card-header"
      {...props}
      sx={[styles.header, bordered && styles.headerBordered, sx]}
    />
  )
}

function CardTitle({ sx, ...props }: El) {
  return <div data-slot="card-title" {...props} sx={[styles.title, sx]} />
}

function CardDescription({ sx, ...props }: El) {
  return (
    <div
      data-slot="card-description"
      {...props}
      sx={[styles.description, sx]}
    />
  )
}

function CardAction({ sx, ...props }: El) {
  return <div data-slot="card-action" {...props} sx={[styles.action, sx]} />
}

function CardContent({ sx, ...props }: El) {
  return <div data-slot="card-content" {...props} sx={[styles.content, sx]} />
}

function CardFooter({ sx, ...props }: El) {
  return <div data-slot="card-footer" {...props} sx={[styles.footer, sx]} />
}

/** A full-bleed image that rounds whichever card edge it touches. */
function CardImage({ sx, ...props }: El<"img">) {
  return <img data-slot="card-image" {...props} sx={[styles.image, sx]} />
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
  CardImage,
}
