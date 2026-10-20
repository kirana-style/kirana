/**
 * What the layout needs from the app, handed down once: how to render a link
 * (an app's router decides what a docs href maps to), how to search, and the
 * site's data. Keeps every docs-ui component free of app imports.
 */
import { createContext, useContext } from "react"
import type { SearchHit } from "@workspace/docs-core/search.ts"
import type { NavGroup, PageMeta } from "@workspace/docs-core/types.ts"
import type { Sx } from "@workspace/ui/lib/sx"

import type { AccentName } from "./accent.ts"

export type LinkComponent = React.ComponentType<
  {
    href: string
    sx?: Sx
    children?: React.ReactNode
  } & Omit<React.ComponentProps<"a">, "href" | "sx" | "children">
>

/** A top-level tab of the docs: a set of sections, one accent. */
export type DocsTab = {
  id: string
  label: string
  /** Where the tab goes: its first page. */
  href: string
  /** `sections.json` slugs the tab owns, in sidebar order. */
  sections: readonly string[]
  accent: AccentName
  icon?: unknown
}

export type DocsConfig = {
  Link: LinkComponent
  nav: readonly NavGroup[]
  pages: readonly PageMeta[]
  tabs: readonly DocsTab[]
  search: (query: string) => readonly SearchHit[]
  /**
   * Loads what `search` reads, when a site keeps its records out of the first page load. Search
   * calls it when it opens, or when the pointer reaches its trigger, and renders again once it
   * resolves.
   */
  loadSearch?: () => Promise<unknown>
  /** Client-side navigation to a docs href, hash included. */
  navigate: (href: string) => void
  /** Origin the markdown twins live under, for the copy-page menu. */
  siteUrl: string
  /** The product's name, as assistants are told what a page belongs to. */
  siteName: string
  /**
   * A logo for a docs page, if it has one — a framework's or a bundler's. The
   * sidebar and links in tables show it beside the page's name.
   */
  pageIcon?: (href: string, size?: string) => React.ReactNode
  /** Under the table of contents on every page: a sponsor slot, a notice. */
  railFooter?: React.ReactNode
  /** Pinned under the sidebar's list, outside its scroll. */
  sidebarFooter?: React.ReactNode
}

const Context = createContext<DocsConfig | null>(null)

export function DocsProvider({
  value,
  children,
}: {
  value: DocsConfig
  children: React.ReactNode
}) {
  return <Context value={value}>{children}</Context>
}

export function useDocs(): DocsConfig {
  const value = useContext(Context)
  if (!value) throw new Error("docs-ui: wrap the docs in <DocsProvider>")
  return value
}

/** The tab a page belongs to, by its section; the first tab when unknown. */
export function tabFor(
  tabs: readonly DocsTab[],
  section: string | undefined
): DocsTab | undefined {
  return (
    tabs.find((tab) => section && tab.sections.includes(section)) ?? tabs[0]
  )
}
