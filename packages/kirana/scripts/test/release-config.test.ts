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
})
