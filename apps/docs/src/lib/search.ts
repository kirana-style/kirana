import { search as searchRecords } from "@workspace/docs-core/search.ts"

import { SEARCH } from "@/generated/content.gen"

export type { SearchHit } from "@workspace/docs-core/search.ts"

/** Ranks this site's search records against a query. */
export function search(query: string, limit?: number) {
  return searchRecords(SEARCH, query, limit)
}
