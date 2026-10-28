import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vite-plus/test"

const workspace = path.resolve(import.meta.dirname, "../../../..")

describe("release-please-config.json", () => {
  // Release Please bumps only the files it lists. A package left out keeps the old version while
  // the rest move, and the release pull request fails on the site's one-version check.
  it("bumps the version of every npm package", () => {
    const config = JSON.parse(
      readFileSync(path.join(workspace, "release-please-config.json"), "utf8")
    ) as {
      packages: {
        [path: string]: { "extra-files"?: ({ path: string } | string)[] }
      }
    }
    const listed = new Set(
      Object.values(config.packages).flatMap((entry) =>
        (entry["extra-files"] ?? []).map((file) =>
          typeof file === "string" ? file : file.path
        )
      )
    )
    const packages = readdirSync(path.join(workspace, "packages/kirana/npm"))
      .map((name) => `packages/kirana/npm/${name}/package.json`)
      .sort()
    expect(packages.filter((file) => !listed.has(file))).toEqual([])
  })

  // A sibling written as a fixed version stays there while the release moves on: 0.3.4's Angular
  // and Ember adapters asked for `@kirana-style/vite` 0.1.0 (KF-048). `workspace:*` is packed as the
  // release's version.
  it("names every sibling package by workspace, never by a fixed version", () => {
    const fixed = readdirSync(
      path.join(workspace, "packages/kirana/npm")
    ).flatMap((name) => {
      const manifest = JSON.parse(
        readFileSync(
          path.join(workspace, "packages/kirana/npm", name, "package.json"),
          "utf8"
        )
      ) as Record<string, Record<string, string> | undefined>
      return [
        "dependencies",
        "peerDependencies",
        "optionalDependencies",
        "devDependencies",
      ].flatMap((field) =>
        Object.entries(manifest[field] ?? {})
          .filter(
            ([dependency, range]) =>
              dependency.startsWith("@kirana-style/") &&
              !range.startsWith("workspace:")
          )
          .map(
            ([dependency, range]) => `${name} ${field} ${dependency}@${range}`
          )
      )
    })
    expect(fixed).toEqual([])
  })
})
