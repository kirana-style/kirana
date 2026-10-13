import { css } from "@kirana-style/core"
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  MoreHorizontalIcon,
} from "@hugeicons/core-free-icons"

import type { Sx } from "../lib/sx"
import { mergeSx } from "../lib/sx"
import { Button } from "./button"
import { Icon } from "../primitives/icon"
import { VisuallyHidden } from "../primitives/visually-hidden"
import { ctx } from "../theme/context"
import { breakpoint } from "../tokens/breakpoints"
import { spacing } from "../tokens/spacing"

const styles = {
  root: css({
    marginInline: "auto",
    display: "flex",
    width: "100%",
    justifyContent: "center",
  }),
  content: css({ display: "flex", alignItems: "center", gap: spacing["0.5"] }),
  /**
   * The previous and next links tuck their arrow closer to the edge than a plain
   * button would. The original needed `pl-1.5!` to beat the size variant; here the
   * style is simply applied after it.
   */
  // `pl-1.5!` / `pr-1.5!` in the original: the importance beat the button size's
  // `has-data-[icon]` padding. In Kirana that is an explicit removal of every
  // earlier entry, conditional ones included, before the new base.
  previous: css({ paddingInlineStart: { "*": null, base: spacing["1.5"] } }),
  next: css({ paddingInlineEnd: { "*": null, base: spacing["1.5"] } }),
  /** The word beside the arrow is dropped on narrow screens. */
  label: css({ display: { base: "none", [breakpoint.sm]: "block" } }),
  ellipsis: css({
    display: "flex",
    width: spacing[8],
    height: spacing[8],
    alignItems: "center",
    justifyContent: "center",
    [ctx.iconSize]: "1rem",
  }),
}

type El<T extends keyof React.JSX.IntrinsicElements> = Omit<
  React.ComponentProps<T>,
  "className"
> & { sx?: Sx }

function Pagination({ sx, ...props }: El<"nav">) {
  return (
    <nav
      role="navigation"
      aria-label="pagination"
      data-slot="pagination"
      {...props}
      sx={[styles.root, sx]}
    />
  )
}

function PaginationContent({ sx, ...props }: El<"ul">) {
  return (
    <ul data-slot="pagination-content" {...props} sx={[styles.content, sx]} />
  )
}

function PaginationItem({ ...props }: React.ComponentProps<"li">) {
  return <li data-slot="pagination-item" {...props} />
}

type PaginationLinkProps = {
  isActive?: boolean
  sx?: Sx
} & Pick<React.ComponentProps<typeof Button>, "size"> &
  Omit<React.ComponentProps<"a">, "className">

function PaginationLink({
  sx,
  isActive,
  size = "icon",
  ...props
}: PaginationLinkProps) {
  return (
    <Button
      variant={isActive ? "outline" : "ghost"}
      size={size}
      sx={sx}
      nativeButton={false}
      render={
        <a
          aria-current={isActive ? "page" : undefined}
          data-slot="pagination-link"
          data-active={isActive}
          {...props}
        />
      }
    />
  )
}

function PaginationPrevious({
  sx,
  text = "Previous",
  ...props
}: React.ComponentProps<typeof PaginationLink> & { text?: string }) {
  return (
    <PaginationLink
      aria-label="Go to previous page"
      size="default"
      {...props}
      sx={mergeSx(styles.previous, sx)}
    >
      {/* The arrow points the way the text reads, so it mirrors in RTL. */}
      <Icon icon={ArrowLeft01Icon} data-icon="inline-start" />
      <span sx={styles.label}>{text}</span>
    </PaginationLink>
  )
}

function PaginationNext({
  sx,
  text = "Next",
  ...props
}: React.ComponentProps<typeof PaginationLink> & { text?: string }) {
  return (
    <PaginationLink
      aria-label="Go to next page"
      size="default"
      {...props}
      sx={mergeSx(styles.next, sx)}
    >
      <span sx={styles.label}>{text}</span>
      <Icon icon={ArrowRight01Icon} data-icon="inline-end" />
    </PaginationLink>
  )
}

function PaginationEllipsis({ sx, ...props }: El<"span">) {
  return (
    <span
      aria-hidden
      data-slot="pagination-ellipsis"
      {...props}
      sx={[styles.ellipsis, sx]}
    >
      <Icon icon={MoreHorizontalIcon} />
      <VisuallyHidden>More pages</VisuallyHidden>
    </span>
  )
}

export {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
}
