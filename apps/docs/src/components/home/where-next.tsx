/**
 * "Where to next": the homepage's index of the product pages, one row each, with a crop of the
 * landscape the page stands in. Each row wears its page's hue: the one place on the homepage where
 * several hues meet, each on the link to the page that is that colour.
 */
import { css } from "@kirana-style/core"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"

import { accent, accents } from "@workspace/docs-ui/accent.ts"
import { Icon } from "@workspace/ui/primitives/icon"
import { radius, theme } from "@workspace/ui/theme/semantic"
import { breakpoint } from "@workspace/ui/tokens/breakpoints"
import { duration, easing } from "@workspace/ui/tokens/motion"
import { spacing } from "@workspace/ui/tokens/spacing"
import {
  fontFamily,
  fontSize,
  fontWeight,
  textLeading,
  textSize,
  textTracking,
} from "@workspace/ui/tokens/typography"

import { SCENES, sceneImage } from "@/brand/scenes"
import type { SceneId } from "@/brand/scenes"
import { DocsLink } from "@/components/docs-link"

import { HomeSection } from "./frame"

const PAGES: readonly {
  href: string
  scene: SceneId
  label: string
  title: string
  text: string
}[] = [
  {
    href: "/why",
    scene: "highlands",
    label: "Why Kirana",
    title: "The case, with its costs",
    text: "What a compiler changes about CSS-in-JS, the promises it keeps, and where it costs you something.",
  },
  {
    href: "/compiler",
    scene: "crater-lake",
    label: "The compiler",
    title: "Six steps, all at build time",
    text: "What happens between your file and the stylesheet, the numbers, and the checks that catch mistakes.",
  },
  {
    href: "/editor",
    scene: "turquoise-lake",
    label: "In your editor",
    title: "The CSS on every element",
    text: "What the language server shows on each line, in the editor you use, answered by the compiler your build runs.",
  },
  {
    href: "/ui",
    scene: "misty-hills",
    label: "Kirana UI",
    title: "Components you don't have to port",
    text: "shadcn/ui's components and charts on typed styles, installed into your project with kirana-style ui add.",
  },
  {
    href: "/migrate",
    scene: "heritage-street",
    label: "Migrate",
    title: "Bring the styles you already have",
    text: "A codemod for Tailwind and one for StyleX, each reporting what it would not decide.",
  },
  {
    href: "/compare",
    scene: "still-water",
    label: "Compare",
    title: "Next to the tools you know",
    text: "StyleX, Panda CSS, Tailwind and runtime CSS-in-JS, on plain questions, with a source for every cell.",
  },
  {
    href: "/ecosystem",
    scene: "rock-garden",
    label: "Ecosystem",
    title: "Every package, and how ready it is",
    text: "The packages, the bundlers, the frameworks and the tools, each with its status.",
  },
]

const styles = {
  list: css({
    display: "grid",
    margin: 0,
    padding: 0,
    listStyleType: "none",
    borderBlockStartWidth: "1px",
    borderBlockStartStyle: "solid",
    borderBlockStartColor: theme.border,
  }),
  row: css({
    display: "grid",
    alignItems: "center",
    gap: { base: spacing[4], [breakpoint.md]: spacing[8] },
    gridTemplateColumns: {
      base: "6rem minmax(0, 1fr)",
      [breakpoint.md]: "11rem minmax(0, 1fr) auto",
    },
    paddingBlock: spacing[5],
    borderBlockEndWidth: "1px",
    borderBlockEndStyle: "solid",
    borderBlockEndColor: theme.border,
    color: theme.foreground,
    textDecorationLine: "none",
  }),
  picture: css({
    width: "100%",
    aspectRatio: "16 / 10",
    objectFit: "cover",
    borderRadius: radius.lg,
    scale: { base: "1", ":is([data-row]:hover *)": "1.03" },
    transitionProperty: "scale",
    transitionDuration: duration[300],
    transitionTimingFunction: easing.inOut,
  }),
  copy: css({ display: "grid", gap: spacing["1.5"] }),
  label: css({
    display: "inline-flex",
    alignItems: "center",
    gap: spacing[2],
    fontFamily: fontFamily.mono,
    fontSize: textSize.label,
    lineHeight: textLeading.label,
    letterSpacing: textTracking.label,
    textTransform: "uppercase",
  }),
  pixel: css({
    width: "0.5rem",
    height: "0.5rem",
    backgroundColor: accent.base,
  }),
  title: css({
    fontFamily: fontFamily.heading,
    // The serif's smallest size: 1.5rem.
    fontSize: fontSize["2xl"],
    lineHeight: "1.2",
    fontWeight: fontWeight.normal,
    letterSpacing: "-0.01em",
    color: { base: theme.foreground, ":is([data-row]:hover *)": accent.base },
    transitionProperty: "color",
    transitionDuration: duration[150],
  }),
  text: css({
    display: { base: "none", [breakpoint.sm]: "block" },
    maxWidth: "40rem",
    fontSize: fontSize.sm,
    lineHeight: "1.6",
    color: theme.mutedForeground,
  }),
  arrow: css({
    display: { base: "none", [breakpoint.md]: "block" },
    color: {
      base: theme.mutedForeground,
      ":is([data-row]:hover *)": accent.base,
    },
    translate: { base: "0 0", ":is([data-row]:hover *)": "4px 0" },
    transitionProperty: "translate, color",
    transitionDuration: duration[200],
  }),
}

export function WhereNext() {
  return (
    <HomeSection
      number="07"
      eyebrow="Where to next"
      title="Each page stands in its own place"
      lede="The rest of the site, in the order a newcomer tends to read it."
    >
      <ul sx={styles.list}>
        {PAGES.map((page) => (
          <li key={page.href} sx={accents[SCENES[page.scene].hue]}>
            <DocsLink href={page.href} sx={styles.row} data-row="">
              <img
                src={sceneImage(page.scene, 800)}
                alt=""
                loading="lazy"
                decoding="async"
                style={{ objectPosition: SCENES[page.scene].position }}
                sx={styles.picture}
              />
              <span sx={styles.copy}>
                <span sx={styles.label}>
                  <span sx={styles.pixel} aria-hidden="true" />
                  {page.label}
                </span>
                <span sx={styles.title}>{page.title}</span>
                <span sx={styles.text}>{page.text}</span>
              </span>
              <Icon icon={ArrowRight01Icon} size="1.25rem" sx={styles.arrow} />
            </DocsLink>
          </li>
        ))}
      </ul>
    </HomeSection>
  )
}
