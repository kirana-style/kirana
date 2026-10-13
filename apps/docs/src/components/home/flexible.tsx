/**
 * "Fits the project": the three ways to start — plain `css()`, Tailwind's system compiled, a
 * design system of your own — the choices Kirana leaves to you, why agents write it well, and the
 * measured numbers, each from `packages/kirana/design-notes/benchmark-results.md` or the docs that cite it.
 */
import { css } from "@kirana-style/core"
import {
  AiBrain02Icon,
  CodeIcon,
  CommandLineIcon,
  DashboardSpeed01Icon,
  FileScriptIcon,
  FlashIcon,
  GlobalIcon,
  Layers01Icon,
  PackageIcon,
  PaintBoardIcon,
  VisualStudioCodeIcon,
} from "@hugeicons/core-free-icons"

import { BrandIcon } from "@workspace/docs-ui/brand-icon.tsx"
import { accent, tint } from "@workspace/docs-ui/accent.ts"
import type { AccentName } from "@workspace/docs-ui/accent.ts"
import { Icon } from "@workspace/ui/primitives/icon"
import type { IconProps } from "@workspace/ui/primitives/icon"
import { radius, theme } from "@workspace/ui/theme/semantic"
import { breakpoint } from "@workspace/ui/tokens/breakpoints"
import { spacing } from "@workspace/ui/tokens/spacing"
import {
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
} from "@workspace/ui/tokens/typography"

import { SHOWCASE } from "@/generated/showcase.gen"
import { IllustratedCard } from "@/components/site/illustrated-card"
import { At, Card, Row, Scene, T, Tile } from "@/components/site/visuals"
import { DIAGNOSTICS } from "@/generated/diagnostics.gen"
import { SVGL } from "@/generated/svgl-icons.gen"

import { HomeSection } from "./frame"

// Every card is the site's illustrated card (components/site/illustrated-card.tsx):
// a scene from the illustration kit above, the title and text below.
const styles = {
  paths: css({
    display: "grid",
    gap: spacing[4],
    gridTemplateColumns: {
      base: "minmax(0, 1fr)",
      [breakpoint.lg]: "repeat(3, minmax(0, 1fr))",
    },
  }),
  columns: css({
    display: "grid",
    gap: spacing[4],
    gridTemplateColumns: {
      base: "minmax(0, 1fr)",
      [breakpoint.lg]: "repeat(2, minmax(0, 1fr))",
    },
  }),
  // A code window in a card's scene: the snippet, highlighted at build time.
  window: css({ width: "min(19rem, 100%)" }),
  code: css({
    margin: 0,
    paddingInline: spacing[3],
    paddingBlock: spacing["2.5"],
    fontFamily: fontFamily.mono,
    fontSize: "0.6875rem",
    lineHeight: "1.65",
    whiteSpace: "pre",
    overflowX: "auto",
    scrollbarWidth: "none",
  }),
  fit: css({
    fontSize: fontSize.xs,
    lineHeight: lineHeight.xs,
    fontWeight: fontWeight.medium,
    color: accent.base,
  }),
  // A card's list: a name and its line, hairlines between.
  list: css({ display: "grid", marginBlockStart: spacing[1] }),
  item: css({
    display: "grid",
    gridTemplateColumns: {
      base: "minmax(0, 1fr)",
      [breakpoint.sm]: "7.5rem minmax(0, 1fr)",
    },
    gap: { base: spacing[1], [breakpoint.sm]: spacing[4] },
    paddingBlock: spacing[3],
    borderBlockStartWidth: "1px",
    borderBlockStartStyle: "solid",
    borderBlockStartColor: theme.border,
  }),
  itemName: css({
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    fontWeight: fontWeight.semibold,
    color: theme.foreground,
  }),
  itemText: css({
    fontSize: fontSize.sm,
    lineHeight: "1.6",
    color: theme.mutedForeground,
  }),
  logos: css({
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing[2],
  }),
  // The numbers: cells split by hairline gutters, each led by what it measures.
  stats: css({
    display: "grid",
    gap: "1px",
    overflow: "hidden",
    borderRadius: radius.xl,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: theme.border,
    backgroundColor: theme.border,
    gridTemplateColumns: {
      base: "repeat(2, minmax(0, 1fr))",
      [breakpoint.md]: "repeat(3, minmax(0, 1fr))",
      [breakpoint.xl]: "repeat(6, minmax(0, 1fr))",
    },
  }),
  stat: css({
    position: "relative",
    display: "grid",
    alignContent: "start",
    gap: spacing[2],
    padding: spacing[5],
    backgroundColor: theme.card,
    backgroundImage: `radial-gradient(120% 80% at 100% 0%, ${tint(7)}, transparent 60%)`,
  }),
  statHead: css({
    display: "flex",
    alignItems: "center",
    gap: spacing[2],
    fontSize: "0.6875rem",
    fontWeight: fontWeight.semibold,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: theme.mutedForeground,
  }),
  statIcon: css({
    display: "grid",
    placeItems: "center",
    width: "1.5rem",
    height: "1.5rem",
    borderRadius: radius.md,
    backgroundColor: tint(12),
    color: accent.base,
  }),
  statValue: css({
    fontFamily: fontFamily.numeric,
    fontSize: { base: fontSize["2xl"], [breakpoint.md]: fontSize["3xl"] },
    lineHeight: { base: lineHeight["2xl"], [breakpoint.md]: lineHeight["3xl"] },
    fontWeight: fontWeight.semibold,
    color: theme.foreground,
    fontVariantNumeric: "tabular-nums",
  }),
  statText: css({
    fontSize: fontSize.sm,
    lineHeight: "1.55",
    color: theme.mutedForeground,
  }),
}

type Path = {
  step: string
  title: string
  accent: AccentName
  text: string
  /** The snippet under `showcase/`, highlighted at build time. */
  snippet: string
  fit: string
  /** Where to read on, and its pill's label. */
  href: string
  more: string
  /** The file the snippet is shown as. */
  file: string
}

const PATHS: readonly Path[] = [
  {
    step: "Start small",
    title: "Just css()",
    accent: "emerald",
    text: "No configuration, no tokens, no vocabulary to learn: real CSS property names in typed objects, next to the component.",
    snippet: "path-css",
    fit: "A small app, a landing page, a widget.",
    href: "/docs/start/quick-start",
    more: "Quick start",
    file: "card.tsx",
  },
  {
    step: "Tailwind's system",
    title: "The preset, compiled",
    accent: "sky",
    text: "@kirana-style/preset-scales brings Tailwind v4's scales as tokens and its names as utility strings — or migrate an app with kirana migrate tailwind.",
    snippet: "path-preset",
    fit: "A team that already thinks in Tailwind.",
    href: "/docs/tokens/preset-scales",
    more: "The scales preset",
    file: "nav.tsx",
  },
  {
    step: "Your rules",
    title: "A design system of your own",
    accent: "violet",
    text: "Your tokens and recipes, as small or as opinionated as you want: a primitive palette with semantic tokens over it, or semantic tokens alone.",
    snippet: "path-system",
    fit: "A product with a brand, or a component library.",
    href: "/docs/advanced/design-system",
    more: "A design system",
    file: "theme.ts",
  },
]

const CHOICES: readonly { name: string; text: React.ReactNode }[] = [
  {
    name: "Tokens",
    text: "A primitive scale with semantic tokens on top, as Tailwind and shadcn do — or semantic tokens only, written straight as light-dark() pairs. Both compile to the same kind of CSS.",
  },
  {
    name: "Strictness",
    text: "Errors fail the build. Warnings are yours to re-level, and the lint plugin's strict config adds property order, token use and variant hygiene when a team wants it.",
  },
  {
    name: "Syntax",
    text: "Objects, utility strings, or both in one sx array — they compile to the same atoms.",
  },
  {
    name: "Frameworks",
    text: (
      <span sx={styles.logos}>
        {[
          SVGL.react,
          SVGL.nextjs,
          SVGL.preact,
          SVGL.solidjs,
          SVGL.vue,
          SVGL.nuxt,
          SVGL.svelte,
          SVGL.astro,
          SVGL.qwik,
          SVGL.angular,
          SVGL.reactrouter,
          SVGL.ember,
          SVGL.laravel,
          SVGL.tanstack,
        ].map((icon) => (
          <BrandIcon
            key={icon.title}
            icon={icon}
            size="1.25rem"
            label={icon.title}
          />
        ))}
      </span>
    ),
  },
  {
    name: "Bundlers",
    text: (
      <span sx={styles.logos}>
        {[
          SVGL.vite,
          SVGL.rolldown,
          SVGL.rspack,
          SVGL.rsbuild,
          SVGL.webpack,
          SVGL.esbuild,
          SVGL.bun,
          SVGL.jest,
        ].map((icon) => (
          <BrandIcon
            key={icon.title}
            icon={icon}
            size="1.25rem"
            label={icon.title}
          />
        ))}
      </span>
    ),
  },
  {
    name: "Tooling",
    text: (
      <span sx={styles.logos}>
        {[
          SVGL.vscode,
          SVGL.cursor,
          SVGL.antigravity,
          SVGL.zed,
          SVGL.neovim,
          SVGL.oxc,
          SVGL.eslint,
        ].map((icon) => (
          <BrandIcon
            key={icon.title}
            icon={icon}
            size="1.25rem"
            label={icon.title}
          />
        ))}
      </span>
    ),
  },
]

const STATS: readonly {
  kind: string
  icon: IconProps["icon"]
  value: string
  label: string
}[] = [
  {
    kind: "Build",
    icon: DashboardSpeed01Icon,
    value: "2.7×",
    label: "faster builds than StyleX on the same three apps",
  },
  {
    kind: "CSS",
    icon: FileScriptIcon,
    value: "61.7 kB",
    label: "of CSS for three apps, gzipped — less than StyleX",
  },
  {
    kind: "Runtime",
    icon: PackageIcon,
    value: "< 1 kB",
    label: "of runtime, only when styles merge or bridge",
  },
  {
    kind: "Browser",
    icon: GlobalIcon,
    value: "3.1–3.7×",
    label: "less style recalculation in the browser than Tailwind",
  },
  {
    kind: "Dev",
    icon: FlashIcon,
    value: "36.8 ms",
    label: "from an edit to the updated stylesheet",
  },
  {
    kind: "Editor",
    icon: VisualStudioCodeIcon,
    value: "1.2 ms",
    label: "for a hover in the editor, at the 95th percentile",
  },
]

const AGENT_POINTS: readonly { title: string; text: string }[] = [
  {
    title: "Nothing new to learn",
    text: "Styles are CSS properties and selectors a model already knows — no class vocabulary to hallucinate.",
  },
  {
    title: "Wrong code does not compile",
    text: `Property names and values are typed, and ${DIAGNOSTICS.length} diagnostics with stable codes say what is wrong and how to fix it.`,
  },
  {
    title: "Feedback it can read",
    text: "kirana check --format json, the lint plugins and the language server report machine-readably, at the line; kirana export lists the tokens and recipes that exist.",
  },
  {
    title: "Skills and docs it can load",
    text: "Two agent skills it installs with npx skills add, and llms.txt, llms-full.txt and a markdown twin of every page.",
  },
  {
    title: "Its pick of scale",
    text: "Plain css() for a prototype, the Tailwind preset when it reaches for utilities, your tokens when the project has rules.",
  },
]

const pathIcon: Record<string, IconProps["icon"]> = {
  "Start small": CodeIcon,
  "Tailwind's system": PaintBoardIcon,
  "Your rules": Layers01Icon,
}

/** A path's scene: its snippet in a code window, highlighted at build time. */
function CodeArt({ path }: { path: Path }) {
  return (
    <Card title={path.file} icon={CodeIcon} glow sx={styles.window}>
      <pre sx={styles.code} data-slot="code-block-source">
        <code
          dangerouslySetInnerHTML={{ __html: SHOWCASE[path.snippet]!.html }}
        />
      </pre>
    </Card>
  )
}

/** The choices: one engine at the centre, the frameworks around it. */
function ChoicesArt() {
  const left = [SVGL.react, SVGL.vue, SVGL.svelte] as const
  const right = [SVGL.nextjs, SVGL.astro, SVGL.solidjs] as const
  const ys = [24, 70, 116]
  return (
    <Scene
      width={300}
      height={140}
      wires={ys.flatMap((y) => [
        `M 62 ${y} C 100 ${y}, 110 70, 128 70`,
        `M 238 ${y} C 200 ${y}, 190 70, 172 70`,
      ])}
      live={["M 62 70 H 128", "M 238 70 H 172"]}
    >
      {left.map((brand, index) => (
        <At key={brand.title} x={14} y={(ys[index]! / 140) * 100}>
          <Tile brand={brand} size={36} />
        </At>
      ))}
      <At x={50} y={50}>
        <Tile icon={Layers01Icon} size={50} variant="accent" caption="kirana" />
      </At>
      {right.map((brand, index) => (
        <At key={brand.title} x={86} y={(ys[index]! / 140) * 100}>
          <Tile brand={brand} size={36} />
        </At>
      ))}
    </Scene>
  )
}

/** What an agent works with: a check it can parse. */
function AgentsArt() {
  return (
    <Card title="~/app" icon={CommandLineIcon} glow sx={styles.window}>
      <Row flat typed={0}>
        <T tone="prompt">$</T>
        <T tone="strong">kirana check src --format json</T>
      </Row>
      <Row flat typed={1}>
        <T tone="muted">{"[{"}</T>
      </Row>
      <Row flat typed={2}>
        <T tone="info">{'  "code"'}</T>
        <T>{': "KRN1203",'}</T>
      </Row>
      <Row flat typed={3}>
        <T tone="info">{'  "name"'}</T>
        <T>{': "unitless-length",'}</T>
      </Row>
      <Row flat typed={4}>
        <T tone="info">{'  "help"'}</T>
        <T tone="success">{': ["write 5px"]'}</T>
      </Row>
      <Row flat typed={5}>
        <T tone="muted">{"}]"}</T>
      </Row>
    </Card>
  )
}

export function Flexible() {
  return (
    <HomeSection
      accent="emerald"
      icon={Layers01Icon}
      eyebrow="Fits the project"
      title="As small or as structured as the project needs"
      lede="Start with one css() call. Grow into Tailwind's system, or into a design system with your own rules. Nothing about the first step has to be undone for the next."
    >
      <div sx={styles.paths}>
        {PATHS.map((path, index) => (
          <IllustratedCard
            key={path.title}
            tone={path.accent}
            tall
            art={<CodeArt path={path} />}
            icon={pathIcon[path.step]!}
            title={path.title}
            note={`0${index + 1}`}
            href={path.href}
            text={path.text}
            links={[{ title: path.more, href: path.href }]}
          >
            <span sx={styles.fit}>{path.fit}</span>
          </IllustratedCard>
        ))}
      </div>

      <div sx={styles.columns}>
        <IllustratedCard
          tone="emerald"
          art={<ChoicesArt />}
          icon={DashboardSpeed01Icon}
          title="Your choices, not ours"
          text="How you write, how strict the build is, and where it runs are yours to decide."
        >
          <div sx={styles.list}>
            {CHOICES.map((choice) => (
              <div key={choice.name} sx={styles.item}>
                <span sx={styles.itemName}>{choice.name}</span>
                <span sx={styles.itemText}>{choice.text}</span>
              </div>
            ))}
          </div>
        </IllustratedCard>
        <IllustratedCard
          tone="violet"
          art={<AgentsArt />}
          icon={AiBrain02Icon}
          title="Written well by agents"
          text="What makes a style easy for a model to write, check and fix."
          links={[
            { title: "Agent skills", href: "/docs/project/agent-skills" },
            { title: "llms.txt", href: "/docs/project/llms" },
          ]}
        >
          <div sx={styles.list}>
            {AGENT_POINTS.map((point) => (
              <div key={point.title} sx={styles.item}>
                <span sx={styles.itemName}>{point.title}</span>
                <span sx={styles.itemText}>{point.text}</span>
              </div>
            ))}
          </div>
        </IllustratedCard>
      </div>

      <div sx={styles.stats}>
        {STATS.map((stat) => (
          <div key={stat.label} sx={styles.stat}>
            <span sx={styles.statHead}>
              <span sx={styles.statIcon}>
                <Icon icon={stat.icon} size="0.875rem" />
              </span>
              {stat.kind}
            </span>
            <span sx={styles.statValue}>{stat.value}</span>
            <span sx={styles.statText}>{stat.label}</span>
          </div>
        ))}
      </div>
    </HomeSection>
  )
}
