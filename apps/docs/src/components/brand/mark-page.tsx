/**
 * The petal K, evaluated: how it is built (grid, widths, Fibonacci circles, tangent joins), the
 * formula to redraw it, its balance, how close it stays to the reference drawing, and how it looks
 * in colour, in one colour, small, as an app icon and in the header. Every drawing on this page is
 * made from the construction data in `@/brand/kirana-mark`; nothing is drawn by hand.
 */
import { css } from "@kirana-style/core"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { theme } from "@workspace/ui/theme/semantic"
import { breakpoint } from "@workspace/ui/tokens/breakpoints"
import { spacing } from "@workspace/ui/tokens/spacing"
import {
  fontFamily,
  fontSize,
  fontWeight,
  letterSpacing,
} from "@workspace/ui/tokens/typography"

import {
  ONE_COLOUR,
  PALETTES,
  SCENERY,
  SOLIDS,
  VISIBLE,
  CIRCLES,
  FIDELITY,
  RULES,
  WIDTHS,
} from "@/brand/kirana-mark"
import type { Part } from "@/brand/kirana-mark"
import { KiranaMark } from "@/brand/kirana-mark-svg"
import type { MarkVariant } from "@/brand/kirana-mark-svg"
import { DocsLink } from "@/components/docs-link"
import {
  Section,
  SectionHeader,
  sectionStyles,
} from "@/components/page-section"
import { Wordmark } from "@/components/site/wordmark"

import { PART_TINT, Plan, REFERENCE_RED } from "@/components/brand/mark-plan"
import type { Layers } from "@/components/brand/mark-plan"
import { Palettes } from "@/components/brand/palettes"
import { Wording } from "@/components/brand/wording"

/** Fixed surfaces: a variant is judged on the surface it is made for. */
const PAPER = "#fafafa"
const INK = "#0a0a0a"
const styles = {
  heroGrid: css({
    display: "grid",
    gap: spacing[10],
    alignItems: "center",
    gridTemplateColumns: {
      base: "minmax(0, 1fr)",
      [breakpoint.lg]: "minmax(0, 1.1fr) minmax(0, 0.9fr)",
    },
  }),
  heroCopy: css({ display: "grid", gap: spacing[5], justifyItems: "start" }),
  title: css({
    fontFamily: fontFamily.heading,
    fontSize: { base: fontSize["4xl"], [breakpoint.md]: fontSize["6xl"] },
    lineHeight: 1.05,
    fontWeight: fontWeight.normal,
    letterSpacing: letterSpacing.tight,
  }),
  lede: css({
    maxWidth: "38rem",
    fontSize: fontSize.lg,
    lineHeight: "1.65",
    color: theme.mutedForeground,
  }),
  heroArt: css({ padding: { base: spacing[6], [breakpoint.md]: spacing[10] } }),
  facts: css({ display: "flex", flexWrap: "wrap", gap: spacing[2] }),

  steps: css({
    display: "grid",
    gap: spacing[4],
    gridTemplateColumns: {
      base: "repeat(2, minmax(0, 1fr))",
      [breakpoint.md]: "repeat(3, minmax(0, 1fr))",
      [breakpoint.xl]: "repeat(5, minmax(0, 1fr))",
    },
  }),
  step: css({
    display: "grid",
    gap: spacing[3],
    alignContent: "start",
    padding: spacing[4],
  }),
  stepNumber: css({
    fontFamily: fontFamily.numeric,
    fontSize: fontSize.xs,
    color: theme.mutedForeground,
  }),
  stepTitle: css({ fontWeight: fontWeight.semibold }),
  stepText: css({
    fontSize: fontSize.sm,
    lineHeight: "1.6",
    color: theme.mutedForeground,
  }),

  formula: css({
    display: "grid",
    gap: spacing[8],
    alignItems: "start",
    gridTemplateColumns: {
      base: "minmax(0, 1fr)",
      [breakpoint.lg]: "minmax(0, 1fr) minmax(0, 1fr)",
    },
  }),
  bigPlan: css({ padding: { base: spacing[3], [breakpoint.md]: spacing[6] } }),
  rules: css({
    display: "grid",
    gap: spacing[3],
    margin: 0,
    paddingInlineStart: spacing[5],
  }),
  rule: css({ fontSize: fontSize.sm, lineHeight: "1.65" }),
  table: css({
    width: "100%",
    borderCollapse: "collapse",
    fontSize: fontSize.sm,
  }),
  th: css({
    textAlign: "start",
    paddingBlock: spacing[2],
    paddingInlineEnd: spacing[3],
    fontWeight: fontWeight.medium,
    color: theme.mutedForeground,
    borderBlockEndWidth: "1px",
    borderBlockEndStyle: "solid",
    borderBlockEndColor: theme.border,
  }),
  td: css({
    paddingBlock: spacing["1.5"],
    paddingInlineEnd: spacing[3],
    borderBlockEndWidth: "1px",
    borderBlockEndStyle: "solid",
    borderBlockEndColor: theme.border,
    verticalAlign: "top",
  }),
  num: css({ fontFamily: fontFamily.numeric, whiteSpace: "nowrap" }),

  three: css({
    display: "grid",
    gap: "1px",
    backgroundColor: theme.border,
    gridTemplateColumns: {
      base: "minmax(0, 1fr)",
      [breakpoint.md]: "repeat(3, minmax(0, 1fr))",
    },
  }),
  cell: css({
    display: "grid",
    gap: spacing[3],
    padding: spacing[6],
    backgroundColor: theme.background,
  }),
  cellTitle: css({ fontWeight: fontWeight.semibold }),
  cellText: css({
    fontSize: fontSize.sm,
    lineHeight: "1.6",
    color: theme.mutedForeground,
  }),
  figure: css({ maxWidth: "16rem", justifySelf: "center", width: "100%" }),
  bars: css({ display: "grid", gap: spacing[2] }),
  barRow: css({
    display: "grid",
    gridTemplateColumns: "4rem minmax(0, 1fr) 3.5rem",
    alignItems: "center",
    gap: spacing[3],
    fontSize: fontSize.sm,
  }),
  barTrack: css({
    height: "0.5rem",
    borderRadius: "999px",
    backgroundColor: theme.muted,
    overflow: "hidden",
  }),
  bar: css({ display: "block", height: "100%", borderRadius: "999px" }),

  surfaces: css({
    display: "grid",
    gap: spacing[3],
    gridTemplateColumns: {
      base: "repeat(2, minmax(0, 1fr))",
      [breakpoint.md]: "repeat(5, minmax(0, 1fr))",
    },
  }),
  surface: css({
    display: "grid",
    gap: spacing[3],
    justifyItems: "center",
    paddingBlock: spacing[8],
    paddingInline: spacing[4],
    borderRadius: "0.875rem",
  }),
  surfaceMark: css({ height: "6rem" }),
  surfaceLabel: css({ fontSize: fontSize.xs, opacity: 0.75 }),

  sizes: css({
    display: "flex",
    flexWrap: "wrap",
    alignItems: "flex-end",
    gap: spacing[8],
    padding: spacing[8],
  }),
  size: css({ display: "grid", gap: spacing[2], justifyItems: "center" }),
  sizeLabel: css({
    fontFamily: fontFamily.numeric,
    fontSize: fontSize.xs,
    color: theme.mutedForeground,
  }),
  icon: css({
    display: "grid",
    placeItems: "center",
    width: "6rem",
    height: "6rem",
    borderRadius: "1.5rem",
  }),
  iconMark: css({ height: "3.75rem" }),

  bars2: css({ display: "grid", gap: spacing[4] }),
  header: css({
    display: "flex",
    alignItems: "center",
    gap: spacing["2.5"],
    paddingInline: spacing[6],
    paddingBlock: spacing[4],
    borderRadius: "0.875rem",
  }),
  headerLight: css({
    colorScheme: "light",
    backgroundColor: PAPER,
    color: INK,
  }),
  headerDark: css({ colorScheme: "dark", backgroundColor: INK, color: PAPER }),
  headerMark: css({ height: "1.75rem" }),
  headerNav: css({
    display: "flex",
    gap: spacing[5],
    marginInlineStart: "auto",
    fontSize: fontSize.sm,
    opacity: 0.7,
  }),
}

const STEPS: { title: string; text: string; layers: Layers }[] = [
  {
    title: "The grid",
    text: "16 × 21.5 units. The stem's top is the top edge; the arm's tip sits 2u below it at the right, and the leg's tip takes the bottom-right corner.",
    layers: { grid: true, ghost: true, dimensions: true },
  },
  {
    title: "One width",
    text: "Every part is 5u (F5) at its widest: the stem, the arm and the leg balance by width.",
    layers: { grid: true, fill: "tint", widths: true },
  },
  {
    title: "The circles",
    text: "Each curve is an arc of a Fibonacci circle: 3, 5, 8, 13 or 55u.",
    layers: { grid: true, ghost: true, circles: true, labels: true },
  },
  {
    title: "The joins",
    text: "Every arc meets the next edge tangent to it (green). Only the tips are sharp (red).",
    layers: { grid: true, ghost: true, outline: true, joints: true },
  },
  {
    title: "The mark",
    text: "Painted stem, leg, arm: the arm lies over the stem's edge and the leg's tip.",
    layers: { fill: "brand" },
  },
]

const PART_NAMES: Record<Part, string> = {
  stem: "Stem",
  arm: "Arm",
  leg: "Leg",
}

function WidthBars() {
  const max = 6.5
  return (
    <div sx={styles.bars}>
      {(["stem", "arm", "leg"] as const).map((part) => (
        <div key={part} sx={styles.bars2}>
          <div sx={styles.barRow}>
            <span>{PART_NAMES[part]}</span>
            <span sx={styles.barTrack}>
              <span
                sx={styles.bar}
                style={{
                  width: `${(WIDTHS.reference[part] / max) * 100}%`,
                  backgroundColor: REFERENCE_RED,
                }}
              />
            </span>
            <span sx={styles.num}>{WIDTHS.reference[part].toFixed(2)}u</span>
          </div>
          <div sx={styles.barRow}>
            <span />
            <span sx={styles.barTrack}>
              <span
                sx={styles.bar}
                style={{
                  width: `${(WIDTHS.constructed[part] / max) * 100}%`,
                  backgroundColor: PART_TINT[part],
                }}
              />
            </span>
            <span sx={styles.num}>{WIDTHS.constructed[part].toFixed(2)}u</span>
          </div>
        </div>
      ))}
    </div>
  )
}

const SURFACES: {
  label: string
  variant: MarkVariant
  background: string
  color: string
}[] = [
  { label: "Brand, on paper", variant: "brand", background: PAPER, color: INK },
  { label: "Brand, on ink", variant: "brand", background: INK, color: PAPER },
  { label: "One colour", variant: "solid", background: PAPER, color: INK },
  { label: "Reversed", variant: "solid", background: INK, color: PAPER },
  { label: "Mono", variant: "mono", background: "#e6e4dc", color: "#1c1b19" },
]

export function MarkPage() {
  return (
    <>
      <Section>
        <div sx={styles.heroGrid}>
          <div sx={styles.heroCopy}>
            <Badge variant="secondary">Brand · the mark</Badge>
            <h1 sx={styles.title}>The petal K</h1>
            <p sx={styles.lede}>
              A K of three petals (a stem, an arm and a leg) built from a grid
              and Fibonacci circles so it can be redrawn with a compass and a
              rule, never traced. Every part is the same width and shows the
              same area, every curve meets the next edge tangent to it, and the
              brand colours are Highland morning: the sun, the forest and the
              far ridges of the master scene.
            </p>
            <div sx={styles.facts}>
              <Badge variant="outline">16 × 21.5u</Badge>
              <Badge variant="outline">5u wide parts · F5</Badge>
              <Badge variant="outline">Circles 3 · 5 · 8 · 13 · 55u</Badge>
              <Badge variant="outline">Leg at 36° · cos 36° = φ / 2</Badge>
            </div>
            <Button
              variant="outline"
              nativeButton={false}
              render={<DocsLink href="/brand">Back to all directions</DocsLink>}
            />
          </div>
          <div sx={[sectionStyles.bordered, styles.heroArt]}>
            <Plan
              layers={{ grid: true, fill: "brand" }}
              label="The petal K on its 16 × 21.5 grid"
            />
          </div>
        </div>
      </Section>

      <Section tinted>
        <SectionHeader
          eyebrow="Construction"
          title="Five steps, nothing by eye"
        >
          Each step adds one layer of the construction. The last is the mark the
          files and the header use.
        </SectionHeader>
        <div sx={styles.steps}>
          {STEPS.map((step, index) => (
            <div key={step.title} sx={[sectionStyles.bordered, styles.step]}>
              <span sx={styles.stepNumber}>0{index + 1}</span>
              <Plan layers={step.layers} label={step.title} />
              <span sx={styles.stepTitle}>{step.title}</span>
              <span sx={styles.stepText}>{step.text}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section>
        <SectionHeader
          eyebrow="The formula"
          title="The grid, the circles and the rules"
        >
          Everything a designer needs to redraw the mark at any size: the rules
          in order, and every circle with its radius and centre in units.
        </SectionHeader>
        <div sx={styles.formula}>
          <div sx={[sectionStyles.bordered, styles.bigPlan]}>
            <Plan
              layers={{
                grid: true,
                ghost: true,
                circles: true,
                labels: true,
                outline: true,
                joints: true,
                dimensions: true,
              }}
              label="The full construction: grid, circles, outline and joins"
            />
          </div>
          <div sx={styles.bars2}>
            <ol sx={styles.rules}>
              {RULES.map((rule) => (
                <li key={rule} sx={styles.rule}>
                  {rule}
                </li>
              ))}
            </ol>
            <table sx={styles.table}>
              <thead>
                <tr>
                  <th sx={styles.th}>Part</th>
                  <th sx={styles.th}>Radius</th>
                  <th sx={styles.th}>Centre</th>
                  <th sx={styles.th}>Role</th>
                </tr>
              </thead>
              <tbody>
                {CIRCLES.map((c) => (
                  <tr key={`${c.cx},${c.cy},${c.r}`}>
                    <td sx={styles.td}>{PART_NAMES[c.part]}</td>
                    <td sx={[styles.td, styles.num]}>{c.r}u</td>
                    <td sx={[styles.td, styles.num]}>
                      {c.cx}, {c.cy}
                    </td>
                    <td sx={styles.td}>{c.role}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Section>

      <Section tinted>
        <SectionHeader eyebrow="Balance" title="One width for three parts">
          The reference grew heavier from stem to leg. Here each part is 5u at
          its widest — measured as the widest circle that fits inside it — and
          the lengths are set so each shows the same area once the arm is
          painted over the others: stem {VISIBLE.stem.toFixed(1)}, arm{" "}
          {VISIBLE.arm.toFixed(1)}, leg {VISIBLE.leg.toFixed(1)}u².
        </SectionHeader>
        <div sx={styles.formula}>
          <div sx={[sectionStyles.bordered, styles.bigPlan]}>
            <Plan
              layers={{ fill: "tint", widths: true }}
              label="Each part with the 5u circle that measures its width"
            />
          </div>
          <div sx={styles.bars2}>
            <span sx={styles.cellText}>
              Widest width, reference (red) and constructed:
            </span>
            <WidthBars />
          </div>
        </div>
      </Section>

      <Section tinted>
        <SectionHeader
          eyebrow="Against the reference"
          title="What stayed, what changed"
        >
          The red outline is the reference drawing, aligned on the arm. The arm
          slims to 5u and keeps its line; the stem gets a smooth top and rises
          2u; the leg slims to 5u, turns to 36° and ends sooner, so each part
          shows the same area. Overlap of each part with the reference: stem{" "}
          {(FIDELITY.stem * 100).toFixed(1)}%, arm{" "}
          {(FIDELITY.arm * 100).toFixed(1)}%, leg{" "}
          {(FIDELITY.leg * 100).toFixed(1)}%.
        </SectionHeader>
        <div sx={[sectionStyles.bordered, styles.three]}>
          <div sx={styles.cell}>
            <span sx={styles.cellTitle}>Reference</span>
            <div sx={styles.figure}>
              <Plan
                layers={{ reference: true }}
                label="The reference drawing"
              />
            </div>
            <span sx={styles.cellText}>
              The drawing the mark is rebuilt from, as an outline.
            </span>
          </div>
          <div sx={styles.cell}>
            <span sx={styles.cellTitle}>Constructed</span>
            <div sx={styles.figure}>
              <Plan
                layers={{ outline: true, joints: true }}
                label="The constructed outline"
              />
            </div>
            <span sx={styles.cellText}>
              Arcs and lines only, tangent at every join.
            </span>
          </div>
          <div sx={styles.cell}>
            <span sx={styles.cellTitle}>Overlay</span>
            <div sx={styles.figure}>
              <Plan
                layers={{ fill: "tint", reference: true }}
                label="The constructed mark under the reference outline"
              />
            </div>
            <span sx={styles.cellText}>
              Whole mark: {(FIDELITY.whole * 100).toFixed(1)}% overlap.
            </span>
          </div>
        </div>
      </Section>

      <Section>
        <SectionHeader eyebrow="Colour" title="Brand, one colour and mono">
          The brand version is Highland morning: a sun-gold stem, a forest-green
          arm and a ridge-blue leg, each from a deep end to a light one. The
          others take any colour: one colour fills every part, mono gives each
          part its own share of it.
        </SectionHeader>
        <div sx={styles.surfaces}>
          {SURFACES.map((s) => (
            <div
              key={s.label}
              sx={styles.surface}
              style={{ background: s.background, color: s.color }}
            >
              <KiranaMark
                variant={s.variant}
                sx={styles.surfaceMark}
                title={null}
              />
              <span sx={styles.surfaceLabel}>{s.label}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section tinted id="gradients">
        <SectionHeader eyebrow="Gradients" title="Colour sets to choose from">
          The reference's leg ends in a deep indigo that sinks into dark grounds
          — the editor's hints and a dark browser tab show it worst. Each set
          below is drawn large on paper and on ink, at 14 px in a dark editor's
          hint and at 16 px in a dark tab. Under each, every part's contrast
          with the ground: S, A and L for stem, arm and leg, flagged under 3 :
          1, the minimum for graphics. Every set copies or downloads as the mark
          alone, with no ground.
        </SectionHeader>
        <Palettes sets={PALETTES} chosen="ocean" />
      </Section>

      <Section id="scenery">
        <SectionHeader eyebrow="Scenery" title="Gradients from the landscapes">
          One set for each of the brand's landscapes, its colours taken from the
          picture: the light, the land and the sky. Each is made for the mark on
          its own landscape, and is judged here on the same four grounds. Copy
          or download any set as the mark alone, with no ground, to place it on
          a photo.
        </SectionHeader>
        <Palettes sets={SCENERY} />
      </Section>

      <Section tinted id="solids">
        <SectionHeader eyebrow="Solid colours" title="One flat colour per part">
          For print, embroidery, small sizes and anywhere a gradient cannot go:
          each part one colour, judged on the same four grounds.
        </SectionHeader>
        <Palettes sets={SOLIDS} />
      </Section>

      <Section id="one-colour">
        <SectionHeader eyebrow="One colour" title="All three petals alike">
          Every part the same colour, for stamps, monochrome print and any place
          a single ink is all there is. One colour fuses the leg into the arm,
          so the arm is outlined in the ground's colour: a 0.35u gap that keeps
          the three petals apart.
        </SectionHeader>
        <Palettes sets={ONE_COLOUR} />
      </Section>

      <Section tinted>
        <SectionHeader eyebrow="Size" title="From favicon to poster">
          The mark at the sizes it is used, and as an app icon on ink and on
          paper.
        </SectionHeader>
        <div sx={[sectionStyles.bordered, styles.sizes]}>
          {[16, 24, 32, 48, 64, 128].map((px) => (
            <div key={px} sx={styles.size}>
              <KiranaMark title={null} height={px} />
              <span sx={styles.sizeLabel}>{px}px</span>
            </div>
          ))}
          <div sx={styles.size}>
            <div sx={styles.icon} style={{ backgroundColor: INK }}>
              <KiranaMark sx={styles.iconMark} title={null} />
            </div>
            <span sx={styles.sizeLabel}>icon · ink</span>
          </div>
          <div sx={styles.size}>
            <div
              sx={styles.icon}
              style={{
                backgroundColor: PAPER,
                boxShadow: "inset 0 0 0 1px rgb(0 0 0 / 0.08)",
              }}
            >
              <KiranaMark sx={styles.iconMark} title={null} />
            </div>
            <span sx={styles.sizeLabel}>icon · paper</span>
          </div>
        </div>
      </Section>

      <Section>
        <SectionHeader eyebrow="In use" title="Beside the name">
          The mark with the wordmark, as the site's header draws them, on paper
          and on ink.
        </SectionHeader>
        <div sx={styles.bars2}>
          {[styles.headerLight, styles.headerDark].map((surface, index) => (
            <div key={index} sx={[styles.header, surface]}>
              <KiranaMark sx={styles.headerMark} title={null} />
              <Wordmark />
              <span sx={styles.headerNav}>
                <span>Docs</span>
                <span>Blog</span>
                <span>Sponsor</span>
              </span>
            </div>
          ))}
        </div>
      </Section>
      <Section tinted id="wording">
        <SectionHeader eyebrow="Wording" title="What we say beside the mark">
          Headlines and descriptions under review, each written to sell what
          only Kirana does — and each with the page that backs it, so no line
          claims more than the docs and the measurements show.
        </SectionHeader>
        <Wording />
      </Section>
    </>
  )
}
