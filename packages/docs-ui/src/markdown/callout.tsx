/**
 * A callout, as `> [!NOTE] Title` writes it. Each kind has its own hue and icon: note in lake, tip
 * in forest, important in dusk, warning in ochre, caution in the destructive red. The hue tints
 * the whole surface and its hairline all round, never a stripe down one side.
 */
import { css } from "@kirana-style/core"
import type { StyleHandle } from "@kirana-style/core"
import {
  Alert02Icon,
  CheckmarkCircle02Icon,
  InformationCircleIcon,
  Idea01Icon,
} from "@hugeicons/core-free-icons"

import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { theme } from "@workspace/ui/theme/semantic"
import { spacing } from "@workspace/ui/tokens/spacing"
import {
  fontSize,
  fontWeight,
  lineHeight,
} from "@workspace/ui/tokens/typography"

import { accent, accents, tint } from "../accent.ts"

/** Caution is the one kind that is not a scene hue: it is the theme's destructive colour. */
const caution = css({
  [accent.base]: theme.destructive,
  [accent.on]: theme.background,
})

const KINDS: Record<
  string,
  { icon: typeof InformationCircleIcon; tone: StyleHandle }
> = {
  note: { icon: InformationCircleIcon, tone: accents.lake },
  tip: { icon: Idea01Icon, tone: accents.forest },
  important: { icon: CheckmarkCircle02Icon, tone: accents.dusk },
  warning: { icon: Alert02Icon, tone: accents.ochre },
  caution: { icon: Alert02Icon, tone: caution },
}

const styles = {
  callout: css({
    borderColor: tint(28),
    backgroundColor: tint(6),
    paddingInline: spacing[4],
    paddingBlock: spacing[3],
    marginBlockEnd: spacing[5],
  }),
  icon: css({ color: accent.base }),
  // The body's size, so it reads as the heading of what follows.
  title: css({
    fontSize: fontSize.base,
    lineHeight: lineHeight.base,
    fontWeight: fontWeight.semibold,
    color: theme.foreground,
  }),
  // The body is prose, read at full contrast on the tint.
  body: css({ color: theme.foreground }),
}

/** A `md-callout` node. */
export function Callout({
  kind,
  title,
  children,
}: {
  kind: string
  title?: React.ReactNode
  children?: React.ReactNode
}) {
  const { icon, tone } = KINDS[kind] ?? KINDS.note!

  return (
    // A note on the page, not an announcement: `role="note"`, where the alert's own is "alert".
    <Alert role="note" sx={[tone, styles.callout]}>
      <AlertIcon icon={icon} sx={styles.icon} />
      {title ? <AlertTitle sx={styles.title}>{title}</AlertTitle> : null}
      <AlertDescription sx={styles.body}>{children}</AlertDescription>
    </Alert>
  )
}
