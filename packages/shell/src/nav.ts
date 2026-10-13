export type NavItem = {
  title: string
  href: string
  /** Shown under the title on index and search pages. */
  description?: string
  /** Extra words the search matches on, beyond the title. */
  keywords?: string[]
  /** Children render as a collapsible sub-menu; the item's own `href` is then unused. */
  items?: NavItem[]
}

export type NavGroup = {
  label: string
  items: NavItem[]
}

/** Every navigable item, children in place of the parents that hold them. */
export function flattenNav(groups: NavGroup[]): NavItem[] {
  const walk = (items: NavItem[]): NavItem[] =>
    items.flatMap((item) => (item.items ? walk(item.items) : [item]))
  return groups.flatMap((group) => walk(group.items))
}

function matches(item: NavItem, q: string) {
  return [item.title, item.description ?? "", ...(item.keywords ?? [])].some(
    (text) => text.toLowerCase().includes(q)
  )
}

/**
 * Case-insensitive match on title, description and keywords. An empty query
 * matches all. A parent whose own title matches keeps every child; otherwise it
 * keeps only the children that match.
 */
export function filterNav(groups: NavGroup[], query: string): NavGroup[] {
  const q = query.trim().toLowerCase()
  if (!q) return groups
  const filter = (items: NavItem[]): NavItem[] =>
    items.flatMap((item) => {
      if (!item.items) return matches(item, q) ? [item] : []
      if (matches(item, q)) return [item]
      const children = filter(item.items)
      return children.length ? [{ ...item, items: children }] : []
    })
  return groups
    .map((group) => ({ ...group, items: filter(group.items) }))
    .filter((group) => group.items.length > 0)
}
