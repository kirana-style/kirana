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
