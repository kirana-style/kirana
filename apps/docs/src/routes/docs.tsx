import {
  Link,
  Outlet,
  createFileRoute,
  useRouterState,
} from "@tanstack/react-router"
import { css, props as styleProps } from "@kirana-style/core"

import { DocsLayout } from "@workspace/docs-ui/docs-layout.tsx"
import { theme } from "@workspace/ui/theme/semantic"
import { pointer } from "@workspace/ui/tokens/breakpoints"
import { spacing } from "@workspace/ui/tokens/spacing"
import { ThemeMenu } from "@workspace/docs-ui/theme-menu.tsx"

import { KiranaMark } from "@/brand/kirana-mark-svg"
import { QuickStart } from "@/components/site/cta"
import { HeaderLinks } from "@/components/site/header"
import { Wordmark } from "@/components/site/wordmark"
import { StatusBanner } from "@/components/status-banner"
import { UI_SITE } from "@/data/links"

const styles = {
  brand: css({
    // A finger-sized target on a touch screen.
    minHeight: { [pointer.coarse]: "2.75rem" },
    display: "flex",
    alignItems: "center",
    gap: spacing[2],
    color: theme.foreground,
  }),
  // The petal K in one colour beside the wordmark, as in the site header.
  logo: css({ height: "21px", width: "auto" }),
}

/**
 * The documentation chrome, for `/docs` and everything under it. The bar ends with the theme
 * menu, the site header's repository and sponsor heart, and a pill to Kirana UI.
 *
 * A layout route rather than a wrapper inside the page component: the sidebar
 * keeps its scroll position and its open sections while you read through the
 * documentation, because it is not remounted on every navigation.
 */
export const Route = createFileRoute("/docs")({
  component: Docs,
})

function Docs() {
  const path = useRouterState({ select: (state) => state.location.pathname })
  const current = path.replace(/\/+$/, "") || "/docs"
  return (
    <DocsLayout
      current={current}
      logo={
        <Link
          to="/"
          aria-label="kirana style, home"
          {...styleProps(styles.brand)}
        >
          <KiranaMark variant="solid" title={null} sx={styles.logo} />
          <Wordmark />
        </Link>
      }
      actions={
        <>
          <ThemeMenu />
          <HeaderLinks />
          {/* Kirana UI where the site header has "Quick start": the reader is past the start. */}
          <QuickStart size="sm" href={UI_SITE} hue="around" hideOnPhone>
            Kirana UI
          </QuickStart>
        </>
      }
      banner={<StatusBanner />}
    >
      <Outlet />
    </DocsLayout>
  )
}
