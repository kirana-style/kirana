import {
  Link,
  Outlet,
  createFileRoute,
  useRouterState,
} from "@tanstack/react-router"
import { css, props as styleProps } from "@kirana-style/core"

import { DocsLayout } from "@workspace/docs-ui/docs-layout.tsx"
import { ThemeToggle } from "@workspace/shell/theme-toggle"
import { theme } from "@workspace/ui/theme/semantic"
import { pointer } from "@workspace/ui/tokens/breakpoints"
import { spacing } from "@workspace/ui/tokens/spacing"

import { KiranaMark } from "@/brand/kirana-mark-svg"
import { Wordmark } from "@/components/site/wordmark"
import { StatusBanner } from "@/components/status-banner"

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
 * The documentation chrome, for `/docs` and everything under it.
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
        <Link to="/" aria-label="Kirana, home" {...styleProps(styles.brand)}>
          <KiranaMark variant="solid" title={null} sx={styles.logo} />
          <Wordmark />
        </Link>
      }
      actions={<ThemeToggle />}
      banner={<StatusBanner />}
    >
      <Outlet />
    </DocsLayout>
  )
}
