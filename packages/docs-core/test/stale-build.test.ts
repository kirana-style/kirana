import { describe, expect, it } from "vite-plus/test"

import { isStaleBuildError, reloadOnce } from "../src/stale-build.ts"

describe("stale build", () => {
  it("recognises each browser's failed module import", () => {
    expect(
      isStaleBuildError(
        new TypeError(
          "Failed to fetch dynamically imported module: https://site/assets/pages-Be83JLBs.js"
        )
      )
    ).toBe(true)
    expect(isStaleBuildError("error loading dynamically imported module")).toBe(
      true
    )
    expect(
      isStaleBuildError(new Error("Importing a module script failed."))
    ).toBe(true)
    expect(
      isStaleBuildError(new Error("Unable to preload CSS for /assets/a.css"))
    ).toBe(true)
    expect(
      isStaleBuildError(new Error("Cannot read properties of undefined"))
    ).toBe(false)
    expect(isStaleBuildError(undefined)).toBe(false)
  })

  it("reloads once per address, then lets the error show", () => {
    const stored = new Map<string, string>()
    let reloads = 0
    let time = 1_000
    const host = {
      href: "https://site/docs",
      reload: () => reloads++,
      storage: {
        getItem: (key: string) => stored.get(key) ?? null,
        setItem: (key: string, value: string) => void stored.set(key, value),
      },
      now: () => time,
    }
    expect(reloadOnce(host)).toBe(true)
    expect(reloadOnce(host)).toBe(false)
    expect(reloads).toBe(1)
    // Ten seconds on, or another address, reloads again.
    time += 10_000
    expect(reloadOnce(host)).toBe(true)
    expect(reloadOnce({ ...host, href: "https://site/docs/other" })).toBe(true)
    expect(reloads).toBe(3)
  })

  it("reloads without storage, or with storage that refuses or holds nonsense", () => {
    let reloads = 0
    const base = { href: "h", reload: () => reloads++, now: () => 0 }
    expect(reloadOnce(base)).toBe(true)
    expect(
      reloadOnce({
        ...base,
        storage: {
          getItem: () => "{not json",
          setItem: () => {
            throw new Error("quota")
          },
        },
      })
    ).toBe(true)
    expect(
      reloadOnce({
        ...base,
        storage: { getItem: () => null, setItem: () => {} },
      })
    ).toBe(true)
    expect(reloads).toBe(3)
  })
})
