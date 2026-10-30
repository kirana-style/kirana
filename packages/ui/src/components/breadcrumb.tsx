import { css, props as styleProps } from "@kirana-style/core"
import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import {
  ArrowRight01Icon,
  MoreHorizontalIcon,
} from "@hugeicons/core-free-icons"

import type { Sx } from "../lib/sx"
import { Icon } from "../primitives/icon"
import { VisuallyHidden } from "../primitives/visually-hidden"
import { ctx } from "../theme/context"
import { theme } from "../theme/semantic"
import { duration, easing } from "../tokens/motion"
import { spacing } from "../tokens/spacing"
import { fontSize, fontWeight, lineHeight } from "../tokens/typography"

const styles = {
  list: css({
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing["1.5"],
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    overflowWrap: "break-word",
    color: theme.mutedForeground,
  }),
  item: css({ display: "inline-flex", alignItems: "center", gap: spacing[1] }),
  link: css({
    color: { base: "inherit", ":hover": theme.foreground },
    transitionProperty: "color",
    transitionDuration: duration[150],
    transitionTimingFunction: easing.inOut,
  }),
  page: css({ fontWeight: fontWeight.normal, color: theme.foreground }),
  separator: css({ [ctx.iconSize]: "0.875rem" }),
  ellipsis: css({
    display: "flex",
    width: spacing[5],
    height: spacing[5],
    alignItems: "center",
    justifyContent: "center",
    [ctx.iconSize]: "1rem",
  }),
}

type El<T extends keyof React.JSX.IntrinsicElements> = Omit<
  React.ComponentProps<T>,
  "className"
> & { sx?: Sx }

function Breadcrumb({ sx, ...props }: El<"nav">) {
  return (
    <nav aria-label="breadcrumb" data-slot="breadcrumb" {...props} sx={sx} />
  )
}

function BreadcrumbList({ sx, ...props }: El<"ol">) {
  return <ol data-slot="breadcrumb-list" {...props} sx={[styles.list, sx]} />
}

function BreadcrumbItem({ sx, ...props }: El<"li">) {
  return <li data-slot="breadcrumb-item" {...props} sx={[styles.item, sx]} />
}

function BreadcrumbLink({
  sx,
  render,
  ...props
}: Omit<useRender.ComponentProps<"a">, "className"> & { sx?: Sx }) {
  return useRender({
    defaultTagName: "a",
    props: mergeProps<"a">(styleProps(styles.link, sx), props),
    render,
    state: { slot: "breadcrumb-link" },
  })
}

function BreadcrumbPage({ sx, ...props }: El<"span">) {
  return (
    <span
      data-slot="breadcrumb-page"
      role="link"
      aria-disabled="true"
      aria-current="page"
      {...props}
      sx={[styles.page, sx]}
    />
  )
}

function BreadcrumbSeparator({ children, sx, ...props }: El<"li">) {
  return (
    <li
      data-slot="breadcrumb-separator"
      role="presentation"
      aria-hidden="true"
      {...props}
      sx={[styles.separator, sx]}
    >
      {children ?? <Icon icon={ArrowRight01Icon} />}
    </li>
  )
}

function BreadcrumbEllipsis({ sx, ...props }: El<"span">) {
  return (
    <span
      data-slot="breadcrumb-ellipsis"
      role="presentation"
      aria-hidden="true"
      {...props}
      sx={[styles.ellipsis, sx]}
    >
      <Icon icon={MoreHorizontalIcon} />
      <VisuallyHidden>More</VisuallyHidden>
    </span>
  )
}

export {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
}
