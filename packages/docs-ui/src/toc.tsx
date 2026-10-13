/**
 * "On this page". The active entry is the last heading to have crossed near the
 * top of the viewport, so it follows reading position; a marker in the tab's
 * accent springs from entry to entry. Server-rendered with nothing active.
 */
import { useEffect, useState } from "react"
import { css, props as styleProps } from "@kirana-style/core"
import { TextAlignLeftIcon } from "@hugeicons/core-free-icons"
import { motion, useReducedMotion } from "motion/react"

import type { PageHeading } from "@workspace/docs-core/types.ts"
import { Icon } from "@workspace/ui/primitives/icon"
import { theme } from "@workspace/ui/theme/semantic"
import { duration } from "@workspace/ui/tokens/motion"
import { spacing } from "@workspace/ui/tokens/spacing"
import {
  fontSize,
  fontWeight,
  lineHeight,
} from "@workspace/ui/tokens/typography"

import { accent } from "./accent.ts"

const styles = {
  nav: css({ display: "grid", gap: spacing[3] }),
  label: css({
    display: "flex",
    alignItems: "center",
    gap: spacing["1.5"],
    fontSize: fontSize.xs,
    lineHeight: lineHeight.xs,
    fontWeight: fontWeight.medium,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    color: theme.mutedForeground,
  }),
  list: css({
    display: "grid",
    borderInlineStartWidth: "1px",
    borderInlineStartStyle: "solid",
    borderInlineStartColor: theme.border,
  }),
  item: css({ position: "relative" }),
  marker: css({
    position: "absolute",
    insetBlock: "2px",
    insetInlineStart: "-1px",
    width: "2px",
    borderRadius: "2px",
    backgroundColor: accent.base,
  }),
  link: css({
    display: "block",
    paddingBlock: "0.3rem",
    paddingInlineStart: spacing[3],
    fontSize: "0.8125rem",
    lineHeight: "1.25rem",
    fontWeight: fontWeight.medium,
    textDecorationLine: "none",
    color: {
      base: theme.mutedForeground,
      ":hover": theme.foreground,
      '[data-active="true"]': theme.foreground,
    },
    transitionProperty: "color",
    transitionDuration: duration[150],
  }),
  nested: css({ paddingInlineStart: spacing[6] }),
}

export function TableOfContents({
  headings,
}: {
  headings: readonly PageHeading[]
}) {
  const [active, setActive] = useState<string>()
  const reduce = useReducedMotion()

  useEffect(() => {
    const elements = headings
      .map((heading) => document.getElementById(heading.id))
      .filter((element): element is HTMLElement => element !== null)
    if (elements.length === 0) return
    const update = () => {
      const bottom =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 4
      const crossed = elements.filter(
        (element) => element.getBoundingClientRect().top < 120
      )
      setActive(bottom ? elements.at(-1)?.id : crossed.at(-1)?.id)
    }
    update()
    window.addEventListener("scroll", update, { passive: true })
    return () => window.removeEventListener("scroll", update)
  }, [headings])

  if (headings.length === 0) return null

  return (
    <nav sx={styles.nav} aria-label="On this page">
      <p sx={styles.label}>
        <Icon icon={TextAlignLeftIcon} size="0.875rem" />
        On this page
      </p>
      <div sx={styles.list}>
        {headings.map((heading) => (
          <div key={heading.id} sx={styles.item}>
            {heading.id === active ? (
              <motion.span
                layoutId="docs-ui-toc-marker"
                transition={
                  reduce
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 350, damping: 30 }
                }
                {...styleProps(styles.marker)}
              />
            ) : null}
            <a
              href={`#${heading.id}`}
              sx={[styles.link, heading.level > 2 ? styles.nested : null]}
              data-active={heading.id === active ? "true" : undefined}
            >
              {heading.text}
            </a>
          </div>
        ))}
      </div>
    </nav>
  )
}
