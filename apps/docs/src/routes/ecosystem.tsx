import { createFileRoute } from "@tanstack/react-router"
import { css } from "@kirana-style/core"
import { ArrowRight01Icon, LinkSquare02Icon } from "@hugeicons/core-free-icons"

import { accent, tint } from "@workspace/docs-ui/accent.ts"
import { Icon } from "@workspace/ui/primitives/icon"
import { radius, theme } from "@workspace/ui/theme/semantic"
import { breakpoint } from "@workspace/ui/tokens/breakpoints"
import { duration } from "@workspace/ui/tokens/motion"
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

/** What a row says when it is not there to use as it is; a row without one works today. */
type Status = "Planned" | "Deferred" | "Not packaged"

/** From `/docs/project/ecosystem`, the source of truth for status; each row opens its guide. */
const BUNDLERS: {
  name: string
  status?: Status
  note: string
  href: string
}[] = [
  {
    name: "Vite 8",
    note: "@kirana-style/vite, with hot updates",
    href: "/docs/integrations/vite",
  },
  {
    name: "Rolldown",
    note: "@kirana-style/rolldown",
    href: "/docs/integrations/rolldown",
  },
  {
    name: "webpack 5",
    note: "@kirana-style/webpack, with dev-server updates",
    href: "/docs/integrations/webpack",
  },
  {
    name: "Rspack, Rsbuild",
    note: "@kirana-style/rspack, with dev-server updates",
    href: "/docs/integrations/rspack",
  },
  {
    name: "Parcel",
    note: "@kirana-style/parcel-transformer with @kirana-style/postcss",
    href: "/docs/integrations/parcel",
  },
  {
    name: "Bun",
    note: "@kirana-style/bun, builds and dev server",
    href: "/docs/integrations/bun",
  },
  {
    name: "esbuild",
    note: "@kirana-style/esbuild",
    href: "/docs/integrations/esbuild",
  },
  {
    name: "PostCSS",
    note: "@kirana-style/postcss, for any PostCSS pipeline",
    href: "/docs/integrations/postcss",
  },
  {
    name: "Jest",
    note: "@kirana-style/jest",
    href: "/docs/integrations/jest",
  },
  {
    name: "Next.js, Turbopack and webpack",
    note: "@kirana-style/next with @kirana-style/postcss, on the dev server too",
    href: "/docs/frameworks/nextjs",
  },
]

const TOOLING: { name: string; status?: Status; note: string; href: string }[] =
  [
    {
      name: "kirana-style build, check, analyze, export, trace",
      note: "Compile, report (GitHub annotations, a warning cap), size the stylesheet, describe the design system, and explain which declaration wins",
      href: "/docs/tooling/cli",
    },
    {
      name: "kirana-style migrate tailwind / stylex",
      note: "Codemods with a diff and a report",
      href: "/migrate",
    },
    {
      name: "WASI build",
      note: "Byte-identical output where no native addon runs",
      href: "/docs/project/ecosystem#runtime-and-distribution",
    },
    {
      name: "kirana-style init, doctor, dev",
      note: "Set a project up from a diff (npx kirana-style@latest init on the first run), check the setup or write a bug report, watch without a bundler",
      href: "/docs/tooling/cli",
    },
    {
      name: "Language server, VS Code and Zed",
      note: "kirana-style lsp",
      href: "/docs/tooling/editor",
    },
    {
      // consistency: subset (the ESLint plugin's hosts; Biome has its own row below)
      name: "Lint plugin (Oxlint, ESLint)",
      note: "@kirana-style/eslint-plugin",
      href: "/docs/tooling/lint",
    },
    {
      name: "Lint plugin (Biome)",
      note: `@kirana-style/biome-plugin: the ${COUNTS.biomeRules} rules that need no compiler`,
      href: "/docs/tooling/lint#biome",
    },
    {
      name: "Agent skills",
      note: "kirana and kirana-migrate, for npx skills add",
      href: "/docs/project/agent-skills",
    },
    {
      name: "Docs framework (docs-core, docs-ui)",
      status: "Not packaged",
      note: "What this site runs on, in this repository",
      href: "/docs",
    },
  ]

const VERSIONS = [...new Set(PACKAGES.map((entry) => entry.version))]
const PACKAGES_LEDE = `${
  VERSIONS.length === 1
    ? `Every package is at ${VERSIONS[0]}, released together`
    : "Every package is released together"
}, and each is installed from its tarball and checked on every change.`

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
  // An exception, in quiet mono words: most rows have none.
  status: css({
    justifySelf: "end",
    fontFamily: fontFamily.mono,
    fontSize: textSize.label,
    lineHeight: textLeading.label,
    letterSpacing: textTracking.label,
    textTransform: "uppercase",
    whiteSpace: "nowrap",
    color: theme.mutedForeground,
  }),
  arrow: css({
    justifySelf: "end",
    color: { base: theme.mutedForeground, ":is(a:hover *)": theme.foreground },
    transitionProperty: "color",
    transitionDuration: duration[150],
  }),
  npm: css({
    display: "inline-flex",
    alignItems: "center",
    justifySelf: "end",
    gap: spacing[1],
    fontFamily: fontFamily.mono,
    fontSize: fontSize.xs,
    color: { base: theme.mutedForeground, ":hover": theme.foreground },
    textDecorationLine: "none",
  }),
}

/** A row's end: its exception when it has one, else the arrow into its page. */
function End({ status }: { status?: Status }) {
  return status ? (
    <span sx={styles.status}>{status}</span>
  ) : (
    <Icon icon={ArrowRight01Icon} size="0.875rem" sx={styles.arrow} />
  )
}

function EcosystemPage() {
  return (
    <Page scene="rock-garden">
      <PageHero
        label="Ecosystem"
        title="What exists, honestly"
        lede={`${PACKAGES.length} packages, one engine behind them, and the tools around it. A row says so when something is not there to use yet.`}
      />

      {/*
        The products beside the compiler, hidden for now; the roadmap shows the table. To bring it
        back here, import ProductTable from "@/components/site/product-table", restore this chapter
        as 01, renumber the rest, and drop the Tooling table's docs framework row.

      <PageSection
        number="01"
        label="Products"
        title="The compiler, and what is built on it"
        lede="Kirana UI is there to use with the compiler. The rest are planned, each released on its own."
      >
        <ProductTable />
      </PageSection>
      */}

      <PageSection
        number="01"
        label="How it fits"
        title="One engine, a thin package for each tool"
        lede="What you write with, what compiles it, the preset, an adapter for each bundler, the lint rules, and what runs in your editor and your agent."
      >
        <PackageGroups />
      </PageSection>

      <PageSection
        number="02"
        label="Packages"
        title="Every package, on npm"
        lede={PACKAGES_LEDE}
      >
        <div sx={styles.table}>
          {PACKAGES.map((entry) => (
            <div key={entry.name} sx={[styles.row, styles.packageRow]}>
              <span sx={styles.packageName}>{entry.name}</span>
              <span sx={styles.note}>
                <Described text={entry.description} />
              </span>
              <a
                href={`https://www.npmjs.com/package/${entry.name}`}
                target="_blank"
                rel="noreferrer"
                sx={styles.npm}
                aria-label={`${entry.name} ${entry.version} on npm`}
              >
                {entry.version}
                <Icon icon={LinkSquare02Icon} size="0.75rem" />
              </a>
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
              <End status={item.status} />
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
              <End status={item.status} />
            </DocsLink>
          ))}
        </div>
        <DocsLink href="/docs/project/ecosystem">
          <More>The full status page</More>
        </DocsLink>
      </PageSection>
    </Page>
  )
}
