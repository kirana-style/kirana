/**
 * The packages, grouped, each an illustrated card with a picture of what the group
 * does and its packages as pills; and
 * the three promises with everything they buy, as a grid with hatched gutters.
 * Package names, versions and descriptions come from the packages themselves.
 */
import { css } from "@kirana-style/core"
import {
  CheckListIcon,
  CodeIcon,
  CpuIcon,
  CubeIcon,
  FileCodeIcon,
  FileScriptIcon,
  GridViewIcon,
  PaintBrush01Icon,
  PlugSocketIcon,
  RoboticIcon,
  SparklesIcon,
} from "@hugeicons/core-free-icons"

import { accent } from "@workspace/docs-ui/accent.ts"
import type { AccentName } from "@workspace/docs-ui/accent.ts"
import { Icon } from "@workspace/ui/primitives/icon"
import type { IconProps } from "@workspace/ui/primitives/icon"
import { alpha, radius, theme } from "@workspace/ui/theme/semantic"
import { breakpoint } from "@workspace/ui/tokens/breakpoints"
import { duration } from "@workspace/ui/tokens/motion"
import { spacing } from "@workspace/ui/tokens/spacing"
import {
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
} from "@workspace/ui/tokens/typography"

import { DocsLink } from "@/components/docs-link"
import { Keycap } from "@/components/site/accents"
import { IllustratedCard, pill } from "@/components/site/illustrated-card"
import { At, Card, Row, Scene, T, Tag, Tile } from "@/components/site/visuals"
import { SVGL } from "@/generated/svgl-icons.gen"
import { PACKAGES } from "@/generated/packages.gen"

import { FEATURES, PILLARS } from "@/data/claims"
import { frame } from "@/components/home/frame"

const GROUPS: {
  title: string
  icon: IconProps["icon"]
  accent: AccentName
  /** npm packages, shown with their versions; a group of other tools names them in `tools`. */
  packages: readonly string[]
  tools?: { names: readonly string[]; kind: string }
  href: string
  /** What a group of several packages is; a single package says it itself. */
  text?: string
}[] = [
  {
    title: "Authoring",
    icon: PaintBrush01Icon,
    accent: "tea",
    packages: ["@kirana-style/core"],
    href: "/docs/reference/api",
  },
  {
    title: "Compiler and CLI",
    icon: CubeIcon,
    accent: "tea",
    text: "The engine and the kirana command, and the small package npx runs on a project's first run, before Kirana is installed.",
    packages: ["@kirana-style/compiler", "kirana-style"],
    href: "/docs/tooling/cli",
  },
  {
    title: "Preset",
    icon: GridViewIcon,
    accent: "tea",
    packages: ["@kirana-style/preset-scales"],
    href: "/docs/tokens/preset-scales",
  },
  {
    title: "Bundler adapters",
    icon: PlugSocketIcon,
    accent: "tea",
    text: "A thin adapter per host: it hands modules to the engine and puts the stylesheet where the bundler expects it.",
    packages: [
      "@kirana-style/vite",
      "@kirana-style/rolldown",
      "@kirana-style/webpack",
      "@kirana-style/next",
      "@kirana-style/postcss",
      "@kirana-style/rspack",
      "@kirana-style/bun",
      "@kirana-style/esbuild",
      "@kirana-style/jest",
      "@kirana-style/astro",
      "@kirana-style/gatsby",
      "@kirana-style/angular",
      "@kirana-style/ember",
      "@kirana-style/parcel-transformer",
      "@kirana-style/adonis",
    ],
    href: "/docs/integrations/bundlers",
  },
  {
    title: "Lint",
    icon: CheckListIcon,
    accent: "tea",
    text: "The compiler's checks in the linter your CI already runs: one plugin for Oxlint and ESLint that reads the compiler, and the rules Biome can run as GritQL plugins.",
    packages: ["@kirana-style/eslint-plugin", "@kirana-style/biome-plugin"],
    href: "/docs/tooling/lint",
  },
  {
    title: "Editors",
    icon: CodeIcon,
    accent: "tea",
    text: "kirana-style lsp runs the project's own engine as a language server: an extension for VS Code, on its Marketplace and Open VSX, one for Zed, and configurations for Neovim and Helix.",
    packages: [],
    tools: { names: ["VS Code", "Zed"], kind: "extension" },
    href: "/docs/tooling/editor",
  },
  {
    title: "Agent skills",
    icon: SparklesIcon,
    accent: "tea",
    text: "Installed with npx skills add: one for writing Kirana, one for moving to it from Tailwind or StyleX. Their diagnostics and lint references are generated from the compiler.",
    packages: [],
    tools: { names: ["kirana", "kirana-migrate"], kind: "skill" },
    href: "/docs/project/agent-skills",
  },
]

const styles = {
  // Three single packages side by side; the adapters, wide, below them.
  groups: css({
    display: "grid",
    gap: spacing[4],
    gridTemplateColumns: {
      base: "minmax(0, 1fr)",
      [breakpoint.sm]: "repeat(2, minmax(0, 1fr))",
      [breakpoint.lg]: "repeat(3, minmax(0, 1fr))",
    },
  }),
  window: css({ width: "min(15rem, 100%)" }),
  swatch: css({
    width: "10px",
    height: "10px",
    borderRadius: "3px",
    backgroundColor: "oklch(0.588 0.158 241.966)",
  }),
  packages: css({
    display: "flex",
    flexWrap: "wrap",
    gap: spacing["1.5"],
    marginBlockStart: spacing[2],
    padding: 0,
    listStyleType: "none",
  }),
  pkg: css({ fontFamily: fontFamily.mono }),
  version: css({ color: theme.mutedForeground }),

  pillars: css({
    display: "grid",
    gap: "1px",
    overflow: "hidden",
    borderRadius: radius.xl,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: theme.border,
    backgroundColor: theme.border,
    gridTemplateColumns: {
      base: "minmax(0, 1fr)",
      [breakpoint.md]: "repeat(3, minmax(0, 1fr))",
    },
  }),
  pillar: css({
    display: "grid",
    gap: spacing[2],
    alignContent: "start",
    padding: spacing[6],
    backgroundColor: { base: theme.card, ":hover": theme.background },
    textDecorationLine: "none",
    color: theme.foreground,
    transitionProperty: "background-color",
    transitionDuration: duration[150],
  }),
  // The features sit in cells separated by hatched gutters.
  // Eight features in cells split by 1px gutters.
  features: css({
    display: "grid",
    gap: "1px",
    overflow: "hidden",
    borderRadius: radius.xl,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: theme.border,
    backgroundColor: theme.border,
    gridTemplateColumns: {
      base: "minmax(0, 1fr)",
      [breakpoint.sm]: "repeat(2, minmax(0, 1fr))",
      [breakpoint.lg]: "repeat(4, minmax(0, 1fr))",
    },
  }),
  feature: css({
    display: "grid",
    gap: spacing[2],
    alignContent: "start",
    backgroundColor: { base: theme.card, ":hover": alpha.muted50 },
    padding: spacing[5],
    textDecorationLine: "none",
    color: theme.foreground,
    transitionProperty: "background-color",
    transitionDuration: duration[150],
  }),
  featureIcon: css({ color: accent.base }),
  featureTitle: css({
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    fontWeight: fontWeight.semibold,
  }),
}

const BY_NAME = new Map(PACKAGES.map((entry) => [entry.name, entry]))

/** Authoring: the API a module imports. */
export function AuthoringArt() {
  return (
    <Card title="@kirana-style/core" icon={CodeIcon} glow sx={styles.window}>
      {(["css()", "recipe()", "defineTokens()"] as const).map((name) => (
        <Row key={name}>
          <Tag tone="accent">fn</Tag>
          <T tone="strong">{name}</T>
        </Row>
      ))}
    </Card>
  )
}

/** The compiler: modules in, one stylesheet out. */
export function CompilerArt() {
  return (
    <Scene
      width={250}
      height={110}
      wires={[
        "M 52 32 C 82 32, 90 55, 112 55",
        "M 52 78 C 82 78, 90 55, 112 55",
      ]}
      live={["M 148 55 H 196"]}
    >
      <At x={14} y={29}>
        <Tile icon={FileCodeIcon} size={36} />
      </At>
      <At x={14} y={71}>
        <Tile icon={FileCodeIcon} size={36} />
      </At>
      <At x={52} y={50}>
        <Tile icon={CpuIcon} size={48} variant="accent" caption="kirana" />
      </At>
      <At x={86} y={50}>
        <Tile icon={FileScriptIcon} size={38} caption="kirana.css" />
      </At>
    </Scene>
  )
}

const HOSTS = [
  SVGL.vite,
  SVGL.nextjs,
  SVGL.rolldown,
  SVGL.rspack,
  SVGL.esbuild,
  SVGL.bun,
  SVGL.astro,
  SVGL.jest,
] as const

/** The adapters: every host feeding one engine. */
export function AdaptersArt() {
  const xs = [10, 30, 70, 90]
  const wires = HOSTS.map((_, index) => {
    const x = (xs[index % 4]! / 100) * 360
    const y = index < 4 ? 26 : 114
    return `M ${x} ${y} C ${x} 70, 180 ${y < 70 ? 40 : 100}, 180 70`
  })
  return (
    <Scene width={360} height={140} wires={wires.slice(1)} live={[wires[0]!]}>
      {HOSTS.map((brand, index) => (
        <At key={brand.title} x={xs[index % 4]!} y={index < 4 ? 18 : 82}>
          <Tile brand={brand} size={36} />
        </At>
      ))}
      <At x={50} y={50}>
        <Tile
          icon={PlugSocketIcon}
          size={50}
          variant="accent"
          caption="one engine"
        />
      </At>
    </Scene>
  )
}

/** The preset: Tailwind's scales as tokens. */
export function PresetArt() {
  return (
    <Card
      title="@kirana-style/preset-scales"
      icon={GridViewIcon}
      glow
      sx={styles.window}
    >
      <Row>
        <Tag tone="accent">space</Tag>
        <T tone="strong">space[4]</T>
        <T tone="muted">1rem</T>
      </Row>
      <Row>
        <Tag tone="accent">color</Tag>
        <span sx={styles.swatch} />
        <T tone="strong">color.sky[600]</T>
      </Row>
      <Row>
        <Tag tone="accent">type</Tag>
        <T tone="strong">fontSize.sm</T>
        <T tone="muted">+ lineHeight</T>
      </Row>
    </Card>
  )
}

/** Lint: three linters, one set of Kirana rules. */
export function LintArt() {
  const xs = [22, 50, 78]
  const wires = xs.map((x) => {
    const from = (x / 100) * 360
    return `M ${from} 36 C ${from} 70, 180 60, 180 96`
  })
  return (
    <Scene width={360} height={140} wires={wires.slice(1)} live={[wires[0]!]}>
      {[SVGL.oxc, SVGL.eslint, SVGL.biome].map((brand, index) => (
        <At key={brand.title} x={xs[index]!} y={18}>
          <Tile brand={brand} size={36} />
        </At>
      ))}
      <At x={50} y={72}>
        <Tile
          icon={CheckListIcon}
          size={44}
          variant="accent"
          caption="kirana rules"
        />
      </At>
    </Scene>
  )
}

/** Editors: four editors, one language server. */
export function EditorsArt() {
  const xs = [14, 38, 62, 86]
  const wires = xs.map((x) => {
    const from = (x / 100) * 360
    return `M ${from} 36 C ${from} 70, 180 60, 180 96`
  })
  return (
    <Scene width={360} height={140} wires={wires.slice(1)} live={[wires[0]!]}>
      {[SVGL.vscode, SVGL.zed, SVGL.neovim, SVGL.helix].map((brand, index) => (
        <At key={brand.title} x={xs[index]!} y={18}>
          <Tile brand={brand} size={36} />
        </At>
      ))}
      <At x={50} y={72}>
        <Tile
          icon={CodeIcon}
          size={44}
          variant="accent"
          caption="kirana-style lsp"
        />
      </At>
    </Scene>
  )
}

/** Agent skills: one install, read by any agent. */
export function SkillsArt() {
  const xs = [22, 50, 78]
  const wires = xs.map((x) => {
    const to = (x / 100) * 360
    return `M 180 48 C 180 76, ${to} 70, ${to} 100`
  })
  return (
    <Scene width={360} height={140} wires={wires.slice(1)} live={[wires[0]!]}>
      <At x={50} y={24}>
        <Tile
          icon={SparklesIcon}
          size={44}
          variant="accent"
          caption="npx skills add"
        />
      </At>
      <At x={xs[0]!} y={82}>
        <Tile brand={SVGL.claude} size={36} caption="Claude" />
      </At>
      <At x={xs[1]!} y={82}>
        <Tile brand={SVGL.openai} size={36} caption="Codex" />
      </At>
      <At x={xs[2]!} y={82}>
        <Tile icon={RoboticIcon} size={36} caption="your agent" />
      </At>
    </Scene>
  )
}

const ART: Record<string, () => React.ReactNode> = {
  Authoring: AuthoringArt,
  "Compiler and CLI": CompilerArt,
  "Bundler adapters": AdaptersArt,
  Preset: PresetArt,
  Lint: LintArt,
  Editors: EditorsArt,
  "Agent skills": SkillsArt,
}

/** The packages in their groups, each group drawn: `/ecosystem`'s first chapter. */
export function PackageGroups() {
  return (
    <>
      <div sx={styles.groups}>
        {GROUPS.map((group) => {
          const entries = group.packages.flatMap(
            (name) => BY_NAME.get(name) ?? []
          )
          const ArtFor = ART[group.title]!
          const single = entries.length === 1
          const count = group.tools
            ? `${group.tools.names.length} ${group.tools.kind}s`
            : single
              ? "1 package"
              : `${entries.length} packages`
          return (
            <IllustratedCard
              key={group.title}
              // The three small groups sit side by side; the adapters, wide, below them.
              wide={entries.length > 2}
              art={<ArtFor />}
              title={group.title}
              note={count}
              href={group.href}
              text={single ? entries[0]!.description : group.text}
            >
              <ul sx={styles.packages}>
                {entries.map((entry) => (
                  <li key={entry.name}>
                    <DocsLink href={group.href} sx={[pill, styles.pkg]}>
                      {entry.name}
                      <span sx={styles.version}>{entry.version}</span>
                    </DocsLink>
                  </li>
                ))}
                {group.tools?.names.map((name) => (
                  <li key={name}>
                    <DocsLink href={group.href} sx={[pill, styles.pkg]}>
                      {name}
                    </DocsLink>
                  </li>
                ))}
              </ul>
            </IllustratedCard>
          )
        })}
      </div>
    </>
  )
}

/** The three promises and the features that keep them: a chapter of `/why`. */
export function Principles() {
  return (
    <>
      <div sx={styles.pillars}>
        {PILLARS.map((pillar) => (
          <DocsLink key={pillar.title} href={pillar.href} sx={styles.pillar}>
            <Keycap icon={pillar.icon} />
            <span sx={frame.cardTitle}>{pillar.title}</span>
            <span sx={frame.cardText}>{pillar.text}</span>
          </DocsLink>
        ))}
      </div>
      <div sx={styles.features}>
        {FEATURES.map((feature) => (
          <DocsLink key={feature.title} href={feature.href} sx={styles.feature}>
            <Icon icon={feature.icon} size="1.125rem" sx={styles.featureIcon} />
            <span sx={styles.featureTitle}>{feature.title}</span>
            <span sx={frame.cardText}>{feature.text}</span>
          </DocsLink>
        ))}
      </div>
    </>
  )
}
