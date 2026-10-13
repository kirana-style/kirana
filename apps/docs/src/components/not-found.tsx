/**
 * The page for an address nothing lives at: the site's own frame (header, rail, footer), the
 * address that missed, and the places people most often meant.
 */
import { useRouterState } from "@tanstack/react-router"
import { css } from "@kirana-style/core"
import {
  BookOpen01Icon,
  CheckListIcon,
  FileNotFoundIcon,
  Rocket01Icon,
  SourceCodeIcon,
  Wrench01Icon,
} from "@hugeicons/core-free-icons"

import { Button } from "@workspace/ui/components/button"
import { radius, theme } from "@workspace/ui/theme/semantic"
import { spacing } from "@workspace/ui/tokens/spacing"
import { fontFamily, fontSize } from "@workspace/ui/tokens/typography"

import { DocsLink } from "@/components/docs-link"
import { Card, CardGrid } from "@/components/site/cards"
import { Page, PageHero, PageSection } from "@/components/site/page"

const styles = {
  address: css({
    display: "inline-block",
    maxWidth: "100%",
    paddingInline: spacing[2],
    paddingBlock: spacing["0.5"],
    overflowWrap: "anywhere",
    borderRadius: radius.md,
    backgroundColor: theme.muted,
    fontFamily: fontFamily.mono,
    fontSize: fontSize.sm,
    color: theme.foreground,
  }),
  actions: css({ display: "flex", flexWrap: "wrap", gap: spacing[3] }),
}

const PLACES = [
  {
    icon: Rocket01Icon,
    title: "Quick start",
    href: "/docs/start/quick-start",
    text: "A styled component in five minutes.",
  },
  {
    icon: BookOpen01Icon,
    title: "Installation",
    href: "/docs/start/installation",
    text: "Pick your framework and bundler.",
  },
  {
    icon: SourceCodeIcon,
    title: "Editor support",
    href: "/docs/tooling/editor",
    text: "Hover, swatches and diagnostics as you type.",
  },
  {
    icon: CheckListIcon,
    title: "Lint",
    href: "/docs/tooling/lint",
    text: "The compiler's checks, in Oxlint, ESLint or Biome.",
  },
  {
    icon: Wrench01Icon,
    title: "API reference",
    href: "/docs/reference/api",
    text: "Every function, type and entry point.",
  },
] as const

export function NotFound() {
  const address = useRouterState({ select: (state) => state.location.href })
  return (
    <Page accent="neutral">
      <PageHero
        icon={FileNotFoundIcon}
        eyebrow="404"
        title="Nothing lives at this address"
        lede={
          <>
            <span sx={styles.address}>{decodeURIComponent(address)}</span> is
            not a page. It may have moved when the docs were reorganised, or the
            link that brought you here has a typo.
          </>
        }
        actions={
          <div sx={styles.actions}>
            <Button
              size="lg"
              nativeButton={false}
              render={<DocsLink href="/docs">Open the docs</DocsLink>}
            />
            <Button
              size="lg"
              variant="outline"
              nativeButton={false}
              render={<DocsLink href="/">Back to the home page</DocsLink>}
            />
          </div>
        }
      />
      <PageSection title="Where people usually meant to go">
        <CardGrid cols={3}>
          {PLACES.map((place) => (
            <Card
              key={place.href}
              icon={place.icon}
              title={place.title}
              href={place.href}
            >
              {place.text}
            </Card>
          ))}
        </CardGrid>
      </PageSection>
    </Page>
  )
}
