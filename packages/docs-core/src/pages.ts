import type { MarkdownDocument } from "@tanstack/markdown"

import type { PageMeta } from "./types.ts"

/**
 * Page lookup and lazy document loading for an app that generated its content with
 * `generate()`. The app passes the manifest's `PAGES` and its own lazy
 * `import.meta.glob` of the page documents (an eager one puts every page in the first chunk).
 */
export function createPages(options: {
  pages: readonly PageMeta[]
  /** `import.meta.glob("<generatedDir>/pages/**\/*.json")`, lazy. */
  documents: Record<string, () => Promise<{ default: MarkdownDocument }>>
  /** The glob's key prefix, e.g. `"../generated/pages/"`. */
  prefix: string
  /** The URL the docs live under. Default `/docs`. */
  basePath?: string
}) {
  const { pages, documents, prefix } = options
  const base = options.basePath ?? "/docs"
  const byHref = new Map(pages.map((page) => [page.href, page]))

  /** The file a page's document lives in, as the glob keys it. */
  const moduleKey = (href: string) => {
    const slug = href === base ? "index" : href.slice(base.length + 1)
    return `${prefix}${slug}.json`
  }

  return {
    findPage(href: string): PageMeta | undefined {
      return byHref.get(href)
    },

    /** The page a `<base>/$` splat resolves to, with trailing slashes ignored. */
    pageHref(splat: string | undefined): string {
      const path = (splat ?? "").replace(/^\/+|\/+$/g, "")
      return path ? `${base}/${path}` : base
    },

    async loadDocument(href: string): Promise<MarkdownDocument> {
      const load = documents[moduleKey(href)]
      if (!load) throw new Error(`no generated document for ${href}`)
      return (await load()).default
    },

    /** The pages either side of this one, in reading order. */
    neighbours(href: string): { previous?: PageMeta; next?: PageMeta } {
      const index = pages.findIndex((page) => page.href === href)
      if (index < 0) return {}
      return {
        ...(index > 0 ? { previous: pages[index - 1] } : {}),
        ...(index < pages.length - 1 ? { next: pages[index + 1] } : {}),
      }
    },
  }
}
