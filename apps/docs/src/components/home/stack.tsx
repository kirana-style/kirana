/**
 * "Frameworks": every framework with a guide, by its logo, and the one command that
 * sets a project up. The step-by-step picker is the docs' Quick start; this is the overview.
 */
import { css } from "@kirana-style/core"

import { CodeBlock } from "@workspace/docs-ui/markdown/code-block.tsx"
import { theme } from "@workspace/ui/theme/semantic"
import { breakpoint } from "@workspace/ui/tokens/breakpoints"
import { spacing } from "@workspace/ui/tokens/spacing"
import { fontSize } from "@workspace/ui/tokens/typography"

import { DocsLink } from "@/components/docs-link"
import { More } from "@/components/page-section"
import { FrameworkGrid } from "@/components/site/framework-grid"
import { FRAMEWORKS } from "@/data/claims"
import { SHOWCASE } from "@/generated/showcase.gen"

import { HomeSection } from "./frame"

const styles = {
  layout: css({
    display: "grid",
    gap: { base: spacing[8], [breakpoint.lg]: spacing[12] },
    alignItems: "start",
    gridTemplateColumns: {
      base: "minmax(0, 1fr)",
      [breakpoint.lg]: "minmax(0, 3fr) minmax(0, 2fr)",
    },
  }),
  side: css({ display: "grid", gap: spacing[4] }),
  sideText: css({
    fontSize: fontSize.base,
    lineHeight: "1.65",
    color: theme.mutedForeground,
  }),
  links: css({ display: "flex", flexWrap: "wrap", gap: spacing[5] }),
}

export function Stack() {
  const init = SHOWCASE["kirana-init"]!
  return (
    <HomeSection
      number="05"
      eyebrow="Frameworks"
      title="Works with the stack you have"
      lede={`${FRAMEWORKS.length} guides, from React to Rails. Each is built from the packages and checked in a browser on every change.`}
    >
      <div sx={styles.layout}>
        <FrameworkGrid />
        <div sx={styles.side}>
          <p sx={styles.sideText}>
            Or let the command line set it up. It recognises the framework, the
            bundler and the package manager, and shows every change as a diff
            before it writes one.
          </p>
          <CodeBlock
            html={init.html}
            source={init.source}
            variant="terminal"
            lang="bash"
          />
          <div sx={styles.links}>
            <DocsLink href="/docs/start/quick-start">
              <More>Quick start</More>
            </DocsLink>
            <DocsLink href="/docs/integrations/bundlers">
              <More>Bundlers</More>
            </DocsLink>
          </div>
        </div>
      </div>
    </HomeSection>
  )
}
