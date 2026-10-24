import { describe, expect, it } from "vite-plus/test"

import { parseChangelog } from "../src/changelog.ts"

const SOURCE = `# Changelog

## [0.2.0](https://example.com/compare/v0.1.0...v0.2.0) (2026-10-15)


### ⚠ BREAKING CHANGES

* one command name ([#29](https://example.com/issues/29))

### Features

* **site:** paper and ink ([#27](https://example.com/issues/27)) ([5da3c6f](https://example.com/commit/5da3c6f0f1c8))
* plain change

## 0.1.0 (2026-10-13)

### Bug fixes

* a fix ([abcdef1](https://example.com/commit/abcdef1))
`

describe("parseChangelog", () => {
  const releases = parseChangelog(SOURCE)

  it("reads each version, its date and its compare link", () => {
    expect(releases.map((release) => [release.version, release.date])).toEqual([
      ["0.2.0", "2026-10-15"],
      ["0.1.0", "2026-10-13"],
    ])
    expect(releases[0]!.compare).toBe(
      "https://example.com/compare/v0.1.0...v0.2.0"
    )
    expect(releases[1]!.compare).toBeUndefined()
  })

  it("groups the changes by section, without the warning sign", () => {
    expect(releases[0]!.sections.map((section) => section.title)).toEqual([
      "BREAKING CHANGES",
      "Features",
    ])
  })

  it("splits a change into its scope, text, pull request and commit", () => {
    const [scoped, plain] = releases[0]!.sections[1]!.changes
    expect(scoped).toEqual({
      scope: "site",
      text: "paper and ink",
      pr: { number: 27, href: "https://example.com/pull/27" },
      commit: {
        sha: "5da3c6f",
        href: "https://example.com/commit/5da3c6f0f1c8",
      },
    })
    expect(plain).toEqual({ text: "plain change" })
    expect(releases[0]!.sections[0]!.changes[0]).toEqual({
      text: "one command name",
      pr: { number: 29, href: "https://example.com/pull/29" },
    })
    expect(releases[1]!.sections[0]!.changes[0]).toEqual({
      text: "a fix",
      commit: { sha: "abcdef1", href: "https://example.com/commit/abcdef1" },
    })
  })

  it("ignores lines outside a release or a section", () => {
    expect(parseChangelog("* stray\n### Orphan\n* item")).toEqual([])
  })
})
