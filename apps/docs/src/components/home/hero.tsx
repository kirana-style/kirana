/**
 * The hero: the claim and the ways in on the left, a real component on the
 * right, the measured figures underneath — all inside the rail, over a dither
 * field in the page's accent that fades out towards the copy.
 */
import { Link } from "@tanstack/react-router"
import { css, props as styleProps } from "@kirana-style/core"
import {
  ArrowRight01Icon,
  Css3Icon,
  FileCodeIcon,
  FlashIcon,
} from "@hugeicons/core-free-icons"

import { accents } from "@workspace/docs-ui/accent.ts"
import { Button } from "@workspace/ui/components/button"
import { Icon } from "@workspace/ui/primitives/icon"
import { alpha, radius, theme } from "@workspace/ui/theme/semantic"
import { breakpoint } from "@workspace/ui/tokens/breakpoints"
import { duration } from "@workspace/ui/tokens/motion"
import { spacing } from "@workspace/ui/tokens/spacing"
import {
  fontFamily,
  fontSize,
  fontWeight,
  letterSpacing,
  lineHeight,
} from "@workspace/ui/tokens/typography"

import { DocsLink } from "@/components/docs-link"
import { PixelField } from "@/components/site/pixel-field"
import { Rail, patterns } from "@/components/site/patterns"
import {
  At,
  Card,
  Row,
  Scene,
  Stage,
  T,
  Tag,
  Tile,
} from "@/components/site/visuals"

import { STATS } from "./content"

/**
 * One atomic rule per declaration, as the compiler wrote them for this site's
 * examples (`src/generated/examples.gen.ts`).
 */
const RULES = [
  { selector: ".k5O_fqMV", declaration: "display: grid" },
  { selector: ".k0_HV2H", declaration: "padding: 1rem" },
  { selector: ".k44_nLQ3", declaration: "background-color: var(--kv0RCR)" },
] as const

const styles = {
  hero: css({ position: "relative", overflow: "hidden" }),
  field: css({
    maskImage:
      "radial-gradient(ellipse 55% 75% at 100% 0%, black 5%, transparent 72%)",
  }),
  grid: css({
    position: "relative",
    display: "grid",
    gap: spacing[12],
    alignItems: "center",
    paddingInline: { base: spacing[5], [breakpoint.md]: spacing[10] },
    paddingBlockStart: { base: spacing[14], [breakpoint.md]: spacing[24] },
    paddingBlockEnd: { base: spacing[12], [breakpoint.md]: spacing[16] },
    gridTemplateColumns: {
      base: "minmax(0, 1fr)",
      [breakpoint.lg]: "minmax(0, 1.1fr) minmax(0, 0.9fr)",
    },
  }),
  copy: css({ display: "grid", gap: spacing[6], justifyItems: "start" }),
  pill: css({
    display: "inline-flex",
    alignItems: "center",
    gap: spacing[2],
    borderRadius: radius.full,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: theme.border,
    backgroundColor: theme.background,
    paddingInlineStart: spacing[1],
    paddingInlineEnd: spacing[3],
    paddingBlock: spacing[1],
    fontSize: fontSize.xs,
    lineHeight: lineHeight.xs,
    color: theme.mutedForeground,
    textDecorationLine: "none",
    transitionProperty: "border-color",
    transitionDuration: duration[150],
  }),
  pillHover: css({ borderColor: { ":hover": alpha.primary40 } }),
  pillTag: css({
    borderRadius: radius.full,
    backgroundColor: theme.primary,
    color: theme.primaryForeground,
    paddingInline: spacing[2],
    paddingBlock: "1px",
    fontWeight: fontWeight.semibold,
  }),
  title: css({
    fontFamily: fontFamily.heading,
    fontSize: { base: fontSize["5xl"], [breakpoint.md]: fontSize["7xl"] },
    lineHeight: { base: lineHeight["5xl"], [breakpoint.md]: lineHeight["7xl"] },
    fontWeight: fontWeight.bold,
    letterSpacing: letterSpacing.tighter,
    textWrap: "balance",
  }),
  titleMuted: css({ display: "block", color: theme.mutedForeground }),
  lede: css({
    maxWidth: "36rem",
    fontSize: { base: fontSize.lg, [breakpoint.md]: fontSize.xl },
    lineHeight: "1.6",
    color: theme.mutedForeground,
    textWrap: "pretty",
  }),
  actions: css({ display: "flex", flexWrap: "wrap", gap: spacing[3] }),

  // The compile scene: its own canvas, enlarged on wide screens where the
  // column has room, shrunk on phones where it does not.
  art: css({
    height: { base: "22rem", [breakpoint.sm]: "26rem" },
    marginInline: { base: `calc(${spacing[5]} * -1)`, [breakpoint.md]: 0 },
  }),
  artScene: css({
    scale: { base: "0.74", [breakpoint.sm]: "1", [breakpoint.xl]: "1.1" },
    // The canvas is wider than a phone; a smaller footprint lets the grid
    // centre it instead of starting it at the left edge.
    marginInline: { base: "-60px", [breakpoint.sm]: 0 },
  }),
  // A row lays its children out with a gap; source keeps its own spacing.
  line: css({ whiteSpace: "pre" }),

  stats: css({
    position: "relative",
    display: "grid",
    gridTemplateColumns: {
      base: "repeat(2, minmax(0, 1fr))",
      [breakpoint.lg]: "repeat(4, minmax(0, 1fr))",
    },
    gap: "1px",
    borderBlockStartWidth: "1px",
    borderBlockStartStyle: "solid",
    borderBlockStartColor: theme.border,
    backgroundColor: theme.border,
  }),
  stat: css({
    display: "grid",
    gap: spacing[1],
    alignContent: "start",
    paddingInline: { base: spacing[5], [breakpoint.md]: spacing[8] },
    paddingBlock: spacing[6],
    backgroundColor: { base: theme.background, ":hover": theme.card },
    textDecorationLine: "none",
    transitionProperty: "background-color",
    transitionDuration: duration[150],
  }),
  statFigure: css({
    fontFamily: fontFamily.numeric,
    fontSize: fontSize["3xl"],
    lineHeight: lineHeight["3xl"],
    fontWeight: fontWeight.semibold,
    color: theme.foreground,
  }),
  statText: css({
    fontSize: fontSize.sm,
    lineHeight: "1.55",
    color: theme.mutedForeground,
  }),
  hatchStrip: css({
    height: spacing[6],
    borderBlockStartWidth: "1px",
    borderBlockStartStyle: "solid",
    borderBlockStartColor: theme.border,
  }),
}

/** Source in, one compile, atomic CSS out: what the claim beside it says. */
export function CompileScene() {
  return (
    <Stage sx={styles.art}>
      <Scene
        width={440}
        height={380}
        sx={styles.artScene}
        wires={["M 254 104 H 332"]}
        live={["M 254 104 H 332", "M 361 134 V 222"]}
      >
        <At x={30} y={27}>
          <Card title="card.tsx" icon={FileCodeIcon} width={240}>
            <Row flat>
              <span sx={styles.line}>
                <T tone="prompt">const</T> styles = {"{"}
              </span>
            </Row>
            <Row flat>
              <span sx={styles.line}>
                {"  "}card: <T tone="info">css</T>({"{"}
              </span>
            </Row>
            <Row flat>
              <span sx={styles.line}>
                {"    "}display: <T tone="success">"grid"</T>,
              </span>
            </Row>
            <Row flat>
              <span sx={styles.line}>
                {"    "}padding: space[<T tone="success">4</T>],
              </span>
            </Row>
            <Row flat>
              <span sx={styles.line}>{"    "}backgroundColor: theme.card,</span>
            </Row>
            <Row flat>
              <span sx={styles.line}>{"  }),"}</span>
            </Row>
            <Row flat>
              <span sx={styles.line}>{"}"}</span>
            </Row>
          </Card>
        </At>
        <At x={82} y={27}>
          <Tile icon={FlashIcon} size={56} variant="accent" caption="kirana" />
        </At>
        <At x={50} y={79}>
          <Card
            title="kirana.css"
            icon={Css3Icon}
            width={350}
            glow
            extra={<Tag tone="success">at build time</Tag>}
          >
            {RULES.map((rule, i) => (
              <Row key={rule.selector} typed={i}>
                <span sx={styles.line}>
                  <T tone="prompt">{rule.selector}</T>
                  <T tone="muted">{" { "}</T>
                  <T tone="strong">{rule.declaration}</T>
                  <T tone="muted">{" }"}</T>
                </span>
              </Row>
            ))}
          </Card>
        </At>
      </Scene>
    </Stage>
  )
}

export function Hero() {
  return (
    <header sx={[styles.hero, accents.blue]}>
      <Rail>
        <PixelField sx={styles.field} opacity={0.5} />
        <div sx={styles.grid}>
          <div sx={styles.copy}>
            <DocsLink
              href="/docs/project/status"
              sx={[styles.pill, styles.pillHover]}
            >
              <span sx={styles.pillTag}>v0.1.0</span>
              Pre-release · not on npm yet
              <Icon icon={ArrowRight01Icon} size="0.75rem" />
            </DocsLink>
            <h1 sx={styles.title}>
              Write objects. Read classes.
              <span sx={styles.titleMuted}>Ship CSS.</span>
            </h1>
            <p sx={styles.lede}>
              CSS-in-JS with a Rust engine of its own. Start with plain style
              objects and grow into tokens and themes; Kirana compiles them into
              one atomic stylesheet at native speed, turns mistakes into compile
              errors, and shows every element's CSS on its line in your editor.
            </p>
            <div sx={styles.actions}>
              <Button
                size="lg"
                nativeButton={false}
                render={<DocsLink href="/docs">Read the docs</DocsLink>}
              />
              <Button
                size="lg"
                variant="outline"
                nativeButton={false}
                render={
                  <Link
                    to="/play"
                    search={{ example: undefined }}
                    {...styleProps()}
                  >
                    See it compile
                  </Link>
                }
              />
              <Button
                size="lg"
                variant="ghost"
                nativeButton={false}
                render={
                  <DocsLink href="/docs/start/why-kirana">Why Kirana?</DocsLink>
                }
              />
            </div>
          </div>
          <CompileScene />
        </div>
        <div sx={styles.stats}>
          {STATS.map((stat) => (
            <DocsLink key={stat.href} href={stat.href} sx={styles.stat}>
              <span sx={styles.statFigure}>{stat.title}</span>
              <span sx={styles.statText}>{stat.text}</span>
            </DocsLink>
          ))}
        </div>
        <div sx={[styles.hatchStrip, patterns.hatch]} aria-hidden="true" />
      </Rail>
    </header>
  )
}
