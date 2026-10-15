import { createFileRoute } from "@tanstack/react-router"
import { css } from "@kirana-style/core"
import { accent, accents, tint } from "@workspace/docs-ui/accent.ts"
import { radius, theme } from "@workspace/ui/theme/semantic"
import { breakpoint } from "@workspace/ui/tokens/breakpoints"
import { spacing } from "@workspace/ui/tokens/spacing"
import {
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
} from "@workspace/ui/tokens/typography"

import { DocsLink } from "@/components/docs-link"
import { More } from "@/components/page-section"
import { LogoIcon, PAGE_LOGOS } from "@/components/site/brands"
import { InlineCode } from "@/components/site/code-tokens"
import { FrameworkGrid } from "@/components/site/framework-grid"
import { PackageGroups } from "@/components/site/packages"
import { Page, PageHero, PageSection } from "@/components/site/page"
import { PACKAGES } from "@/generated/packages.gen"
import { COUNTS } from "@/data/facts"

export const Route = createFileRoute("/ecosystem")({
  component: EcosystemPage,
  head: () => ({
    meta: [
      { title: "Ecosystem · Kirana" },
      {
        name: "description",
        content:
          "Every Kirana package, bundler, framework and tool, with what works today and what is planned.",
      },
    ],
  }),
})

type Status = "Works" | "Planned" | "Deferred" | "In this repository" | "On npm"

/** From `/docs/integrations/ecosystem`, the source of truth for status; each row opens its guide. */
const BUNDLERS: { name: string; status: Status; note: string; href: string }[] =
  [
    {
      name: "Vite 8",
      status: "Works",
      note: "@kirana-style/vite, with hot updates",
      href: "/docs/integrations/vite",
    },
    {
      name: "Rolldown",
      status: "Works",
      note: "@kirana-style/rolldown",
      href: "/docs/integrations/rolldown",
    },
    {
      name: "webpack 5",
      status: "Works",
      note: "@kirana-style/webpack, with dev-server updates",
      href: "/docs/integrations/webpack",
    },
    {
      name: "Rspack, Rsbuild",
      status: "Works",
      note: "@kirana-style/rspack, with dev-server updates",
      href: "/docs/integrations/rspack",
    },
    {
      name: "Parcel",
      status: "Works",
      note: "@kirana-style/parcel-transformer with @kirana-style/postcss",
      href: "/docs/integrations/parcel",
    },
    {
      name: "Bun",
      status: "Works",
      note: "@kirana-style/bun, builds and dev server",
      href: "/docs/integrations/bun",
    },
    {
      name: "esbuild",
      status: "Works",
      note: "@kirana-style/esbuild",
      href: "/docs/integrations/esbuild",
    },
    {
      name: "PostCSS",
      status: "Works",
      note: "@kirana-style/postcss, for any PostCSS pipeline",
      href: "/docs/integrations/postcss",
    },
    {
      name: "Jest",
      status: "Works",
      note: "@kirana-style/jest",
      href: "/docs/integrations/jest",
    },
    {
      name: "Next.js, Turbopack and webpack",
      status: "Works",
      note: "@kirana-style/next with @kirana-style/postcss, on the dev server too",
      href: "/docs/frameworks/nextjs",
    },
  ]

const TOOLING: { name: string; status: Status; note: string; href: string }[] =
  [
    {
      name: "kirana build, check, analyze, export, trace",
      status: "Works",
      note: "Compile, report (GitHub annotations, a warning cap), size the stylesheet, describe the design system, and explain which declaration wins",
      href: "/docs/tooling/cli",
    },
    {
      name: "kirana migrate tailwind / stylex",
      status: "Works",
      note: "Codemods with a diff and a report",
      href: "/migrate",
    },
    {
      name: "WASI build",
      status: "Works",
      note: "Byte-identical output where no native addon runs",
      href: "/docs/integrations/ecosystem#runtime-and-distribution",
    },
    {
      name: "kirana init, doctor, dev",
      status: "Works",
      note: "Set a project up from a diff (npx kirana-style init on the first run), check the setup or write a bug report, watch without a bundler",
      href: "/docs/tooling/cli",
    },
    {
      name: "Language server, VS Code and Zed",
      status: "Works",
      note: "kirana lsp",
      href: "/docs/tooling/editor",
    },
    {
      // consistency: subset (the ESLint plugin's hosts; Biome has its own row below)
      name: "Lint plugin (Oxlint, ESLint)",
      status: "Works",
      note: "@kirana-style/eslint-plugin",
      href: "/docs/tooling/lint",
    },
    {
      name: "Lint plugin (Biome)",
      status: "Works",
      note: `@kirana-style/biome-plugin: the ${COUNTS.biomeRules} rules that need no compiler`,
      href: "/docs/tooling/lint#biome",
    },
    {
      name: "Agent skills",
      status: "Works",
      note: "kirana and kirana-migrate, for npx skills add",
      href: "/docs/project/agent-skills",
    },
    {
      name: "Docs framework (docs-core, docs-ui)",
      status: "In this repository",
      note: "What this site runs on; not packaged yet",
      href: "/docs",
    },
  ]

/** A status's hue: works and published in forest, deferred in ochre, the rest in ink. */
const STATUS_ACCENT = {
  Works: "forest",
  Planned: "neutral",
  Deferred: "ochre",
  "In this repository": "neutral",
  "On npm": "forest",
} as const

/** What the packages chapter says about npm, read from the packages so it flips when they publish. */
const VERSIONS = [...new Set(PACKAGES.map((entry) => entry.version))]
const ON_NPM = PACKAGES.filter((entry) => entry.published).length
const NPM_LINE =
  ON_NPM === 0
    ? "none is on npm yet"
    : ON_NPM === PACKAGES.length
      ? "every one is on npm"
      : `${ON_NPM} of ${PACKAGES.length} are on npm`
const PACKAGES_LEDE = `${
  VERSIONS.length === 1
    ? `Every package is ${VERSIONS[0]} and ${NPM_LINE}`
    : NPM_LINE.charAt(0).toUpperCase() + NPM_LINE.slice(1)
}; each is packed and install-tested on every change.`

/** A package description with its `code` spans set as code. */
function Described({ text }: { text: string }) {
  return text
    .split("`")
    .map((part, index) =>
      index % 2 === 1 ? <InlineCode key={index}>{part}</InlineCode> : part
    )
}

const styles = {
  // Package names are long and mono, so their column is wider than the other tables'.
  packageRow: css({
    gridTemplateColumns: {
      base: "minmax(0, 1fr) auto",
      [breakpoint.md]: "19rem minmax(0, 1fr) auto",
    },
  }),
  packageName: css({
    fontFamily: fontFamily.mono,
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    fontWeight: fontWeight.medium,
    color: accent.base,
    overflowWrap: "anywhere",
  }),
  packageStatus: css({
    display: "inline-flex",
    alignItems: "center",
    justifySelf: "end",
    gap: spacing[2],
  }),
  version: css({
    fontFamily: fontFamily.mono,
    fontSize: fontSize.xs,
    color: theme.mutedForeground,
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
    alignItems: "center",
    gap: { base: spacing[1], [breakpoint.md]: spacing[4] },
    gridTemplateColumns: {
      base: "minmax(0, 1fr) auto",
      [breakpoint.md]: "16rem minmax(0, 1fr) auto",
    },
    paddingInline: spacing[5],
    paddingBlock: spacing[3],
    borderBlockStartWidth: { base: "1px", ":first-child": "0" },
    borderBlockStartStyle: "solid",
    borderBlockStartColor: theme.border,
    fontSize: fontSize.sm,
    lineHeight: "1.6",
    textDecorationLine: "none",
    color: theme.foreground,
    backgroundColor: { base: "transparent", ":is(a):hover": tint(5) },
  }),
  name: css({
    display: "inline-flex",
    alignItems: "center",
    gap: spacing[2],
    fontWeight: fontWeight.medium,
  }),
  note: css({
    color: theme.mutedForeground,
    gridColumn: { base: "1 / -1", [breakpoint.md]: "auto" },
    gridRow: { base: "2", [breakpoint.md]: "auto" },
  }),
  status: css({
    justifySelf: "end",
    borderRadius: radius.full,
    paddingInline: spacing[2],
    fontSize: "0.625rem",
    lineHeight: "1.125rem",
    fontWeight: fontWeight.semibold,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    whiteSpace: "nowrap",
    color: accent.base,
    backgroundColor: tint(12),
  }),
}

function Badge({ status }: { status: Status }) {
  return (
    <span sx={[accents[STATUS_ACCENT[status]], styles.status]}>{status}</span>
  )
}

function EcosystemPage() {
  return (
    <Page scene="rock-garden">
      <PageHero
        label="Ecosystem"
        title="What exists, honestly"
        lede={`${PACKAGES.length} packages, one engine behind them, and the tools around it. Anything marked planned is in the specification, not in the build.`}
      />

      <PageSection
        number="01"
        label="How it fits"
        title="One engine, a thin package for each tool"
        lede="What you write with, what compiles it, the preset, an adapter for each bundler, and the lint rules."
      >
        <PackageGroups />
      </PageSection>

      <PageSection
        number="02"
        label="Packages"
        title="Every package, and where it stands"
        lede={PACKAGES_LEDE}
      >
        <div sx={styles.table}>
          {PACKAGES.map((entry) => (
            <div key={entry.name} sx={[styles.row, styles.packageRow]}>
              <span sx={styles.packageName}>{entry.name}</span>
              <span sx={styles.note}>
                <Described text={entry.description} />
              </span>
              <span sx={styles.packageStatus}>
                <span sx={styles.version}>{entry.version}</span>
                {/* Only a published package is marked: until then the lede says it for all of them. */}
                {entry.published ? <Badge status="On npm" /> : null}
              </span>
            </div>
          ))}
        </div>
      </PageSection>

      <PageSection
        number="03"
        label="Bundlers"
        title="The same compiler under every bundler"
      >
        <div sx={styles.table}>
          {BUNDLERS.map((item) => (
            <DocsLink key={item.name} href={item.href} sx={styles.row}>
              <span sx={styles.name}>
                {PAGE_LOGOS[item.href] ? (
                  <LogoIcon logo={PAGE_LOGOS[item.href]!} />
                ) : null}
                {item.name}
              </span>
              <span sx={styles.note}>{item.note}</span>
              <Badge status={item.status} />
            </DocsLink>
          ))}
        </div>
      </PageSection>

      <PageSection
        number="04"
        label="Frameworks"
        title="A guide and a checked example for each framework"
        lede="All of them work; each guide names the example CI builds and checks."
      >
        <FrameworkGrid />
      </PageSection>

      <PageSection
        number="05"
        label="Tooling"
        title="What ships around the compiler"
      >
        <div sx={styles.table}>
          {TOOLING.map((item) => (
            <DocsLink key={item.name} href={item.href} sx={styles.row}>
              <span sx={styles.name}>{item.name}</span>
              <span sx={styles.note}>{item.note}</span>
              <Badge status={item.status} />
            </DocsLink>
          ))}
        </div>
        <DocsLink href="/docs/integrations/ecosystem">
          <More>The full status page</More>
        </DocsLink>
      </PageSection>
    </Page>
  )
}
