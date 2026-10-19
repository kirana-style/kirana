/**
 * The hero: the claim and the ways in on the left; on the right the master scene, the highlands,
 * in pixels, dissolving into the paper towards the words, with a real component compiling on top
 * of it. The measured figures are further down the page, in one place (`proof.tsx`).
 */
import { Link } from "@tanstack/react-router"
import { css, props as styleProps } from "@kirana-style/core"
import { Css3Icon, FileCodeIcon } from "@hugeicons/core-free-icons"

import { accent } from "@workspace/docs-ui/accent.ts"
import { Button } from "@workspace/ui/components/button"
import { alpha, theme } from "@workspace/ui/theme/semantic"
import { breakpoint } from "@workspace/ui/tokens/breakpoints"
import { spacing } from "@workspace/ui/tokens/spacing"
import {
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
  textLeading,
  textSize,
  textTracking,
} from "@workspace/ui/tokens/typography"

import { DocsLink } from "@/components/docs-link"
import { Rail } from "@/components/site/patterns"
import { ScenePixels } from "@/components/site/scene-pixels"
import { GITHUB, NPM, VERSION } from "@/data/facts"
import { compact, useRepoStats } from "@/lib/repo-stats"
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
  // Behind the compile scene: under it on a phone, the right side of the hero from `lg` up.
  scene: css({
    position: "absolute",
    insetInline: { base: 0, [breakpoint.lg]: "auto 0" },
    insetBlockEnd: 0,
    insetBlockStart: { base: "auto", [breakpoint.lg]: 0 },
    insetInlineEnd: { [breakpoint.lg]: 0 },
    insetInlineStart: { [breakpoint.lg]: "auto" },
    width: { base: "100%", [breakpoint.lg]: "50%" },
    height: {
      base: "27rem",
      [breakpoint.sm]: "30rem",
      [breakpoint.lg]: "auto",
    },
  }),
  grid: css({
    position: "relative",
    display: "grid",
    gap: spacing[12],
    alignItems: "center",
    paddingInline: { base: spacing[5], [breakpoint.md]: spacing[10] },
    paddingBlockStart: { base: spacing[14], [breakpoint.md]: spacing[24] },
    paddingBlockEnd: { base: spacing[6], [breakpoint.lg]: spacing[24] },
    gridTemplateColumns: {
      base: "minmax(0, 1fr)",
      [breakpoint.lg]: "minmax(0, 1fr) minmax(0, 1fr)",
    },
  }),
  copy: css({
    display: "grid",
    gap: spacing[7],
    justifyItems: "start",
    // Clear of the scene's dissolving edge, so no pixel lands among the words.
    maxWidth: "33rem",
  }),
  label: css({
    display: "inline-flex",
    alignItems: "center",
    gap: spacing["2.5"],
    fontFamily: fontFamily.mono,
    fontSize: textSize.label,
    lineHeight: textLeading.label,
    letterSpacing: textTracking.label,
    textTransform: "uppercase",
    color: theme.foreground,
  }),
  pixel: css({
    width: "0.5rem",
    height: "0.5rem",
    backgroundColor: accent.base,
  }),
  title: css({
    fontFamily: fontFamily.heading,
    fontSize: textSize.display1,
    lineHeight: textLeading.display1,
    letterSpacing: textTracking.display1,
    fontWeight: fontWeight.normal,
    textWrap: "balance",
  }),
  titleAccent: css({
    display: "block",
    fontStyle: "italic",
    color: accent.base,
  }),
  lede: css({
    fontSize: textSize.lede,
    lineHeight: textLeading.lede,
    color: theme.mutedForeground,
    textWrap: "pretty",
  }),
  actions: css({ display: "flex", flexWrap: "wrap", gap: spacing[3] }),
  status: css({
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    color: theme.mutedForeground,
  }),
  statusRow: css({
    display: "flex",
    flexWrap: "wrap",
    alignItems: "baseline",
    columnGap: spacing[2],
    rowGap: spacing[1],
  }),
  statusLink: css({
    color: theme.foreground,
    textDecorationLine: "underline",
    textDecorationColor: alpha.foreground10,
    textUnderlineOffset: "4px",
  }),

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
}

/** Source in, one compile, atomic CSS out: what the claim beside it says. */
/**
 * The release and the project's public numbers, in one quiet line: the version on npm, last
 * week's downloads and the stars on GitHub once those answer, and the changelog.
 */
function Status() {
  const { downloads, stars } = useRepoStats()
  const dot = <span aria-hidden="true">·</span>
  return (
    <p sx={[styles.status, styles.statusRow]}>
      <a href={NPM} target="_blank" rel="noreferrer" sx={styles.statusLink}>
        v{VERSION} on npm
      </a>
      {downloads ? (
        <>
          {dot}
          <span>{compact(downloads)} downloads last week</span>
        </>
      ) : null}
      {stars ? (
        <>
          {dot}
          <a
            href={GITHUB}
            target="_blank"
            rel="noreferrer"
            sx={styles.statusLink}
          >
            {compact(stars)} stars on GitHub
          </a>
        </>
      ) : null}
      {dot}
      <DocsLink href="/changelog" sx={styles.statusLink}>
        Changelog
      </DocsLink>
    </p>
  )
}

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
          <Tile mark size={56} variant="accent" caption="kirana" />
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
    <header sx={styles.hero}>
      <Rail>
        <ScenePixels
          scene="highlands"
          priority
          dissolve="hero"
          fade={0.62}
          sx={styles.scene}
        />
        <div sx={styles.grid}>
          <div sx={styles.copy}>
            <p sx={styles.label}>
              <span sx={styles.pixel} aria-hidden="true" />
              CSS-in-JS, compiled
            </p>
            <h1 sx={styles.title}>
              Write objects. Read classes.
              <em sx={styles.titleAccent}>Ship CSS.</em>
            </h1>
            <p sx={styles.lede}>
              Typed style objects next to your components, compiled by a Rust
              engine into one atomic stylesheet. Mistakes become compile errors,
              and your editor shows every element&apos;s CSS on its line.
            </p>
            <div sx={styles.actions}>
              <Button
                size="lg"
                nativeButton={false}
                render={
                  <DocsLink href="/docs/start/quick-start">
                    Quick start
                  </DocsLink>
                }
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
            </div>
            <Status />
          </div>
          <CompileScene />
        </div>
      </Rail>
    </header>
  )
}
