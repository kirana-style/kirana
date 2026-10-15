/**
 * Questions, or any short items with a longer answer, in groups: the group's
 * name on the left in its accent, an accordion across the rest of the width.
 * Below lg the name sits above its accordion. The questions `/why` ends on, the
 * sponsors page's terms and its questions all use it.
 */
import { css } from "@kirana-style/core"

import { accent, accents } from "@workspace/docs-ui/accent.ts"
import type { AccentName } from "@workspace/docs-ui/accent.ts"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@workspace/ui/components/accordion"
import { Icon } from "@workspace/ui/primitives/icon"
import type { IconProps } from "@workspace/ui/primitives/icon"
import { theme } from "@workspace/ui/theme/semantic"
import { breakpoint } from "@workspace/ui/tokens/breakpoints"
import { spacing } from "@workspace/ui/tokens/spacing"
import { fontSize, fontWeight } from "@workspace/ui/tokens/typography"

import { DocsLink } from "@/components/docs-link"
import { FAQ } from "@/data/faq"

export type FaqItem = { title: string; body: React.ReactNode }

export type FaqGroup = {
  topic: string
  /** The group's colour; the section's accent when left out. */
  tone?: AccentName
  /** A mark before the topic and before each item: a tick, a cross. */
  icon?: IconProps["icon"]
  items: readonly FaqItem[]
}

const styles = {
  answerLink: css({
    color: theme.foreground,
    fontWeight: fontWeight.medium,
    textDecorationLine: "underline",
    textDecorationStyle: "dashed",
    textUnderlineOffset: "4px",
  }),
  groups: css({ display: "grid", gap: spacing[10] }),
  group: css({
    display: "grid",
    gap: { base: spacing[3], [breakpoint.lg]: spacing[10] },
    gridTemplateColumns: {
      base: "minmax(0, 1fr)",
      [breakpoint.lg]: "14rem minmax(0, 1fr)",
    },
  }),
  topic: css({
    display: "flex",
    alignItems: "center",
    gap: spacing[2],
    alignSelf: "start",
    paddingBlockStart: spacing[3],
    fontSize: "0.6875rem",
    lineHeight: "1rem",
    fontWeight: fontWeight.semibold,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: accent.base,
  }),
  trigger: css({ display: "flex", alignItems: "center", gap: spacing["2.5"] }),
  mark: css({ flexShrink: 0, color: accent.base }),
  body: css({
    display: "grid",
    gap: spacing[2],
    justifyItems: "start",
    fontSize: fontSize.sm,
    lineHeight: "1.7",
    color: theme.mutedForeground,
  }),
}

export function FaqGroups({ groups }: { groups: readonly FaqGroup[] }) {
  return (
    <div sx={styles.groups}>
      {groups.map((group) => (
        <div
          key={group.topic}
          sx={[group.tone ? accents[group.tone] : null, styles.group]}
        >
          <span sx={styles.topic}>
            {group.icon ? <Icon icon={group.icon} size="0.875rem" /> : null}
            {group.topic}
          </span>
          <Accordion>
            {group.items.map((item) => (
              <AccordionItem key={item.title} value={item.title}>
                <AccordionTrigger>
                  <span sx={styles.trigger}>
                    {group.icon ? (
                      <Icon
                        icon={group.icon}
                        size="0.875rem"
                        sx={styles.mark}
                      />
                    ) : null}
                    {item.title}
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <div sx={styles.body}>{item.body}</div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      ))}
    </div>
  )
}

/** The questions people ask before they try Kirana, each answer ending on the page that states it. */
export function Faq() {
  return (
    <FaqGroups
      groups={FAQ.map((group) => ({
        topic: group.topic,
        items: group.items.map((item) => ({
          title: item.q,
          body: (
            <>
              <p>{item.a}</p>
              <DocsLink href={item.href} sx={styles.answerLink}>
                {item.link}
              </DocsLink>
            </>
          ),
        })),
      }))}
    />
  )
}
