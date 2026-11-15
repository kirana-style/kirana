import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vite-plus/test"

import {
  dependencyLevels,
  escapedName,
  exchangeRequest,
  finalTag,
  identityRequest,
  later,
  listedTarball,
  maxAgeOf,
  publishArgs,
  publishedTime,
  retryDelay,
  settlesAt,
  siblings,
  trustedPublishing,
} from "../npm-release.ts"
import type { Manifest } from "../npm-release.ts"

const pkg = (name: string, ...depends: string[]) => ({ name, depends })
const names = (levels: { name: string }[][]) =>
  levels.map((level) => level.map((each) => each.name))

describe("siblings", () => {
  it("counts every field an installer reads, and only Kirana's packages", () => {
    expect(
      siblings({
        name: "@kirana-style/angular",
        version: "0.5.0",
        dependencies: { "@kirana-style/core": "0.5.0", "magic-string": "^1" },
        peerDependencies: { "@kirana-style/vite": "0.5.0", vite: ">=7" },
        optionalDependencies: {
          "@kirana-style/compiler-linux-x64-gnu": "0.5.0",
        },
      }).sort()
    ).toEqual([
      "@kirana-style/compiler-linux-x64-gnu",
      "@kirana-style/core",
      "@kirana-style/vite",
    ])
    expect(
      siblings({
        name: "x",
        version: "1.0.0",
        dependencies: { "kirana-style": "0.5.0" },
      })
    ).toEqual(["kirana-style"])
  })
})

describe("dependencyLevels", () => {
  it("puts a package one level past the deepest it names, names sorted in a level", () => {
    const levels = dependencyLevels([
      pkg("@kirana-style/vite", "@kirana-style/rolldown", "@kirana-style/core"),
      pkg(
        "@kirana-style/compiler",
        "@kirana-style/core",
        "@kirana-style/compiler-linux-x64-gnu"
      ),
      pkg("@kirana-style/core"),
      pkg("@kirana-style/compiler-linux-x64-gnu"),
      pkg("@kirana-style/rolldown", "@kirana-style/compiler"),
      // Named but not published with the release: no level for it.
      pkg("@kirana-style/biome-plugin", "@kirana-style/elsewhere"),
    ])
    expect(names(levels)).toEqual([
      [
        "@kirana-style/biome-plugin",
        "@kirana-style/compiler-linux-x64-gnu",
        "@kirana-style/core",
      ],
      ["@kirana-style/compiler"],
      ["@kirana-style/rolldown"],
      ["@kirana-style/vite"],
    ])
  })

  it("refuses a cycle", () => {
    expect(() => dependencyLevels([pkg("a", "b"), pkg("b", "a")])).toThrow(
      /dependency cycle/
    )
  })

  // KF-122 asked whether the five levels could be fewer. They cannot while every sibling is named
  // by the release's version: the longest chain is plain dependencies. If this count changes,
  // `dependencyLevels`' comment and the release's expected duration change with it.
  it("gives the packages as they are published five levels, astro last", () => {
    const npm = path.resolve(import.meta.dirname, "../../npm")
    const published = readdirSync(npm).map((directory) => {
      const manifest = JSON.parse(
        readFileSync(path.join(npm, directory, "package.json"), "utf8")
      ) as Manifest
      // As `pack.ts` publishes it: the compiler names its engines.
      if (manifest.name === "@kirana-style/compiler")
        manifest.optionalDependencies = {
          "@kirana-style/compiler-linux-x64-gnu": manifest.version,
        }
      return { name: manifest.name, depends: siblings(manifest) }
    })
    published.push(pkg("@kirana-style/compiler-linux-x64-gnu"))
    const levels = names(dependencyLevels(published))
    expect(levels).toHaveLength(5)
    expect(levels[0]).toContain("@kirana-style/core")
    expect(levels[0]).toContain("@kirana-style/compiler-linux-x64-gnu")
    expect(levels[1]).toContain("@kirana-style/compiler")
    expect(levels[2]).toContain("@kirana-style/rolldown")
    expect(levels[3]).toContain("@kirana-style/vite")
    expect(levels[4]).toContain("@kirana-style/astro")
  })
})

describe("maxAgeOf", () => {
  it("reads the registry's cache-control", () => {
    expect(maxAgeOf("public, max-age=300")).toBe(300)
    expect(maxAgeOf("no-cache")).toBeUndefined()
    expect(maxAgeOf(null)).toBeUndefined()
  })
})

describe("settlesAt", () => {
  const now = Date.parse("2026-11-15T12:00:00Z")
  const minutes = (count: number) => count * 60_000

  it("waits the cache's age past the level's latest publish", () => {
    expect(settlesAt([now - minutes(1), now - minutes(2)], now, 300)).toBe(
      now + minutes(4)
    )
  })

  // A run that continues a release: the level before was published by an earlier run, whose date
  // the registry keeps, so only what is left of the cache's age is waited.
  it("dates a level an earlier run published from the registry's time", () => {
    expect(settlesAt([now - minutes(3)], now, 300)).toBe(now + minutes(2))
    expect(settlesAt([now - minutes(30)], now, 300)).toBeLessThan(now)
  })

  it("counts a date it cannot tell as now", () => {
    expect(settlesAt([undefined, now - minutes(3)], now, 300)).toBe(
      now + minutes(5)
    )
  })
})

describe("the token exchange", () => {
  it("asks GitHub for an identity with npm's audience, as npm does", () => {
    const request = identityRequest(
      "https://pipelines.actions.example/token?api-version=2.0",
      "request-token"
    )
    const url = new URL(request.url)
    expect(url.searchParams.get("api-version")).toBe("2.0")
    expect(url.searchParams.get("audience")).toBe("npm:registry.npmjs.org")
    expect(request.init.headers).toEqual({
      Accept: "application/json",
      Authorization: "Bearer request-token",
    })
  })

  it("asks npm the exchange npm publish asks, per package", () => {
    expect(exchangeRequest("@kirana-style/core", "identity")).toEqual({
      url: "https://registry.npmjs.org/-/npm/v1/oidc/token/exchange/package/@kirana-style%2fcore",
      init: { method: "POST", headers: { Authorization: "Bearer identity" } },
    })
    expect(exchangeRequest("kirana-style", "identity").url).toBe(
      "https://registry.npmjs.org/-/npm/v1/oidc/token/exchange/package/kirana-style"
    )
  })

  it("escapes a scoped name as npm does", () => {
    expect(escapedName("@kirana-style/compiler-wasm32-wasi")).toBe(
      "@kirana-style%2fcompiler-wasm32-wasi"
    )
  })

  it("needs npm 11.5.1 or later", () => {
    expect(
      ["11.5.1", "11.6.0", "12.0.0\n", "12.1.0-pre.1"].map(trustedPublishing)
    ).toEqual([true, true, true, true])
    expect(["11.5.0", "11.4.9", "10.9.4", ""].map(trustedPublishing)).toEqual([
      false,
      false,
      false,
      false,
    ])
  })
})

describe("uploads", () => {
  it("leaves the retries to the script", () => {
    expect(publishArgs("/tmp/core.tgz", "latest")).toEqual([
      "publish",
      "/tmp/core.tgz",
      "--access",
      "public",
      "--tag",
      "latest",
      "--fetch-retries",
      "0",
    ])
  })

  it("asks again after a registry failure, as long as attempts are left", () => {
    const unavailable = "npm error code E503\n"
    expect(
      [0, 1, 2, 3, 4].map((attempt) => retryDelay(attempt, unavailable))
    ).toEqual([15, 30, 60, 120, undefined])
  })

  it("stops on a refusal another attempt would meet again", () => {
    expect(retryDelay(0, "npm error code E404\n")).toBeUndefined()
    expect(retryDelay(0, "npm error code E401\n")).toBeUndefined()
  })

  it("ends on the tag the version belongs to, only ever forward", () => {
    expect(finalTag("0.5.0")).toBe("latest")
    expect(finalTag("0.5.0-rc.1")).toBe("next")
    expect(later("0.5.0", "0.4.1")).toBe(true)
    expect(later("0.4.1", "0.5.0")).toBe(false)
    expect(later("0.5.0", "0.5.0-rc.2")).toBe(true)
    expect(later("0.5.0-rc.10", "0.5.0-rc.2")).toBe(true)
    expect(later("0.5.0-rc.1", "0.5.0")).toBe(false)
    expect(later("0.5.0", "0.5.0")).toBe(false)
  })
})

describe("what the registry serves", () => {
  it("finds a version's tarball in the list an installer reads", () => {
    const listing = {
      versions: {
        "0.5.0": {
          dist: {
            tarball:
              "https://registry.npmjs.org/@kirana-style/core/-/core-0.5.0.tgz",
          },
        },
      },
    }
    expect(listedTarball(listing, "0.5.0")).toMatch(/core-0\.5\.0\.tgz$/)
    expect(listedTarball(listing, "0.5.1")).toBeUndefined()
    expect(listedTarball(undefined, "0.5.0")).toBeUndefined()
  })

  it("reads when a version was published", () => {
    const metadata = {
      time: { "0.4.1": "2026-11-09T07:15:02.132Z", "0.4.2": "soon" },
    }
    expect(publishedTime(metadata, "0.4.1")).toBe(
      Date.parse("2026-11-09T07:15:02.132Z")
    )
    expect(publishedTime(metadata, "0.4.2")).toBeUndefined()
    expect(publishedTime(metadata, "0.5.0")).toBeUndefined()
    expect(publishedTime({}, "0.4.1")).toBeUndefined()
  })
})
