import { css } from "@kirana-style/core"

import type { Sx } from "../lib/sx"
import { alpha, theme } from "../theme/semantic"
import { duration, easing } from "../tokens/motion"
import { spacing } from "../tokens/spacing"
import { fontSize, fontWeight, lineHeight } from "../tokens/typography"
import { peer } from "../theme/markers"

const styles = {
  container: css({ position: "relative", width: "100%", overflowX: "auto" }),
  table: css({
    width: "100%",
    captionSide: "bottom",
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
  }),

  // Each section states the border its own rows draw, and TableRow reads it
  // from a relation rather than a selector into markup it does not own.
  header: css({}),
  body: css({}),
  footer: css({
    borderTopWidth: "1px",
    borderTopColor: theme.border,
    backgroundColor: alpha.muted50,
    fontWeight: fontWeight.medium,
  }),

  row: css({
    // Both sections carry the default relation, and the last row of either
    // drops its rule.
    borderBottomWidth: {
      base: "1px",
      [peer.within('[data-slot="table-body"]')]: {
        base: "1px",
        ":last-child": 0,
      },
      [peer.within('[data-slot="table-footer"]')]: {
        base: "1px",
        ":last-child": 0,
      },
    },
    borderBottomColor: theme.border,
    transitionProperty: "background-color",
    transitionDuration: duration[150],
    transitionTimingFunction: easing.inOut,
    backgroundColor: {
      ":hover": alpha.muted50,
      ':has([aria-expanded="true"])': alpha.muted50,
      '[data-state="selected"]': theme.muted,
    },
  }),

  head: css({
    height: spacing[10],
    paddingInline: spacing[2],
    textAlign: "start",
    verticalAlign: "middle",
    fontWeight: fontWeight.medium,
    whiteSpace: "nowrap",
    color: theme.foreground,
    // A checkbox cell needs no trailing gap.
    paddingInlineEnd: {
      base: spacing[2],
      ':has([role="checkbox"])': 0,
    },
  }),
  cell: css({
    padding: spacing[2],
    verticalAlign: "middle",
    whiteSpace: "nowrap",
    paddingInlineEnd: {
      base: spacing[2],
      ':has([role="checkbox"])': 0,
    },
  }),
  caption: css({
    marginTop: spacing[4],
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    color: theme.mutedForeground,
  }),
}

type El<T extends keyof React.JSX.IntrinsicElements> = Omit<
  React.ComponentProps<T>,
  "className"
> & { sx?: Sx }

function Table({ sx, ...props }: El<"table">) {
  return (
    <div data-slot="table-container" sx={styles.container}>
      <table data-slot="table" {...props} sx={[styles.table, sx]} />
    </div>
  )
}

function TableHeader({ sx, ...props }: El<"thead">) {
  return <thead data-slot="table-header" {...props} sx={[styles.header, sx]} />
}

function TableBody({ sx, ...props }: El<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      {...props}
      sx={[peer.anchor, styles.body, sx]}
    />
  )
}

function TableFooter({ sx, ...props }: El<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      {...props}
      sx={[peer.anchor, styles.footer, sx]}
    />
  )
}

function TableRow({ sx, ...props }: El<"tr">) {
  return <tr data-slot="table-row" {...props} sx={[styles.row, sx]} />
}

function TableHead({ sx, ...props }: El<"th">) {
  return <th data-slot="table-head" {...props} sx={[styles.head, sx]} />
}

function TableCell({ sx, ...props }: El<"td">) {
  return <td data-slot="table-cell" {...props} sx={[styles.cell, sx]} />
}

function TableCaption({ sx, ...props }: El<"caption">) {
  return (
    <caption data-slot="table-caption" {...props} sx={[styles.caption, sx]} />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
