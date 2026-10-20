import { useState } from "react"
import { css } from "@kirana-style/core"
import { Cancel01Icon, Tick02Icon } from "@hugeicons/core-free-icons"

import { Button } from "@workspace/ui/components/button"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@workspace/ui/components/toggle-group"
import { SUN, accent, accents } from "@workspace/docs-ui/accent.ts"
import type { AccentName } from "@workspace/docs-ui/accent.ts"
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
  textLeading,
  textSize,
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
import { SCENES, sceneImage } from "@/brand/scenes"
import { sectionStyles } from "@/components/page-section"
import { chapter } from "@/components/site/chapter"
import { Accent, PageHero, PageSection } from "@/components/site/page"
import { PixelField } from "@/components/site/pixel-field"
import { Wordmark } from "@/components/site/wordmark"

/** Fixed surfaces for previews: a logo is shown on the surface it is made for. */
const SURFACE = {
  light: COLOURS.paper.hex,
  dark: COLOURS.ink.hex,
}

const styles = {
  // The idea
  ideas: css({
    display: "grid",
    gap: "1px",
    backgroundColor: theme.border,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: theme.border,
    borderRadius: radius.xl,
    overflow: "hidden",
    gridTemplateColumns: {
      base: "minmax(0, 1fr)",
      [breakpoint.md]: "repeat(3, minmax(0, 1fr))",
    },
  }),
  idea: css({
    display: "grid",
    gap: spacing[2],
    alignContent: "start",
    padding: spacing[6],
    backgroundColor: theme.card,
  }),
  ideaNumber: css({
    fontFamily: fontFamily.mono,
    fontSize: textSize.label,
    color: accent.base,
  }),
  ideaTitle: css({
    fontSize: textSize.subheading,
    lineHeight: textLeading.subheading,
    fontWeight: fontWeight.semibold,
  }),

  // The mark
  markGrid: css({
    display: "grid",
    gap: spacing[4],
    gridTemplateColumns: {
      base: "minmax(0, 1fr)",
      [breakpoint.xl]: "minmax(0, 3fr) minmax(0, 1fr)",
    },
  }),
  markPixels: css({
    position: "relative",
    minHeight: "16rem",
    borderRadius: radius.xl,
    backgroundColor: theme.card,
    overflow: "hidden",
  }),
  spanTwo: css({ gridColumn: { [breakpoint.md]: "span 2" } }),

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
    fontSize: fontSize.lg,
    lineHeight: lineHeight.lg,
    fontWeight: fontWeight.semibold,
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
    fontWeight: fontWeight.normal,
    letterSpacing: letterSpacing.tight,
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

  // Hues and scenes
  sunChip: css({ backgroundColor: SUN.sun }),
  hues: css({
    display: "grid",
    gap: "1px",
    backgroundColor: theme.border,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: theme.border,
    borderRadius: radius.xl,
    overflow: "hidden",
    gridTemplateColumns: {
      base: "repeat(2, minmax(0, 1fr))",
      [breakpoint.md]: "repeat(4, minmax(0, 1fr))",
      [breakpoint.xl]: "repeat(7, minmax(0, 1fr))",
    },
  }),
  hue: css({
    display: "grid",
    gap: spacing[2],
    alignContent: "start",
    padding: spacing[4],
    backgroundColor: theme.card,
  }),
  hueChip: css({
    height: spacing[12],
    borderRadius: radius.md,
    backgroundColor: accent.base,
  }),
  hueName: css({
    fontFamily: fontFamily.mono,
    fontSize: fontSize.sm,
    color: accent.base,
  }),
  scenes: css({
    display: "grid",
    gap: spacing[4],
    gridTemplateColumns: {
      base: "minmax(0, 1fr)",
      [breakpoint.sm]: "repeat(2, minmax(0, 1fr))",
      [breakpoint.lg]: "repeat(3, minmax(0, 1fr))",
    },
  }),
  scene: css({
    margin: 0,
    overflow: "hidden",
    borderRadius: radius.xl,
    backgroundColor: theme.card,
  }),
  sceneImage: css({
    width: "100%",
    aspectRatio: "16 / 9",
    objectFit: "cover",
  }),
  sceneCaption: css({
    display: "grid",
    gap: spacing["1.5"],
    padding: spacing[4],
  }),
  sceneName: css({
    display: "flex",
    alignItems: "center",
    gap: spacing[2],
    fontSize: textSize.subheading,
    fontWeight: fontWeight.semibold,
  }),
  huePixel: css({
    width: "0.5rem",
    height: "0.5rem",
    backgroundColor: accent.base,
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
          Kirana: styling, compiled
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

/** The mark's three gradients, Highland morning, as swatches. */
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

/** What makes a page Kirana's: the three things every page repeats. */
const IDEAS = [
  {
    title: "The landscape in pixels",
    text: "The page's picture, sampled cell by cell on the same 8 × 8 Bayer matrix as the pixel K, dissolving into the paper. A band of sun crosses it and the cells near the pointer light up; it holds still for reduced motion.",
  },
  {
    title: "Numbered chapters",
    text: "Every section opens with its number in the page's hue, its name in small mono capitals and a hairline, so a reader keeps their place.",
  },
  {
    title: "One italic word",
    text: "A headline in EB Garamond at its regular weight, with one word in italic in the page's hue.",
  },
]

/** The scene hues, each with what it is in the pictures. */
const HUES: { name: Exclude<AccentName, "neutral">; from: string }[] = [
  { name: "forest", from: "Forest on the ridges" },
  { name: "tea", from: "Tea rows and morning grass" },
  { name: "crater", from: "The pale water of a crater" },
  { name: "lake", from: "A lake under a clear sky" },
  { name: "terracotta", from: "Clay roof tiles" },
  { name: "ochre", from: "Lime-washed walls at evening" },
  { name: "dusk", from: "A city sky after sunset" },
]

const WRITING = [
  { term: "Meaning", text: "A ray of light." },
  {
    term: "In prose",
    text: "Kirana: never KIRANA, kirana or Kirana CSS. The lower case of the wordmark belongs to the drawing, not the name.",
  },
  {
    term: "In code",
    text: "Lower case: @kirana-style/core, kirana-style build.",
  },
  {
    term: "Product parts",
    text: "The Kirana compiler, the Kirana language server: descriptive, lower case after the name.",
  },
  {
    term: "Voice",
    text: "Plain words, the evidence next to the claim, numbers only with their source, costs said out loud. No em dashes, and no place is ever named.",
  },
]

/** The link at the end of a chapter's label row. */
const chapterAside = chapter.aside

export function BrandPage() {
  return (
    <>
      <PageHero
        label="Brand"
        title={
          <>
            Light through <Accent>every line</Accent>
          </>
        }
        lede="Kirana means a ray of light. The mark is three petals of the same width; the colours come from ten painted landscapes of one highland region at golden hour, and every page of this site stands in one of them."
        actions={
          <>
            <Button
              size="lg"
              nativeButton={false}
              render={
                <DocsLink href="/brand/mark">The mark in detail</DocsLink>
              }
            />
            <Button
              size="lg"
              variant="outline"
              nativeButton={false}
              render={<a href="#files">Download the files</a>}
            />
          </>
        }
      />

      <PageSection
        number="01"
        label="The idea"
        title="One light, ten places"
        lede="Every landscape is the same golden-hour light on a different place. Each page takes its colour from its place, and the light runs through all of them. Three things repeat on every page and make it Kirana's."
      >
        <div sx={styles.ideas}>
          {IDEAS.map((idea, index) => (
            <div key={idea.title} sx={styles.idea}>
              <span sx={styles.ideaNumber}>
                {String(index + 1).padStart(2, "0")}
              </span>
              <span sx={styles.ideaTitle}>{idea.title}</span>
              <span sx={styles.cardText}>{idea.text}</span>
            </div>
          ))}
        </div>
      </PageSection>

      <PageSection
        number="02"
        label="The mark"
        title="Three petals, one K"
        lede="Each part is a petal of the same width, 5u, so none outweighs the others. Together they read as a K and as light opening outward."
        aside={
          <DocsLink href="/brand/mark" sx={chapterAside}>
            Every circle and the formula
          </DocsLink>
        }
      >
        <div sx={styles.markGrid}>
          <div sx={styles.three}>
            {MEANING.map((item) => (
              <div key={item.title} sx={[sectionStyles.bordered, styles.card]}>
                <Glyph part={item.part} />
                <span sx={styles.cardTitle}>{item.title}</span>
                <span sx={styles.cardText}>{item.text}</span>
              </div>
            ))}
          </div>
          <div
            sx={[sectionStyles.bordered, styles.markPixels]}
            role="img"
            aria-label="The petal K in pixels, a ray of light passing through it"
          >
            <PixelField cell={6} density={0.62} opacity={1} />
          </div>
        </div>
      </PageSection>

      <PageSection
        id="surfaces"
        number="03"
        label="On every surface"
        title="One colour, any ground"
        lede="The mark large, at 16 to 48 px, on twelve surfaces and as an app icon. In one colour it takes whatever the surface needs: solid, gradient or photograph."
      >
        <Explorations />
      </PageSection>

      <PageSection
        id="files"
        number="04"
        label="Files"
        title="Logos, icons and favicons"
        lede="The mark in its brand colours, or in one colour: ink on light surfaces, paper on dark ones. Keep one part's width (5u, about a quarter of the mark's height) clear on every side; below 16 px, use the app icon."
      >
        <LogoAsset />
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
        <div sx={styles.three}>
          <div sx={[sectionStyles.bordered, styles.space]}>
            <div sx={styles.spaceBox}>
              <KiranaMark sx={styles.spaceMark} title={null} />
            </div>
          </div>
          <div sx={[sectionStyles.bordered, styles.sizes, styles.spanTwo]}>
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
              <span sx={styles.mono}>beside the name, 21 px</span>
            </div>
          </div>
        </div>
      </PageSection>

      <PageSection
        number="05"
        label="Colour"
        title="Paper, ink, and a hue for every place"
        lede="The site has no primary colour: it is paper and ink, and each page takes one hue from the landscape it stands in. The sun, the gold every landscape shares, is the one constant accent, and it is only ever a fill."
      >
        <div sx={styles.swatches}>
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
          <div sx={[sectionStyles.bordered, styles.swatch]}>
            <div sx={[styles.chip, styles.sunChip]} />
            <div sx={styles.swatchBody}>
              <span sx={styles.assetName}>Sun</span>
              <span sx={styles.mono}>A fill, never text</span>
            </div>
          </div>
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
                <span sx={styles.assetName}>
                  Mark, {swatch.label.toLowerCase()}
                </span>
                <span sx={styles.mono}>
                  {swatch.stops.map(([, colour]) => colour).join(" to ")}
                </span>
              </div>
            </div>
          ))}
        </div>
        <div sx={styles.hues}>
          {HUES.map((hue) => (
            <div key={hue.name} sx={[accents[hue.name], styles.hue]}>
              <span sx={styles.hueChip} />
              <span sx={styles.hueName}>{hue.name}</span>
              <span sx={styles.cardText}>{hue.from}</span>
            </div>
          ))}
        </div>
      </PageSection>

      <PageSection
        number="06"
        label="Type"
        title="Three faces, one job each"
        lede="A serif for what is said large, a sans for everything read, a mono for code and anything measured. The serif is only for 1.5rem and up, at its regular weight; one word of a headline may be italic."
      >
        <div sx={styles.specimens}>
          <div sx={[sectionStyles.bordered, styles.specimen]}>
            <div sx={styles.specimenHead}>
              <span sx={styles.assetName}>
                EB Garamond, display and headings
              </span>
              <span sx={styles.mono}>
                Georg Duffner and Octavio Pardo, SIL Open Font License
              </span>
            </div>
            <span sx={styles.displayType}>
              Styles in, <em>one stylesheet</em> out.
            </span>
            <span sx={styles.cardText}>
              An old-style serif after Claude Garamont's types, calm at 84 px
              and readable at 24. Its drawn italic carries the one accented word
              of a headline. The wordmark is Crimson Pro's italic, whose r stays
              an r at 22 px.
            </span>
          </div>
          <div sx={[sectionStyles.bordered, styles.specimen]}>
            <div sx={styles.specimenHead}>
              <span sx={styles.assetName}>
                Plus Jakarta Sans, text and interface
              </span>
              <span sx={styles.mono}>Tokotype, SIL Open Font License</span>
            </div>
            <p sx={styles.bodyType}>
              Write typed styles next to your components. Kirana compiles them
              into one small, predictable stylesheet and stays out of your
              runtime.
            </p>
            <span sx={styles.cardText}>
              Drawn by an Indonesian foundry; its tall x-height reads well at 14
              to 16 px.
            </span>
          </div>
          <div sx={[sectionStyles.bordered, styles.specimen]}>
            <div sx={styles.specimenHead}>
              <span sx={styles.assetName}>
                JetBrains Mono, code, labels and figures
              </span>
              <span sx={styles.mono}>JetBrains, SIL Open Font License</span>
            </div>
            <code sx={styles.codeType}>
              {"css({ paddingInline: space[4] })"}
            </code>
            <span sx={styles.cardText}>
              Clear 0 and O, 1 and l; the face the editor scenes show code in.
            </span>
          </div>
        </div>
      </PageSection>

      <PageSection
        number="07"
        label="Scenery"
        title="Every page stands somewhere"
        lede="Ten painted landscapes, all at golden hour. A page takes its hue, its hero and its footer from one of them. No copy names a place: a scene is described by what is in the picture."
      >
        <div sx={styles.scenes}>
          {Object.values(SCENES).map((scene) => (
            <figure
              key={scene.id}
              sx={[accents[scene.hue], sectionStyles.bordered, styles.scene]}
            >
              <img
                src={sceneImage(scene.id, 800)}
                alt={scene.alt}
                loading="lazy"
                decoding="async"
                style={{ objectPosition: scene.position }}
                sx={styles.sceneImage}
              />
              <figcaption sx={styles.sceneCaption}>
                <span sx={styles.sceneName}>
                  <span sx={styles.huePixel} aria-hidden="true" />
                  {scene.name}
                  <span sx={styles.mono}>{scene.hue}</span>
                </span>
                <span sx={styles.cardText}>{scene.uses}.</span>
                <span sx={styles.cardText}>{scene.reason}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </PageSection>

      <PageSection number="08" label="Usage" title="Do and don't">
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
      </PageSection>

      <PageSection number="09" label="Name and voice" title="Writing Kirana">
        <div sx={styles.nameRows}>
          {WRITING.map((row) => (
            <div key={row.term} sx={styles.nameRow}>
              <span sx={styles.assetName}>{row.term}</span>
              <span>{row.text}</span>
            </div>
          ))}
        </div>
      </PageSection>
    </>
  )
}
