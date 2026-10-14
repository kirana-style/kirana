import { useState } from "react"
import { css } from "@kirana-style/core"
import { Cancel01Icon, Tick02Icon } from "@hugeicons/core-free-icons"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@workspace/ui/components/toggle-group"
import { Icon } from "@workspace/ui/primitives/icon"
import { alpha, radius, theme } from "@workspace/ui/theme/semantic"
import { breakpoint } from "@workspace/ui/tokens/breakpoints"
import { spacing } from "@workspace/ui/tokens/spacing"
import {
  fontFamily,
  fontSize,
  fontWeight,
  letterSpacing,
  lineHeight,
} from "@workspace/ui/tokens/typography"

import { GRADIENTS, PAINT_ORDER, PARTS } from "@/brand/kirana-mark"
import type { Part } from "@/brand/kirana-mark"
import { KiranaMark } from "@/brand/kirana-mark-svg"
import { COLOURS, VARIANTS, fileName, toSvg } from "@/brand/logo"
import type { Lockup, Variant } from "@/brand/logo"
import { LogoSvg } from "@/brand/logo-svg"
import { DocsLink } from "@/components/docs-link"
import { CopyButton, DownloadButton } from "@/components/brand/asset-buttons"
import { Explorations } from "@/components/brand/explorations"
import { PixelField } from "@/components/site/pixel-field"
import { Wordmark } from "@/components/site/wordmark"
import {
  Section,
  SectionHeader,
  sectionStyles,
} from "@/components/page-section"

/** Fixed surfaces for previews: a logo is shown on the surface it is made for. */
const SURFACE = {
  light: COLOURS.paper.hex,
  dark: COLOURS.ink.hex,
}

const styles = {
  hero: css({ overflow: "hidden" }),
  heroGrid: css({
    display: "grid",
    gap: spacing[12],
    alignItems: "center",
    gridTemplateColumns: {
      base: "minmax(0, 1fr)",
      [breakpoint.lg]: "minmax(0, 1fr) minmax(0, 1fr)",
    },
  }),
  heroCopy: css({ display: "grid", gap: spacing[6], justifyItems: "start" }),
  title: css({
    fontFamily: fontFamily.heading,
    fontSize: { base: fontSize["5xl"], [breakpoint.md]: fontSize["6xl"] },
    lineHeight: { base: lineHeight["5xl"], [breakpoint.md]: lineHeight["6xl"] },
    fontWeight: fontWeight.bold,
    letterSpacing: letterSpacing.tighter,
  }),
  lede: css({
    maxWidth: "34rem",
    fontSize: { base: fontSize.lg, [breakpoint.md]: fontSize.xl },
    lineHeight: "1.6",
    color: theme.mutedForeground,
    textWrap: "pretty",
  }),
  // The K in pixels: the canvas fills it, the mark 84 % of its height.
  heroMark: css({
    position: "relative",
    aspectRatio: "1",
    width: "100%",
    maxWidth: "32rem",
    justifySelf: "center",
    // A soft Ocean glow behind the pixels, as the other heroes have in their accent.
    backgroundImage:
      "radial-gradient(closest-side, color-mix(in oklab, #3B82F6 14%, transparent), transparent)",
  }),

  // Meaning
  three: css({
    display: "grid",
    gap: spacing[4],
    gridTemplateColumns: {
      base: "minmax(0, 1fr)",
      [breakpoint.md]: "repeat(3, minmax(0, 1fr))",
    },
  }),
  card: css({
    display: "grid",
    gap: spacing[3],
    alignContent: "start",
    borderRadius: radius.xl,
    backgroundColor: theme.card,
    padding: spacing[6],
  }),
  cardTitle: css({
    fontFamily: fontFamily.heading,
    fontSize: fontSize.lg,
    lineHeight: lineHeight.lg,
    fontWeight: fontWeight.bold,
  }),
  cardText: css({
    fontSize: fontSize.sm,
    lineHeight: "1.65",
    color: theme.mutedForeground,
  }),
  glyph: css({
    width: spacing[16],
    height: spacing[16],
    color: theme.foreground,
  }),
  glyphPart: css({ opacity: 0.16 }),

  more: css({ display: "flex", marginBlockStart: spacing[6] }),

  // Downloads
  asset: css({
    overflow: "hidden",
    borderRadius: radius.xl,
    backgroundColor: theme.card,
  }),
  assetBar: css({
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing[3],
    padding: spacing[4],
  }),
  controls: css({ display: "flex", flexWrap: "wrap", gap: spacing[3] }),
  stage: css({
    display: "grid",
    placeItems: "center",
    minHeight: { base: "16rem", [breakpoint.md]: "22rem" },
    padding: spacing[10],
    transitionProperty: "background-color",
    transitionDuration: "200ms",
  }),
  stageLight: css({ backgroundColor: SURFACE.light }),
  stageDark: css({ backgroundColor: SURFACE.dark }),
  stageLogo: css({ maxWidth: "100%", width: "auto" }),
  stageMark: css({ height: "10rem" }),
  assetFoot: css({
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing[3],
    paddingInline: spacing[4],
    paddingBlock: spacing[3],
    borderTopWidth: "1px",
    borderTopStyle: "solid",
    borderTopColor: theme.border,
  }),
  assetName: css({
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    fontWeight: fontWeight.semibold,
  }),
  mono: css({
    fontFamily: fontFamily.mono,
    fontSize: fontSize.xs,
    lineHeight: lineHeight.xs,
    color: theme.mutedForeground,
  }),
  actions: css({ display: "flex", gap: spacing[2] }),

  icons: css({
    display: "grid",
    gap: spacing[4],
    gridTemplateColumns: {
      base: "minmax(0, 1fr)",
      [breakpoint.sm]: "repeat(3, minmax(0, 1fr))",
    },
  }),
  iconStage: css({
    display: "grid",
    placeItems: "center",
    paddingBlock: spacing[10],
  }),
  iconSvg: css({ width: spacing[24], height: spacing[24] }),
  tabs: css({
    display: "grid",
    gap: spacing[4],
    gridTemplateColumns: {
      base: "minmax(0, 1fr)",
      [breakpoint.md]: "repeat(2, minmax(0, 1fr))",
    },
  }),
  browser: css({
    display: "flex",
    alignItems: "center",
    gap: spacing[2],
    borderRadius: radius.lg,
    padding: spacing[3],
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
  }),
  tab: css({
    display: "flex",
    alignItems: "center",
    gap: spacing[2],
    borderRadius: radius.md,
    paddingInline: spacing[3],
    paddingBlock: spacing[2],
  }),
  tabIcon: css({ width: "16px", height: "16px" }),
  pngs: css({ display: "flex", flexWrap: "wrap", gap: spacing[2] }),

  // Clear space and size
  space: css({
    display: "grid",
    placeItems: "center",
    borderRadius: radius.xl,
    backgroundColor: theme.card,
    padding: spacing[10],
  }),
  spaceBox: css({
    position: "relative",
    // One part's width, 5u of the mark's 21.5u, clear on every side.
    padding: `calc(${spacing[24]} * ${5 / 21.5})`,
    outlineWidth: "1px",
    outlineStyle: "dashed",
    outlineColor: theme.mutedForeground,
    backgroundImage: `repeating-linear-gradient(45deg, ${alpha.primary20} 0 2px, transparent 2px 8px)`,
  }),
  spaceMark: css({ height: spacing[24], backgroundColor: theme.card }),
  sizes: css({
    display: "flex",
    flexWrap: "wrap",
    alignItems: "end",
    gap: spacing[8],
    borderRadius: radius.xl,
    backgroundColor: theme.card,
    padding: spacing[8],
  }),
  sizeItem: css({
    display: "grid",
    gap: spacing[2],
    justifyItems: "start",
    color: theme.foreground,
  }),

  // Colour
  swatches: css({
    display: "grid",
    gap: spacing[4],
    gridTemplateColumns: {
      base: "minmax(0, 1fr)",
      [breakpoint.sm]: "repeat(2, minmax(0, 1fr))",
      [breakpoint.lg]: "repeat(5, minmax(0, 1fr))",
    },
  }),
  swatch: css({
    overflow: "hidden",
    borderRadius: radius.xl,
    backgroundColor: theme.card,
  }),
  chip: css({ height: spacing[28] }),
  lockupRow: css({ display: "flex", alignItems: "center", gap: spacing[2] }),
  swatchBody: css({ display: "grid", gap: spacing[1], padding: spacing[4] }),

  // Type
  specimens: css({ display: "grid", gap: spacing[4] }),
  specimen: css({
    display: "grid",
    gap: spacing[3],
    borderRadius: radius.xl,
    backgroundColor: theme.card,
    padding: spacing[6],
  }),
  specimenHead: css({
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: spacing[2],
  }),
  displayType: css({
    fontFamily: fontFamily.heading,
    fontSize: { base: fontSize["4xl"], [breakpoint.md]: fontSize["6xl"] },
    lineHeight: { base: lineHeight["4xl"], [breakpoint.md]: lineHeight["6xl"] },
    fontWeight: fontWeight.bold,
    letterSpacing: letterSpacing.tighter,
  }),
  bodyType: css({
    maxWidth: "40rem",
    fontSize: fontSize.lg,
    lineHeight: "1.6",
  }),
  codeType: css({
    fontFamily: fontFamily.mono,
    fontSize: fontSize.base,
    lineHeight: "1.6",
  }),

  // Pattern
  patterns: css({
    display: "grid",
    gap: spacing[4],
    gridTemplateColumns: {
      base: "minmax(0, 1fr)",
      [breakpoint.md]: "repeat(2, minmax(0, 1fr))",
    },
  }),
  pattern: css({
    position: "relative",
    overflow: "hidden",
    minHeight: spacing[64],
    borderRadius: radius.xl,
    backgroundColor: theme.card,
  }),

  // Usage
  usage: css({
    display: "grid",
    gap: spacing[4],
    gridTemplateColumns: {
      base: "repeat(2, minmax(0, 1fr))",
      [breakpoint.md]: "repeat(4, minmax(0, 1fr))",
    },
  }),
  example: css({
    display: "grid",
    gridTemplateRows: "1fr auto",
    overflow: "hidden",
    borderRadius: radius.xl,
    backgroundColor: theme.card,
  }),
  exampleStage: css({
    display: "grid",
    placeItems: "center",
    minHeight: spacing[36],
    padding: spacing[6],
  }),
  exampleMark: css({ height: spacing[16] }),
  exampleNote: css({
    display: "flex",
    gap: spacing[2],
    alignItems: "flex-start",
    padding: spacing[4],
    fontSize: fontSize.sm,
    lineHeight: "1.5",
    borderTopWidth: "1px",
    borderTopStyle: "solid",
    borderTopColor: theme.border,
  }),
  good: css({ color: theme.foreground, marginBlockStart: "0.15em" }),
  bad: css({ color: theme.destructive, marginBlockStart: "0.15em" }),
  stretched: css({ transform: "scaleX(1.5)" }),
  rotated: css({ transform: "rotate(-18deg)" }),
  shadowed: css({ filter: "drop-shadow(4px 6px 0 #ef4444)" }),

  // Name
  nameRows: css({ display: "grid", gap: spacing[3], maxWidth: "48rem" }),
  nameRow: css({
    display: "grid",
    gridTemplateColumns: { base: "1fr", [breakpoint.sm]: "10rem 1fr" },
    gap: spacing[2],
    paddingBlockEnd: spacing[3],
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: theme.border,
    fontSize: fontSize.sm,
    lineHeight: "1.6",
  }),
}

/** The surface a variant belongs on: a paper mark on ink, the rest on paper. */
function surfaceFor(variant: Variant): "light" | "dark" {
  return variant.paint === "paper" ? "dark" : "light"
}

function LogoAsset() {
  const [id, setId] = useState("brand")
  const variant =
    VARIANTS.mark.find((candidate) => candidate.id === id) ?? VARIANTS.mark[0]!
  const name = fileName("mark", variant)

  return (
    <div sx={[sectionStyles.bordered, styles.asset]}>
      <div sx={styles.assetBar}>
        <div sx={styles.controls}>
          <ToggleGroup
            variant="outline"
            size="sm"
            value={[variant.id]}
            onValueChange={(value: string[]) => {
              if (value[0]) setId(value[0])
            }}
            aria-label="Colour"
          >
            {VARIANTS.mark.map((item) => (
              <ToggleGroupItem key={item.id} value={item.id}>
                {item.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </div>
      <div
        sx={[
          styles.stage,
          surfaceFor(variant) === "light"
            ? styles.stageLight
            : styles.stageDark,
        ]}
      >
        <LogoSvg
          lockup="mark"
          variant={variant}
          sx={[styles.stageLogo, styles.stageMark]}
          title={null}
        />
      </div>
      <AssetFoot
        lockup="mark"
        variant={variant}
        title={`Mark · ${variant.label}`}
        name={name}
      />
    </div>
  )
}

function AssetFoot({
  lockup,
  variant,
  title,
  name,
}: {
  lockup: Lockup
  variant: Variant
  title: string
  name: string
}) {
  return (
    <div sx={styles.assetFoot}>
      <div>
        <div sx={styles.assetName}>{title}</div>
        <div sx={styles.mono}>{name}</div>
      </div>
      <div sx={styles.actions}>
        <CopyButton text={toSvg(lockup, variant)} label={`Copy ${name}`} />
        <DownloadButton href={`/brand/${name}`} name={name} />
      </div>
    </div>
  )
}

function IconAssets() {
  return (
    <div sx={styles.icons}>
      {VARIANTS.icon.map((variant) => (
        <div key={variant.id} sx={[sectionStyles.bordered, styles.asset]}>
          <div sx={styles.iconStage}>
            <LogoSvg
              lockup="icon"
              variant={variant}
              sx={styles.iconSvg}
              title={null}
            />
          </div>
          <AssetFoot
            lockup="icon"
            variant={variant}
            title={`App icon · ${variant.label}`}
            name={fileName("icon", variant)}
          />
        </div>
      ))}
    </div>
  )
}

function BrowserTab({ mode }: { mode: "light" | "dark" }) {
  const dark = mode === "dark"
  return (
    <div
      sx={[sectionStyles.bordered, styles.asset]}
      style={{
        backgroundColor: dark ? "#202124" : "#dee1e6",
        color: dark ? "#e8eaed" : "#202124",
      }}
    >
      <div sx={styles.browser}>
        <div
          sx={styles.tab}
          style={{
            backgroundColor: dark ? "#35363a" : "#ffffff",
            color: dark ? "#e8eaed" : "#202124",
          }}
        >
          <LogoSvg
            lockup="square"
            variant={VARIANTS.square[0]!}
            sx={styles.tabIcon}
            title={null}
          />
          Kirana — styling, compiled
        </div>
      </div>
      <div sx={styles.assetFoot}>
        <div>
          <div sx={styles.assetName}>
            Favicon · {dark ? "dark" : "light"} browser
          </div>
          <div sx={styles.mono}>favicon.svg · favicon.ico</div>
        </div>
      </div>
    </div>
  )
}

const MEANING: { title: string; text: string; part: Part }[] = [
  {
    title: "The stem",
    text: "Upright, its top a quarter circle as wide as the stem: the K's spine, and the first petal.",
    part: "stem",
  },
  {
    title: "The arm",
    text: "A petal that rises to the top-right corner and shares one edge with the stem: light opening outward.",
    part: "arm",
  },
  {
    title: "The leg",
    text: "A rounded band at 36°, the golden triangle's angle, tucked under the arm: the K's step forward.",
    part: "leg",
  },
]

/** The mark with one part in full and the others faint. */
function Glyph({ part }: { part: Part }) {
  return (
    <svg viewBox="-0.2 -0.2 16.4 21.4" sx={styles.glyph} aria-hidden="true">
      <g fill="currentColor">
        {/* The faint parts first, so the one in full is never under them. */}
        {[...PAINT_ORDER.filter((item) => item !== part), part].map((item) => (
          <path
            key={item}
            d={PARTS[item]}
            sx={item === part ? null : styles.glyphPart}
          />
        ))}
      </g>
    </svg>
  )
}

/** The three Ocean gradients, as swatches. */
const GRADIENT_SWATCHES = (["stem", "arm", "leg"] as const).map((part) => ({
  part,
  label: `${part[0]!.toUpperCase()}${part.slice(1)}`,
  stops: GRADIENTS[part].stops,
}))

const DOS = [
  {
    text: "The gradients on light surfaces.",
    variant: "brand",
    background: SURFACE.light,
    colour: COLOURS.ink.hex,
  },
  {
    text: "The gradients on dark surfaces.",
    variant: "brand",
    background: SURFACE.dark,
    colour: COLOURS.paper.hex,
  },
  {
    text: "Ink, in one colour, on light.",
    variant: "solid",
    background: SURFACE.light,
    colour: COLOURS.ink.hex,
  },
  {
    text: "Paper, in one colour, on dark.",
    variant: "solid",
    background: SURFACE.dark,
    colour: COLOURS.paper.hex,
  },
] as const

const DONTS = [
  {
    text: "Stretch or squash it.",
    sx: styles.stretched,
    colour: theme.foreground,
  },
  { text: "Rotate it.", sx: styles.rotated, colour: theme.foreground },
  { text: "Recolour it outside the palette.", sx: null, colour: "#3b82f6" },
  {
    text: "Add shadows, outlines or effects.",
    sx: styles.shadowed,
    colour: theme.foreground,
  },
]

export function BrandPage() {
  return (
    <>
      <Section sx={styles.hero}>
        <div sx={styles.heroGrid}>
          <div sx={styles.heroCopy}>
            <Badge variant="secondary">Brand guide</Badge>
            <h1 sx={styles.title}>Light through every line</h1>
            <p sx={styles.lede}>
              The logo is the petal K: three petals — a stem, an arm and a leg —
              drawn from a grid and Fibonacci circles, each the same width and
              showing the same weight, in Ocean's cyan, blue and indigo. Kirana
              means a ray of light. The typefaces are still open.
            </p>
            <Button
              size="lg"
              nativeButton={false}
              render={<a href="#surfaces">See it on every surface</a>}
            />
          </div>
          <div
            sx={styles.heroMark}
            role="img"
            aria-label="The petal K in pixels, a ray of light passing through it"
          >
            <PixelField pattern="mark" cell={7} density={0.62} opacity={1} />
          </div>
        </div>
      </Section>

      <Section id="surfaces">
        <SectionHeader
          eyebrow="On every surface"
          title="One colour, any ground"
        >
          The mark large, at 16 to 48 px, on twelve surfaces and as an app icon.
          In one colour it takes whatever the surface needs — solid, gradient or
          photograph.
        </SectionHeader>
        <Explorations />
      </Section>

      <Section tinted>
        <SectionHeader eyebrow="Meaning" title="Three petals, one K">
          Each part is a petal of the same width, 5u, so none outweighs the
          others. Together they read as a K and as light opening outward —
          Kirana means a ray of light.
        </SectionHeader>
        <div sx={styles.three}>
          {MEANING.map((item) => (
            <div key={item.title} sx={[sectionStyles.bordered, styles.card]}>
              <Glyph part={item.part} />
              <span sx={styles.cardTitle}>{item.title}</span>
              <span sx={styles.cardText}>{item.text}</span>
            </div>
          ))}
        </div>
        <div sx={styles.more}>
          <Button
            variant="outline"
            nativeButton={false}
            render={
              <DocsLink href="/brand/mark">
                The grid, every circle and the formula
              </DocsLink>
            }
          />
        </div>
      </Section>

      <Section id="logos">
        <SectionHeader eyebrow="Assets" title="Logos">
          The mark in its brand gradients, or in one colour: ink on light
          surfaces, paper on dark ones. A drawn wordmark will join it once the
          typeface is chosen; until then the name is set beside the mark.
        </SectionHeader>
        <LogoAsset />
        <SectionHeader eyebrow="Assets" title="App icons and favicons">
          The mark on a rounded square, for avatars, app icons and the editor
          extensions. Browser tabs show the mark alone: its gradients read on
          light and dark tabs alike.
        </SectionHeader>
        <IconAssets />
        <div sx={styles.tabs}>
          <BrowserTab mode="light" />
          <BrowserTab mode="dark" />
        </div>
        <div sx={styles.pngs}>
          <DownloadButton
            href="/favicon.svg"
            name="favicon.svg"
            label="favicon.svg"
          />
          <DownloadButton
            href="/favicon.ico"
            name="favicon.ico"
            label="favicon.ico"
          />
          <DownloadButton
            href="/brand/kirana-square-brand.svg"
            name="kirana-square-brand.svg"
            label="kirana-square-brand.svg"
          />
          <DownloadButton
            href="/apple-touch-icon.png"
            name="apple-touch-icon.png"
            label="apple-touch-icon.png"
          />
          <DownloadButton
            href="/icon-512.png"
            name="icon-512.png"
            label="icon-512.png"
          />
        </div>
      </Section>

      <Section tinted>
        <SectionHeader eyebrow="Space and size" title="Give it room">
          Keep one part's width (5u, about a quarter of the mark's height) clear
          on every side. The mark holds its shape down to 16 px; below that, use
          the app icon.
        </SectionHeader>
        <div sx={styles.three}>
          <div sx={[sectionStyles.bordered, styles.space]}>
            <div sx={styles.spaceBox}>
              <KiranaMark sx={styles.spaceMark} title={null} />
            </div>
          </div>
          <div
            sx={[sectionStyles.bordered, styles.sizes]}
            style={{ gridColumn: "span 2" }}
          >
            {[16, 24, 32, 48].map((size) => (
              <div key={size} sx={styles.sizeItem}>
                <KiranaMark title={null} height={size} />
                <span sx={styles.mono}>{size} px</span>
              </div>
            ))}
            <div sx={styles.sizeItem}>
              <span sx={styles.lockupRow}>
                <KiranaMark variant="solid" title={null} height={21} />
                <Wordmark />
              </span>
              <span sx={styles.mono}>beside the name · 21 px</span>
            </div>
          </div>
        </div>
      </Section>

      <Section>
        <SectionHeader eyebrow="Colour" title="Ocean, and neutrals">
          The brand gradients are Ocean: cyan, blue and indigo, each with a
          light end so every part holds on paper, on ink and in a dark editor.
          They mark what should stand out — the favicon, app icons, the editor
          extensions. The header and the docs draw the mark in one colour, and
          the site itself runs on neutrals.
        </SectionHeader>
        <div sx={styles.swatches}>
          {GRADIENT_SWATCHES.map((swatch) => (
            <div key={swatch.part} sx={[sectionStyles.bordered, styles.swatch]}>
              <div
                sx={styles.chip}
                style={{
                  backgroundImage: `linear-gradient(135deg, ${swatch.stops
                    .map(([offset, colour]) => `${colour} ${offset * 100}%`)
                    .join(", ")})`,
                }}
              />
              <div sx={styles.swatchBody}>
                <span sx={styles.assetName}>{swatch.label}</span>
                <span sx={styles.mono}>
                  {swatch.stops.map(([, colour]) => colour).join(" → ")}
                </span>
              </div>
            </div>
          ))}
          {Object.values(COLOURS).map((colour) => (
            <div
              key={colour.label}
              sx={[sectionStyles.bordered, styles.swatch]}
            >
              <div sx={styles.chip} style={{ backgroundColor: colour.hex }} />
              <div sx={styles.swatchBody}>
                <span sx={styles.assetName}>{colour.label}</span>
                <span sx={styles.mono}>{colour.hex}</span>
                <span sx={styles.mono}>{colour.oklch}</span>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section tinted>
        <SectionHeader eyebrow="Type" title="Not decided">
          The faces the site uses today, still to be settled: Cormorant Garamond
          for headings and the wordmark, Inter for text, JetBrains Mono for code
          and figures.
        </SectionHeader>
        <div sx={styles.specimens}>
          <div sx={[sectionStyles.bordered, styles.specimen]}>
            <div sx={styles.specimenHead}>
              <span sx={styles.assetName}>Cormorant Garamond · headings</span>
              <span sx={styles.mono}>SIL Open Font License</span>
            </div>
            <span sx={styles.displayType}>Styling, compiled.</span>
          </div>
          <div sx={[sectionStyles.bordered, styles.specimen]}>
            <div sx={styles.specimenHead}>
              <span sx={styles.assetName}>Inter · text</span>
              <span sx={styles.mono}>SIL Open Font License</span>
            </div>
            <p sx={styles.bodyType}>
              Write typed styles next to your components. Kirana compiles them
              into small, predictable CSS and stays out of your runtime.
            </p>
          </div>
          <div sx={[sectionStyles.bordered, styles.specimen]}>
            <div sx={styles.specimenHead}>
              <span sx={styles.assetName}>
                JetBrains Mono · code and figures
              </span>
              <span sx={styles.mono}>SIL Open Font License</span>
            </div>
            <code sx={styles.codeType}>
              {"css({ paddingInline: space[4] })"}
            </code>
          </div>
        </div>
      </Section>

      <Section>
        <SectionHeader eyebrow="Pattern" title="Light in pixels">
          Square pixels, dithered on an 8 × 8 matrix and moving slowly. Every
          page's hero has a field in its accent — clouds, waves, rings or rain;
          the brand's own is the K, each pixel in its petal's Ocean colour, with
          a ray of light passing through and the pixels near the pointer
          lighting up. It pauses off screen and holds still for reduced motion.
          It is a texture, never a logo.
        </SectionHeader>
        <div sx={styles.patterns}>
          <div sx={[sectionStyles.bordered, styles.pattern]}>
            <PixelField pattern="clouds" density={0.6} opacity={0.7} />
          </div>
          <div sx={[sectionStyles.bordered, styles.pattern]}>
            <PixelField pattern="mark" cell={5} density={0.62} opacity={1} />
          </div>
        </div>
      </Section>

      <Section tinted>
        <SectionHeader eyebrow="Usage" title="Do and don't" />
        <div sx={styles.usage}>
          {DOS.map((item) => (
            <div key={item.text} sx={[sectionStyles.bordered, styles.example]}>
              <div
                sx={styles.exampleStage}
                style={{ backgroundColor: item.background, color: item.colour }}
              >
                <KiranaMark
                  variant={item.variant}
                  sx={styles.exampleMark}
                  title={null}
                />
              </div>
              <div sx={styles.exampleNote}>
                <Icon icon={Tick02Icon} size="1rem" sx={styles.good} />
                {item.text}
              </div>
            </div>
          ))}
          {DONTS.map((item) => (
            <div key={item.text} sx={[sectionStyles.bordered, styles.example]}>
              <div sx={styles.exampleStage} style={{ color: item.colour }}>
                <KiranaMark
                  variant="solid"
                  sx={[styles.exampleMark, item.sx]}
                  title={null}
                />
              </div>
              <div sx={styles.exampleNote}>
                <Icon icon={Cancel01Icon} size="1rem" sx={styles.bad} />
                {item.text}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section>
        <SectionHeader eyebrow="Name" title="Writing Kirana" />
        <div sx={styles.nameRows}>
          <div sx={styles.nameRow}>
            <span sx={styles.assetName}>Meaning</span>
            <span>A ray of light. Pronounced kee-RAH-nah.</span>
          </div>
          <div sx={styles.nameRow}>
            <span sx={styles.assetName}>In prose</span>
            <span>
              “Kirana” — never “KIRANA”, “kirana” or “Kirana CSS”. The capitals
              of the wordmark belong to the drawing, not the name.
            </span>
          </div>
          <div sx={styles.nameRow}>
            <span sx={styles.assetName}>In code</span>
            <span>
              Lowercase: <code sx={styles.mono}>@kirana-style/core</code>,{" "}
              <code sx={styles.mono}>kirana build</code>.
            </span>
          </div>
          <div sx={styles.nameRow}>
            <span sx={styles.assetName}>Product parts</span>
            <span>
              “Kirana compiler”, “Kirana language server” — descriptive,
              lowercase after the name.
            </span>
          </div>
        </div>
      </Section>
    </>
  )
}
