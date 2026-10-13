import type { SearchRecord } from "./types.ts"

export type SearchHit = {
  readonly record: SearchRecord
  readonly score: number
  /** A window of the body around the best match, for the result row. */
  readonly snippet: string
}

const WORD = /[\p{L}\p{N}]+/gu

function terms(query: string): string[] {
  return (query.toLowerCase().match(WORD) ?? []).filter(
    (term) => term.length > 1
  )
}

/**
 * Ranks the generated records against a query.
 *
 * Deliberately small: a few hundred records and simple, explainable weights beat
 * a fuzzy-matching dependency that surprises people. A title match outranks a
 * heading match, which outranks a mention in the body.
 */
export function search(
  records: readonly SearchRecord[],
  query: string,
  limit = 12
): SearchHit[] {
  const words = terms(query)
  if (words.length === 0) return []
  const phrase = query.trim().toLowerCase()

  const hits: SearchHit[] = []
  for (const record of records) {
    const page = record.page.toLowerCase()
    const heading = record.heading?.toLowerCase() ?? ""
    const body = record.text.toLowerCase()

    let score = 0
    for (const word of words) {
      if (page === word) score += 30
      else if (page.includes(word)) score += 12
      if (heading.includes(word)) score += 8
      const occurrences = body.split(word).length - 1
      score += Math.min(occurrences, 3) * 2
    }
    if (!score) continue
    if (page.includes(phrase)) score += 20
    if (body.includes(phrase)) score += 6

    hits.push({ record, score, snippet: snippet(record.text, words) })
  }

  return hits.sort((a, b) => b.score - a.score).slice(0, limit)
}

/** The first sentence-ish window that mentions a term, trimmed to whole words. */
function snippet(text: string, words: string[]): string {
  const lower = text.toLowerCase()
  const at = words
    .map((word) => lower.indexOf(word))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0]
  if (at === undefined) return text.slice(0, 120)

  const start = Math.max(0, text.lastIndexOf(" ", Math.max(0, at - 60)) + 1)
  const end = text.indexOf(" ", Math.min(text.length, at + 90))
  return `${start > 0 ? "…" : ""}${text.slice(start, end < 0 ? undefined : end)}…`
}
