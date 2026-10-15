/**
 * `<!-- ::packages -->`: every package, read from its `package.json` at build time, as ruled
 * rows: the name, what it is, and its version, linked to the package on npm. A package that is
 * not published says so in place of the link, so the page cannot claim more than npm has.
 */
import { css } from "@kirana-style/core"
import { LinkSquare02Icon } from "@hugeicons/core-free-icons"

import { Icon } from "@workspace/ui/primitives/icon"
import { theme } from "@workspace/ui/theme/semantic"
import { breakpoint } from "@workspace/ui/tokens/breakpoints"
import { spacing } from "@workspace/ui/tokens/spacing"
import {
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
  textLeading,
  textSize,
  textTracking,
} from "@workspace/ui/tokens/typography"

import { InlineCode } from "@/components/site/code-tokens"
import { PACKAGES } from "@/generated/packages.gen"

const styles = {
  list: css({
    display: "grid",
    marginBlockEnd: spacing[6],
    borderBlockStartWidth: "1px",
    borderBlockStartStyle: "solid",
    borderBlockStartColor: theme.border,
  }),
  row: css({
    display: "grid",
    alignItems: "baseline",
    columnGap: spacing[4],
    rowGap: spacing[1],
    gridTemplateColumns: {
      base: "minmax(0, 1fr) auto",
      [breakpoint.lg]: "16rem minmax(0, 1fr) auto",
    },
    paddingBlock: spacing[3],
    borderBlockEndWidth: "1px",
    borderBlockEndStyle: "solid",
    borderBlockEndColor: theme.border,
  }),
  name: css({
    fontFamily: fontFamily.mono,
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    fontWeight: fontWeight.medium,
    overflowWrap: "anywhere",
  }),
  // Under the name in a narrow column, between the name and the version in a wide one.
  description: css({
    gridColumn: { base: "1 / -1", [breakpoint.lg]: "auto" },
    gridRow: { base: "2", [breakpoint.lg]: "auto" },
    fontSize: fontSize.sm,
    lineHeight: "1.6",
    color: theme.mutedForeground,
  }),
  version: css({
    display: "inline-flex",
    alignItems: "center",
    justifySelf: "end",
    gap: spacing[1],
    fontFamily: fontFamily.mono,
    fontSize: fontSize.xs,
    color: { base: theme.mutedForeground, ":hover": theme.foreground },
    textDecorationLine: "none",
    whiteSpace: "nowrap",
  }),
  unpublished: css({
    justifySelf: "end",
    fontFamily: fontFamily.mono,
    fontSize: textSize.label,
    lineHeight: textLeading.label,
    letterSpacing: textTracking.label,
    textTransform: "uppercase",
    color: theme.mutedForeground,
    whiteSpace: "nowrap",
  }),
}

/** A description with its `code` spans set as code. */
function Described({ text }: { text: string }) {
  return text
    .split("`")
    .map((part, index) =>
      index % 2 === 1 ? <InlineCode key={index}>{part}</InlineCode> : part
    )
}

export function PackageTable() {
  return (
    <ul sx={styles.list} data-slot="package-table">
      {PACKAGES.map((entry) => (
        <li key={entry.name} sx={styles.row}>
          <span sx={styles.name}>{entry.name}</span>
          <span sx={styles.description}>
            <Described text={entry.description} />
          </span>
          {entry.published ? (
            <a
              href={`https://www.npmjs.com/package/${entry.name}`}
              target="_blank"
              rel="noreferrer"
              sx={styles.version}
              aria-label={`${entry.name} ${entry.version} on npm`}
            >
              {entry.version}
              <Icon icon={LinkSquare02Icon} size="0.75rem" />
            </a>
          ) : (
            <span sx={styles.unpublished}>{entry.version}, not on npm</span>
          )}
        </li>
      ))}
    </ul>
  )
}
