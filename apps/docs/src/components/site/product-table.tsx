/**
 * Kirana's products beside the compiler, from `data/products.ts`: one row each, linked when it is
 * out and marked "Planned" when it is not. The roadmap shows it (`<!-- ::products -->`); the
 * `/ecosystem` page's chapter that showed it is commented out for now.
 */
import { css } from "@kirana-style/core"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"

import { accent, tint } from "@workspace/docs-ui/accent.ts"
import { Icon } from "@workspace/ui/primitives/icon"
import { radius, theme } from "@workspace/ui/theme/semantic"
import { breakpoint } from "@workspace/ui/tokens/breakpoints"
import { duration } from "@workspace/ui/tokens/motion"
import { spacing } from "@workspace/ui/tokens/spacing"
import {
  fontFamily,
  fontSize,
  fontWeight,
  textLeading,
  textSize,
  textTracking,
} from "@workspace/ui/tokens/typography"

import { DocsLink } from "@/components/docs-link"
import { InlineCode } from "@/components/site/code-tokens"
import { PRODUCTS } from "@/data/products"

const styles = {
  table: css({
    display: "grid",
    overflow: "hidden",
    marginBlock: spacing[6],
    borderRadius: radius.xl,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: theme.border,
  }),
  row: css({
    display: "grid",
    alignItems: "center",
    gap: { base: spacing[1], [breakpoint.md]: spacing[4] },
    gridTemplateColumns: {
      base: "minmax(0, 1fr) auto",
      [breakpoint.md]: "12rem minmax(0, 1fr) auto",
    },
    paddingInline: spacing[5],
    paddingBlock: spacing[3],
    borderBlockStartWidth: { base: "1px", ":first-child": "0" },
    borderBlockStartStyle: "solid",
    borderBlockStartColor: theme.border,
    fontSize: fontSize.sm,
    lineHeight: "1.6",
    textDecorationLine: "none",
    color: theme.foreground,
    backgroundColor: { base: "transparent", ":is(a):hover": tint(5) },
  }),
  name: css({
    display: "inline-flex",
    alignItems: "center",
    gap: spacing[2],
    fontWeight: fontWeight.medium,
  }),
  icon: css({ color: accent.base }),
  note: css({
    color: theme.mutedForeground,
    gridColumn: { base: "1 / -1", [breakpoint.md]: "auto" },
    gridRow: { base: "2", [breakpoint.md]: "auto" },
  }),
  status: css({
    justifySelf: "end",
    fontFamily: fontFamily.mono,
    fontSize: textSize.label,
    lineHeight: textLeading.label,
    letterSpacing: textTracking.label,
    textTransform: "uppercase",
    whiteSpace: "nowrap",
    color: theme.mutedForeground,
  }),
  arrow: css({
    justifySelf: "end",
    color: { base: theme.mutedForeground, ":is(a:hover *)": theme.foreground },
    transitionProperty: "color",
    transitionDuration: duration[150],
  }),
}

/** A note with its `code` spans set as code. */
function Note({ text }: { text: string }) {
  return text
    .split("`")
    .map((part, index) =>
      index % 2 === 1 ? <InlineCode key={index}>{part}</InlineCode> : part
    )
}

export function ProductTable() {
  return (
    <div sx={styles.table} data-slot="products">
      {PRODUCTS.map((item) => {
        const body = (
          <>
            <span sx={styles.name}>
              <Icon icon={item.icon} size="1rem" sx={styles.icon} />
              {item.name}
            </span>
            <span sx={styles.note}>
              <Note text={item.note} />
            </span>
          </>
        )
        return item.href === undefined ? (
          <div key={item.name} sx={styles.row}>
            {body}
            <span sx={styles.status}>Planned</span>
          </div>
        ) : (
          <DocsLink key={item.name} href={item.href} sx={styles.row}>
            {body}
            <Icon icon={ArrowRight01Icon} size="0.875rem" sx={styles.arrow} />
          </DocsLink>
        )
      })}
    </div>
  )
}
