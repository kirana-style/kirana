/**
 * Reads a release-please `CHANGELOG.md` into releases the site can lay out: each version with its
 * date and compare link, and its changes grouped by section (breaking changes, features, fixes and
 * so on), each change with its scope and the pull request and commit it links to.
 *
 * The site imports the file itself, so the page follows every release without a generated copy
 * to keep in step.
 */

export type Change = {
  /** The conventional-commit scope, `site` in `**site:** …`, when there is one. */
  scope?: string
  text: string
  /**
   * The pull request it links to: its number and URL. Release-please writes `/issues/N` for a
   * squash-merged pull request's `(#N)`; the page links the pull request itself.
   */
  pr?: { number: number; href: string }
  /** The commit it links to: the short hash and URL. */
  commit?: { sha: string; href: string }
}

export type ReleaseSection = { title: string; changes: Change[] }

export type Release = {
  version: string
  /** ISO date, `2026-10-15`. */
  date: string
  /** The comparison with the previous version on the forge. */
  compare?: string
  sections: ReleaseSection[]
}

const HEADING =
  /^##\s+\[?([^\]\s]+)\]?(?:\(([^)]+)\))?\s+\((\d{4}-\d{2}-\d{2})\)/
const SECTION = /^###\s+(.+?)\s*$/
const ITEM = /^\*\s+(.*)$/
const PR = /\s*\(\[#(\d+)\]\(([^)]+)\)\)/
const COMMIT = /\s*\(\[([0-9a-f]{7,40})\]\(([^)]+)\)\)/

/** Release-please marks breaking changes with a warning sign; the page shows the words. */
function sectionTitle(raw: string): string {
  return raw.replace(/^⚠\s*/u, "").trim()
}

export function parseChangelog(source: string): Release[] {
  const releases: Release[] = []
  let release: Release | undefined
  let section: ReleaseSection | undefined

  for (const line of source.split(/\r?\n/)) {
    const heading = HEADING.exec(line)
    if (heading) {
      release = {
        version: heading[1]!,
        date: heading[3]!,
        ...(heading[2] ? { compare: heading[2] } : {}),
        sections: [],
      }
      releases.push(release)
      section = undefined
      continue
    }
    const title = SECTION.exec(line)
    if (title && release) {
      section = { title: sectionTitle(title[1]!), changes: [] }
      release.sections.push(section)
      continue
    }
    const item = ITEM.exec(line)
    if (item && section) section.changes.push(parseChange(item[1]!))
  }
  return releases
}

function parseChange(raw: string): Change {
  let text = raw
  const change: Change = { text: "" }
  const pr = PR.exec(text)
  if (pr) {
    change.pr = {
      number: Number(pr[1]),
      href: pr[2]!.replace(/\/issues\/(\d+)$/, "/pull/$1"),
    }
    text = text.replace(PR, "")
  }
  const commit = COMMIT.exec(text)
  if (commit) {
    change.commit = { sha: commit[1]!.slice(0, 7), href: commit[2]! }
    text = text.replace(COMMIT, "")
  }
  const scope = /^\*\*([^*:]+):\*\*\s*/.exec(text)
  if (scope) {
    change.scope = scope[1]!
    text = text.slice(scope[0].length)
  }
  change.text = text.trim()
  return change
}
