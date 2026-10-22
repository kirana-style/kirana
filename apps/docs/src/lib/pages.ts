import type { MarkdownDocument } from "@tanstack/markdown"
import { createPages } from "@workspace/docs-core/pages.ts"

import { PAGES } from "@/generated/content.gen"

/**
 * Parsed documents, one module per page, loaded on demand. Never eager: an
 * eager glob would pull every page of the site into the first chunk.
 */
export const { findPage, pageHref, loadDocument, neighbours } = createPages({
  pages: PAGES,
  documents: import.meta.glob<{ default: MarkdownDocument }>(
    "../generated/pages/**/*.json"
  ),
  prefix: "../generated/pages/",
})

/**
 * Old docs addresses and where each page lives now, answered with a permanent redirect. Empty while
 * the site has no public domain: nothing outside the repository links to an old address yet. Once
 * kirana.style serves the docs, a page that moves adds its old address here.
 */
export const MOVED: Readonly<Record<string, string>> = {}
