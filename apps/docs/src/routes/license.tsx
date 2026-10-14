import { createFileRoute } from "@tanstack/react-router"
import { css } from "@kirana-style/core"
import { Cancel01Icon, Tick02Icon } from "@hugeicons/core-free-icons"

import { accent } from "@workspace/docs-ui/accent.ts"
import { Icon } from "@workspace/ui/primitives/icon"
import { radius, theme } from "@workspace/ui/theme/semantic"
import { breakpoint } from "@workspace/ui/tokens/breakpoints"
import { spacing } from "@workspace/ui/tokens/spacing"
import {
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
} from "@workspace/ui/tokens/typography"

import { Accent, Page, PageHero, PageSection } from "@/components/site/page"

export const Route = createFileRoute("/license")({
  component: LicensePage,
  head: () => ({
    meta: [
      { title: "License · Kirana" },
      {
        name: "description",
        content:
          "Kirana is MIT licensed: the compiler, every package and the documentation.",
      },
    ],
  }),
})

/** The copyright line every file and package carries (KRN-LEGAL-001). */
const COPYRIGHT = "Copyright (c) 2026 Kirana authors"

const MIT = `MIT License

${COPYRIGHT}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`

const CAN = [
  "Use it in commercial and closed-source products",
  "Modify it, fork it, and ship your changes",
  "Redistribute it, bundled or on its own",
  "Sublicense the code you build on it",
]
const MUST = [
  "Keep the copyright notice and licence text with copies of Kirana's code",
]
const NOT = ["Any warranty", "Liability of the authors"]

/** Obligations from the licensing specification's dependency table. */
const THIRD_PARTY = [
  {
    name: "Lightning CSS",
    license: "MPL-2.0",
    note: "Used unmodified as a dependency, for shorthand splitting and lowering; a binary that includes it must point to its source.",
  },
  {
    name: "Tailwind CSS scale data",
    license: "MIT",
    note: "The values in @kirana-style/preset-scales; Tailwind's notice is in the preset's README.",
  },
  {
    name: "tw-animate-css keyframes",
    license: "MIT",
    note: "Restated as tokens in @kirana-style/preset-scales; its notice is in the preset's README.",
  },
  {
    name: "Oxc, NAPI-RS and other crates",
    license: "MIT / Apache-2.0",
    note: "Their notices belong in a third-party report, which is not written yet.",
  },
]

const styles = {
  columns: css({
    display: "grid",
    gap: spacing[4],
    gridTemplateColumns: {
      base: "minmax(0, 1fr)",
      [breakpoint.md]: "repeat(3, minmax(0, 1fr))",
    },
  }),
  column: css({
    display: "grid",
    alignContent: "start",
    gap: spacing[3],
    borderRadius: radius.xl,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: theme.border,
    backgroundColor: theme.card,
    padding: spacing[6],
  }),
  columnTitle: css({
    fontSize: fontSize.lg,
    lineHeight: lineHeight.lg,
    fontWeight: fontWeight.semibold,
  }),
  item: css({
    display: "flex",
    gap: spacing[2],
    fontSize: fontSize.sm,
    lineHeight: "1.6",
  }),
  yes: css({ flexShrink: 0, marginBlockStart: "0.2em", color: accent.base }),
  no: css({
    flexShrink: 0,
    marginBlockStart: "0.2em",
    color: theme.mutedForeground,
  }),
  text: css({
    margin: 0,
    overflowX: "auto",
    borderRadius: radius.xl,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: theme.border,
    backgroundColor: theme.card,
    padding: { base: spacing[5], [breakpoint.md]: spacing[8] },
    display: "grid",
    gap: spacing[4],
    fontFamily: fontFamily.mono,
    fontSize: "0.8125rem",
    lineHeight: "1.7",
  }),
  table: css({
    display: "grid",
    overflow: "hidden",
    borderRadius: radius.xl,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: theme.border,
  }),
  row: css({
    display: "grid",
    gap: { base: spacing[1], [breakpoint.md]: spacing[4] },
    gridTemplateColumns: {
      base: "minmax(0, 1fr)",
      [breakpoint.md]: "14rem 9rem minmax(0, 1fr)",
    },
    paddingInline: spacing[5],
    paddingBlock: spacing[4],
    borderBlockStartWidth: { base: "1px", ":first-child": "0" },
    borderBlockStartStyle: "solid",
    borderBlockStartColor: theme.border,
    fontSize: fontSize.sm,
    lineHeight: "1.6",
  }),
  name: css({ fontWeight: fontWeight.semibold }),
  license: css({ fontFamily: fontFamily.mono, color: accent.base }),
  note: css({ color: theme.mutedForeground }),
}

function List({
  items,
  kind,
}: {
  items: readonly string[]
  kind: "yes" | "no"
}) {
  return (
    <ul>
      {items.map((item) => (
        <li key={item} sx={styles.item}>
          <Icon
            icon={kind === "yes" ? Tick02Icon : Cancel01Icon}
            size="0.875rem"
            sx={kind === "yes" ? styles.yes : styles.no}
          />
          {item}
        </li>
      ))}
    </ul>
  )
}

function LicensePage() {
  return (
    <Page scene="old-hall">
      <PageHero
        label="License"
        title={
          <>
            MIT, <Accent>all of it.</Accent>
          </>
        }
        lede="The compiler, every package and this documentation are released under the MIT License. Sponsorship pays for maintenance; it never buys features away from anyone."
      />

      <PageSection number="01" label="The terms" title="In short">
        <div sx={styles.columns}>
          <div sx={styles.column}>
            <span sx={styles.columnTitle}>You can</span>
            <List items={CAN} kind="yes" />
          </div>
          <div sx={styles.column}>
            <span sx={styles.columnTitle}>You must</span>
            <List items={MUST} kind="yes" />
          </div>
          <div sx={styles.column}>
            <span sx={styles.columnTitle}>It comes without</span>
            <List items={NOT} kind="no" />
          </div>
        </div>
      </PageSection>

      <PageSection number="02" label="Full text" title="The licence">
        <div sx={styles.text}>
          {MIT.split("\n\n").map((paragraph) => (
            <p key={paragraph.slice(0, 24)}>{paragraph.replace(/\n/g, " ")}</p>
          ))}
        </div>
      </PageSection>

      <PageSection
        number="03"
        label="Credits"
        title="What Kirana builds on"
        lede="Dependencies whose licences carry an obligation, from the project's licensing specification. The Rust dependencies' licences are also checked against an allow list by cargo-deny."
      >
        <div sx={styles.table}>
          {THIRD_PARTY.map((item) => (
            <div key={item.name} sx={styles.row}>
              <span sx={styles.name}>{item.name}</span>
              <span sx={styles.license}>{item.license}</span>
              <span sx={styles.note}>{item.note}</span>
            </div>
          ))}
        </div>
      </PageSection>
    </Page>
  )
}
