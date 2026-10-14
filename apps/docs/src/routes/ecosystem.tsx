import { createFileRoute } from "@tanstack/react-router"
import { css } from "@kirana-style/core"
import { accent, accents, tint } from "@workspace/docs-ui/accent.ts"
import { BrandIcon } from "@workspace/docs-ui/brand-icon.tsx"
import type { SvglIcon } from "@workspace/docs-ui/brand-icon.tsx"
import { SVGL } from "@/generated/svgl-icons.gen"
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
import { FRAMEWORKS } from "@/components/home/content"
import { More } from "@/components/page-section"
import { LogoIcon, PAGE_LOGOS } from "@/components/site/brands"
import { Page, PageHero, PageSection } from "@/components/site/page"
import { PACKAGES } from "@/generated/packages.gen"
import { LIFT, REST } from "@/components/site/lift"
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

type Status = "Works" | "Planned" | "Deferred" | "In this repository"

/** From `/docs/integrations/ecosystem`, the source of truth for status. */
const BUNDLERS: {
  name: string
  status: Status
  note: string
  icon?: SvglIcon
}[] = [
  {
    name: "Vite 8",
    status: "Works",
    note: "@kirana-style/vite, with hot updates",
    icon: SVGL.vite,
  },
  {
    name: "Rolldown",
    status: "Works",
    note: "@kirana-style/rolldown",
    icon: SVGL.rolldown,
  },
  {
    name: "webpack 5",
    status: "Works",
    note: "@kirana-style/webpack, with dev-server updates",
  },
  {
    name: "Rspack, Rsbuild",
    status: "Works",
    note: "@kirana-style/rspack, with dev-server updates",
  },
  {
    name: "Bun",
    status: "Works",
    note: "@kirana-style/bun, builds and dev server",
    icon: SVGL.bun,
  },
  {
    name: "esbuild",
    status: "Works",
    note: "@kirana-style/esbuild",
    icon: SVGL.esbuild,
  },
  {
    name: "Jest",
    status: "Works",
    note: "@kirana-style/jest",
    icon: SVGL.jest,
  },
  {
    name: "Next.js, Turbopack and webpack",
    status: "Works",
    note: "@kirana-style/next with @kirana-style/postcss, on the dev server too",
    icon: SVGL.nextjs,
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
      note: "Set a project up from a diff, check the setup or write a bug report, watch without a bundler",
      href: "/docs/tooling/cli",
    },
    {
      name: "Language server, VS Code and Zed",
      status: "Works",
      note: "kirana lsp",
      href: "/docs/tooling/editor",
    },
    {
      name: "Lint plugin (@kirana-style/eslint-plugin: Oxlint, ESLint)",
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

/** A status's hue: works in forest, deferred in ochre, the rest in ink. */
const STATUS_ACCENT = {
  Works: "forest",
  Planned: "neutral",
  Deferred: "ochre",
  "In this repository": "neutral",
} as const

const styles = {
  packages: css({
    display: "grid",
    gap: spacing[3],
    gridTemplateColumns: {
      base: "minmax(0, 1fr)",
      [breakpoint.md]: "repeat(2, minmax(0, 1fr))",
      [breakpoint.lg]: "repeat(3, minmax(0, 1fr))",
    },
  }),
  pkg: css({
    display: "grid",
    gap: spacing[2],
    alignContent: "start",
    borderRadius: radius.xl,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: theme.border,
    backgroundColor: theme.card,
    padding: spacing[5],
  }),
  pkgName: css({
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: spacing[2],
    fontFamily: fontFamily.mono,
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    fontWeight: fontWeight.semibold,
    color: accent.base,
  }),
  version: css({
    fontSize: fontSize.xs,
    fontWeight: fontWeight.normal,
    color: theme.mutedForeground,
  }),
  text: css({
    fontSize: fontSize.sm,
    lineHeight: "1.6",
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
  frameworks: css({
    display: "grid",
    gap: spacing[2],
    gridTemplateColumns: "repeat(auto-fill, minmax(11rem, 1fr))",
  }),
  framework: css({
    display: "flex",
    alignItems: "center",
    gap: spacing[3],
    borderRadius: radius.lg,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: theme.border,
    boxShadow: { base: REST, ":hover": LIFT },
    backgroundColor: theme.card,
    paddingInline: spacing[4],
    paddingBlock: spacing[3],
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    textDecorationLine: "none",
    color: theme.foreground,
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
        label="Packages"
        title="One engine, a thin package for each tool"
        lede="Every package is 0.1.0 and none is on npm yet; each is packed and install-tested on every change."
      >
        <div sx={styles.packages}>
          {PACKAGES.map((entry) => (
            <div key={entry.name} sx={styles.pkg}>
              <span sx={styles.pkgName}>
                {entry.name}
                <span sx={styles.version}>
                  {entry.version}
                  {entry.published ? "" : " · not published"}
                </span>
              </span>
              <span sx={styles.text}>{entry.description}</span>
            </div>
          ))}
        </div>
      </PageSection>

      <PageSection
        number="02"
        label="Bundlers"
        title="The same compiler under every bundler"
      >
        <div sx={styles.table}>
          {BUNDLERS.map((item) => (
            <div key={item.name} sx={styles.row}>
              <span sx={styles.name}>
                {item.icon ? <BrandIcon icon={item.icon} /> : null}
                {item.name}
              </span>
              <span sx={styles.note}>{item.note}</span>
              <Badge status={item.status} />
            </div>
          ))}
        </div>
      </PageSection>

      <PageSection
        number="03"
        label="Frameworks"
        title="A guide and a checked example for each framework"
        lede="All of them work; each guide names the example CI builds and checks."
      >
        <div sx={styles.frameworks}>
          {FRAMEWORKS.map((framework) => (
            <DocsLink
              key={framework.href}
              href={framework.href}
              sx={styles.framework}
            >
              {PAGE_LOGOS[framework.href] ? (
                <LogoIcon logo={PAGE_LOGOS[framework.href]!} />
              ) : null}
              {framework.title}
            </DocsLink>
          ))}
        </div>
      </PageSection>

      <PageSection
        number="04"
        label="Tooling"
        title="The tools around the compiler"
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
