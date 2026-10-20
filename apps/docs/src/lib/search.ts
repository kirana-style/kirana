import { search as searchRecords } from "@workspace/docs-core/search.ts"

import type { SearchRecord } from "@/lib/content"

export type { SearchHit } from "@workspace/docs-core/search.ts"

let records: readonly SearchRecord[] = []
let loading: Promise<void> | undefined

/**
 * Loads the search records, once. They are most of the content manifest's size and only search
 * reads them, so they stay out of every page's first load.
 */
export function loadSearch(): Promise<void> {
  loading ??= import("@/generated/search.gen").then((module) => {
    records = module.SEARCH
  })
  return loading
}

/** Ranks this site's search records against a query; none until `loadSearch` resolves. */
export function search(query: string, limit?: number) {
  return searchRecords(records, query, limit)
}
