/**
 * This site's docs, as docs-ui needs them: its link, its search, its data and
 * the five tabs its sections are grouped into.
 */
import {
  BookOpen01Icon,
  Flag01Icon,
  Layers01Icon,
  Route01Icon,
  SourceCodeIcon,
} from "@hugeicons/core-free-icons"
import { useRouter } from "@tanstack/react-router"

import { DocsProvider } from "@workspace/docs-ui/provider.tsx"
import type { DocsConfig, DocsTab } from "@workspace/docs-ui/provider.tsx"

import { DocsLink } from "@/components/docs-link"
import { pageIcon } from "@/components/site/brands"
import { RailSponsor, SidebarSponsor } from "@/components/site/sponsor-slots"
import { NAV, PAGES } from "@/generated/content.gen"
import { loadSearch, search } from "@/lib/search"

/**
 * Tabs group sections; a page's URL never depends on its tab. Each tab wears the hue of the scene
 * it stands in (`src/brand/scenes.ts`): Learn the highlands, Frameworks the misty hills, Guides the
 * heritage street, Reference the crater, Project the old hall.
 */
export const TABS: readonly DocsTab[] = [
  {
    id: "docs",
    label: "Learn",
    href: "/docs",
    sections: [
      "start",
      "writing",
      "cascade",
      "composition",
      "dynamic",
      "tokens",
      "config",
    ],
    accent: "forest",
    icon: BookOpen01Icon,
  },
  {
    id: "frameworks",
    label: "Frameworks",
    href: "/docs/frameworks/overview",
    sections: ["frameworks", "server", "bundlers", "testing"],
    accent: "tea",
    icon: Layers01Icon,
  },
  {
    id: "guides",
    label: "Guides",
    href: "/docs/migration/from-tailwind",
    sections: ["migration", "building"],
    accent: "terracotta",
    icon: Route01Icon,
  },
  {
    id: "reference",
    label: "Reference",
    href: "/docs/reference/api",
    sections: ["reference", "tooling"],
    accent: "crater",
    icon: SourceCodeIcon,
  },
  {
    id: "project",
    label: "Project",
    href: "/docs/project/status",
    sections: ["project"],
    accent: "ochre",
    icon: Flag01Icon,
  },
]

export function SiteDocsProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const value: DocsConfig = {
    Link: DocsLink,
    nav: NAV,
    pages: PAGES,
    tabs: TABS,
    railFooter: <RailSponsor />,
    sidebarFooter: <SidebarSponsor />,
    search: (query) => search(query),
    loadSearch,
    navigate: (href) => {
      const [path = "", hash] = href.split("#")
      void router.navigate({
        to: "/docs/$",
        params: { _splat: path.replace(/^\/docs\/?/, "") },
        hash,
      })
    },
    siteUrl: "https://kirana.style",
    siteName: "Kirana",
    pageIcon,
  }
  return <DocsProvider value={value}>{children}</DocsProvider>
}
