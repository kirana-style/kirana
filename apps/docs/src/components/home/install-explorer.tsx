/**
 * Pick a framework, see its setup. The steps are read out of that framework's
 * own guide — its install line and its first two code blocks — so this can
 * never drift from the docs it links to.
 */
import { useEffect, useState } from "react"
import { css } from "@kirana-style/core"
import { PackageIcon } from "@hugeicons/core-free-icons"
import type { MarkdownDocument } from "@tanstack/markdown"

import { accent, tint } from "@workspace/docs-ui/accent.ts"
import { CodeBlock } from "@workspace/docs-ui/markdown/code-block.tsx"
import { InstallTabs } from "@workspace/docs-ui/markdown/install-tabs.tsx"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { radius, theme } from "@workspace/ui/theme/semantic"
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
import { LogoIcon, PAGE_LOGOS } from "@/components/site/brands"
import { More } from "@/components/page-section"
import { loadDocument } from "@/lib/pages"

import { FRAMEWORKS } from "./content"
import { HomeSection } from "./frame"

type Node = {
  type: string
  value?: string
  name?: string
  attributes?: Record<string, string>
  properties?: Record<string, unknown>
  children?: Node[]
}

type Setup = {
  install?: { packages?: string; dev?: string }
  blocks: {
    /** The heading the block sits under, without its step number. */
    step: string
    code: { html: string; source: string; lang: string; file?: string }
  }[]
}

const text = (node: Node): string =>
  node.value ?? (node.children ?? []).map(text).join("")

/** The guide's install line and its first two code blocks that name a file. */
function readSetup(document: MarkdownDocument): Setup {
  const setup: Setup = { blocks: [] }
  let heading = ""
  const walk = (node: Node) => {
    if (node.type === "heading") heading = text(node).replace(/^\d+\.\s*/, "")
    if (node.type === "component" && node.name === "install" && !setup.install)
      setup.install = node.attributes ?? {}
    if (
      node.type === "component" &&
      node.name === "code" &&
      typeof node.properties?.file === "string" &&
      setup.blocks.length < 2
    )
      setup.blocks.push({
        step: heading,
        code: node.properties as Setup["blocks"][number]["code"],
      })
    for (const child of node.children ?? []) walk(child)
  }
  walk(document as unknown as Node)
  return setup
}

const styles = {
  layout: css({
    display: "grid",
    gap: { base: spacing[6], [breakpoint.lg]: spacing[12] },
    gridTemplateColumns: {
      base: "minmax(0, 1fr)",
      [breakpoint.lg]: "17rem minmax(0, 1fr)",
    },
  }),
  list: css({
    display: { base: "flex", [breakpoint.lg]: "grid" },
    flexWrap: "wrap",
    alignContent: "start",
    gap: spacing[1],
  }),
  pick: css({
    display: "flex",
    minWidth: 0,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing[3],
    borderRadius: radius.lg,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: { base: "transparent", "[data-active]": theme.border },
    backgroundColor: {
      base: "transparent",
      ":hover": tint(6),
      "[data-active]": tint(10),
    },
    paddingInline: spacing[3],
    paddingBlock: spacing[2],
    textAlign: "start",
    cursor: "pointer",
    transitionProperty: "background-color, border-color",
    transitionDuration: duration[150],
  }),
  pickName: css({
    flexShrink: 0,
    display: "inline-flex",
    alignItems: "center",
    gap: spacing[2],
    whiteSpace: "nowrap",
  }),
  pickTitle: css({
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    fontWeight: fontWeight.medium,
    color: theme.foreground,
  }),
  pickText: css({
    display: { base: "none", [breakpoint.lg]: "inline" },
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontFamily: fontFamily.mono,
    fontSize: "0.6875rem",
    color: theme.mutedForeground,
  }),
  steps: css({ display: "grid", gap: spacing[2], minWidth: 0 }),
  step: css({
    display: "grid",
    gridTemplateColumns: "2rem minmax(0, 1fr)",
    columnGap: spacing[3],
  }),
  number: css({
    display: "grid",
    placeItems: "center",
    width: spacing[7],
    height: spacing[7],
    borderRadius: radius.full,
    backgroundColor: tint(14),
    color: accent.base,
    fontFamily: fontFamily.mono,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
  }),
  rail: css({
    justifySelf: "center",
    width: "1px",
    marginBlock: spacing[1],
    backgroundColor: theme.border,
  }),
  stepTitle: css({
    alignSelf: "center",
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    fontWeight: fontWeight.semibold,
  }),
  stepBody: css({ minWidth: 0, paddingBlockStart: spacing[3] }),
  foot: css({ display: "flex", flexWrap: "wrap", gap: spacing[5] }),
}

function Step({
  n,
  title,
  last,
  children,
}: {
  n: number
  title: string
  last?: boolean
  children: React.ReactNode
}) {
  return (
    <div sx={styles.step}>
      <span sx={styles.number}>{n}</span>
      <span sx={styles.stepTitle}>{title}</span>
      {last ? <span /> : <span sx={styles.rail} />}
      <div sx={styles.stepBody}>{children}</div>
    </div>
  )
}

export function InstallExplorer() {
  const [href, setHref] = useState(FRAMEWORKS[0]!.href)
  const [setups, setSetups] = useState<Record<string, Setup>>({})
  const setup = setups[href]
  const framework = FRAMEWORKS.find((item) => item.href === href)!

  useEffect(() => {
    if (setups[href]) return
    let live = true
    void loadDocument(href).then((document) => {
      if (live && document)
        setSetups((known) => ({ ...known, [href]: readSetup(document) }))
    })
    return () => {
      live = false
    }
  }, [href, setups])

  return (
    <HomeSection
      accent="blue"
      icon={PackageIcon}
      eyebrow="Frameworks"
      title="Works with your stack"
      lede={`${FRAMEWORKS.length} install guides, each built from the packages and checked on every change. Pick one — the steps below are read from its guide.`}
    >
      <div sx={styles.layout}>
        <div sx={styles.list} role="tablist" aria-label="Framework">
          {FRAMEWORKS.map((item) => (
            <button
              key={item.href}
              type="button"
              role="tab"
              aria-selected={item.href === href}
              data-active={item.href === href ? "" : undefined}
              sx={styles.pick}
              onClick={() => setHref(item.href)}
            >
              <span sx={styles.pickName}>
                {PAGE_LOGOS[item.href] ? (
                  <LogoIcon logo={PAGE_LOGOS[item.href]!} />
                ) : null}
                <span sx={styles.pickTitle}>{item.title}</span>
              </span>
              <span sx={styles.pickText}>{item.text}</span>
            </button>
          ))}
        </div>
        <div sx={styles.steps} role="tabpanel" aria-label={framework.title}>
          {setup ? (
            <>
              {setup.install ? (
                <Step n={1} title="Install">
                  <InstallTabs {...setup.install} />
                </Step>
              ) : null}
              {setup.blocks.map((block, i) => (
                <Step
                  key={block.code.file}
                  n={i + (setup.install ? 2 : 1)}
                  title={block.step}
                  last={i === setup.blocks.length - 1}
                >
                  <CodeBlock {...block.code} />
                </Step>
              ))}
            </>
          ) : (
            <Skeleton sx={css({ height: "16rem" })} />
          )}
          <div sx={styles.foot}>
            <DocsLink href={href}>
              <More>The full {framework.title} guide</More>
            </DocsLink>
            <DocsLink href="/docs/integrations/bundlers">
              <More>Other bundlers</More>
            </DocsLink>
          </div>
        </div>
      </div>
    </HomeSection>
  )
}
