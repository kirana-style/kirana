import { css, props as styleProps } from "@kirana-style/core"
import { Link } from "@tanstack/react-router"

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

import { flattenNav } from "./nav"
import type { NavGroup } from "./nav"
import { radius, theme } from "@workspace/ui/theme/semantic"
import { breakpoint } from "@workspace/ui/tokens/breakpoints"
import { duration, easing } from "@workspace/ui/tokens/motion"
import { spacing } from "@workspace/ui/tokens/spacing"
import {
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
} from "@workspace/ui/tokens/typography"

const styles = {
  stack: css({
    marginInline: "auto",
    display: "flex",
    width: "100%",
    maxWidth: "64rem",
    flexDirection: "column",
    gap: spacing["10"],
    padding: {
      base: spacing["4"],
      "@media (min-width: 40rem) and (max-width: 63.999rem)": spacing["6"],
      [breakpoint.lg]: spacing["12"],
    },
  }),
  stack2: css({
    display: "flex",
    flexDirection: "column",
    gap: spacing["2"],
  }),
  heading: css({
    fontFamily: fontFamily.heading,
    fontSize: fontSize["3xl"],
    lineHeight: lineHeight["3xl"],
    fontWeight: fontWeight.medium,
  }),
  paragraph: css({
    color: theme.mutedForeground,
  }),
  stack3: css({
    display: "flex",
    flexDirection: "column",
    gap: spacing["3"],
  }),
  heading2: css({
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    fontWeight: fontWeight.medium,
    color: theme.mutedForeground,
  }),
  grid: css({
    display: "grid",
    gap: spacing["3"],
    gridTemplateColumns: {
      "@media (min-width: 40rem) and (max-width: 63.999rem)":
        "repeat(2, minmax(0, 1fr))",
      [breakpoint.lg]: "repeat(3, minmax(0, 1fr))",
    },
  }),
  link: css({
    borderRadius: radius.xl,
  }),
  card: css({
    height: "100%",
    transitionProperty:
      "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke",
    transitionTimingFunction: easing.inOut,
    transitionDuration: duration["150"],
    // The card's own fill is restated: an sx value replaces it whole.
    backgroundColor: { base: theme.card, ":hover": theme.muted },
  }),
}

export function IndexPage({
  title,
  description,
  groups,
}: {
  title: string
  description: string
  groups: NavGroup[]
}) {
  return (
    <div sx={styles.stack}>
      <div sx={styles.stack2}>
        <h1 sx={styles.heading}>{title}</h1>
        <p sx={styles.paragraph}>{description}</p>
      </div>
      {groups.map((group) => (
        <section key={group.label} sx={styles.stack3}>
          <h2 sx={styles.heading2}>{group.label}</h2>
          <div sx={styles.grid}>
            {flattenNav([group]).map((item) => (
              <Link key={item.href} to={item.href} {...styleProps(styles.link)}>
                <Card size="sm" sx={styles.card}>
                  <CardHeader>
                    <CardTitle>{item.title}</CardTitle>
                    <CardDescription>
                      {item.description ?? item.href}
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
