/** The shapes the generator writes and the app reads. Hand-written, so `typecheck` never needs the engine. */

/** A page's own frontmatter, after validation. */
export type PageMeta = {
  /** Route path, `/docs/styling/conditions`. */
  readonly href: string
  /** Source file relative to the app, for "Edit this page". */
  readonly file: string
  readonly title: string
  readonly description: string
  /** The sidebar group this page belongs to. */
  readonly section: string
  /** The collapsible sub-group inside that section, when the section has any. */
  readonly parent?: string
  /** Position inside its section. */
  readonly order: number
  /** Stated on the page when it is not the finished story. */
  readonly status?: "planned" | "partial"
  readonly keywords?: readonly string[]
  /**
   * What a reference page documents, shown as a badge in the sidebar:
   * `api`, `config`, `cli`, `diagnostics` — free text, the layout picks the tint.
   */
  readonly kind?: string
  readonly headings: readonly PageHeading[]
}

export type PageHeading = {
  readonly id: string
  readonly text: string
  readonly level: number
}

export type NavItem = {
  readonly title: string
  readonly href: string
  readonly description?: string
  readonly keywords?: readonly string[]
  readonly kind?: string
}

/** A collapsible sub-group of pages inside a section. */
export type NavBranch = {
  readonly label: string
  readonly items: readonly NavItem[]
}

export type NavNode = NavItem | NavBranch

export type NavGroup = {
  /** The section's slug from `sections.json`, so a layout can group sections into tabs. */
  readonly slug: string
  readonly label: string
  readonly items: readonly NavNode[]
}

/** Which of the two a nav node is. A branch has children; a page has an href. */
export function isBranch(node: NavNode): node is NavBranch {
  return "items" in node
}

/** Every page in the nav, sub-groups included. */
export function flattenNav(groups: readonly NavGroup[]): NavItem[] {
  return groups.flatMap((group) =>
    group.items.flatMap((node) => (isBranch(node) ? [...node.items] : [node]))
  )
}

/** One searchable slice of a page: everything under one heading. */
export type SearchRecord = {
  readonly id: string
  readonly href: string
  readonly page: string
  readonly section: string
  readonly heading?: string
  readonly text: string
}

export type BlogMeta = {
  readonly href: string
  readonly file: string
  readonly title: string
  readonly summary: string
  /** ISO date, `2026-09-16`. */
  readonly date: string
  readonly author: string
  readonly tags: readonly string[]
  /** An image URL for the post's card and header, with its description. */
  readonly cover?: string
  readonly coverAlt?: string
  readonly readingMinutes: number
  readonly headings: readonly PageHeading[]
}
