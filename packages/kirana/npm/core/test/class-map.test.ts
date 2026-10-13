import { mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterAll, describe, expect, it } from "vitest"

import { ClassMap, classMap } from "../src/class-map.ts"

const MAP = {
  version: 1,
  prefix: "k",
  families: { four: 45, two: 111 },
  classes: {
    card: "k3_aaaa k1x_bbbb",
    "card.active": "k3_cccc",
    quiet: "k3_",
  },
}

const directory = mkdtempSync(path.join(tmpdir(), "kirana-class-map-"))
afterAll(() => rmSync(directory, { recursive: true, force: true }))

describe("D-069 the class map in Node.js", () => {
  it("merges named handles, later winning, without tombstones", () => {
    const map = new ClassMap(MAP)
    expect(map.classes("card", "card.active")).toBe("k1x_bbbb k3_cccc")
    expect(map.classes("card", null, false, undefined, "")).toBe(
      "k3_aaaa k1x_bbbb"
    )
    expect(map.classes("card", "quiet")).toBe("k1x_bbbb")
    expect(map.classes()).toBe("")
    expect(map.has("card.active")).toBe(true)
    expect(map.has("toString")).toBe(false)
  })

  it("fails loudly on unknown names and other versions", () => {
    expect(() => new ClassMap(MAP).classes("button")).toThrow(
      'kirana: no style named "button" in the class map'
    )
    // An object's own names only: `toString` is not a style.
    expect(() => new ClassMap(MAP).classes("toString")).toThrow("toString")
    expect(() => new ClassMap({ version: 2 })).toThrow("another version")
    expect(new ClassMap({ version: 1 }).classes()).toBe("")
  })

  it("reads the file, and again when it changes", () => {
    const file = path.join(directory, "classes.json")
    expect(() => classMap(file)).toThrow(
      "run `kirana dev` or `kirana build` first"
    )
    writeFileSync(file, JSON.stringify(MAP))
    const first = classMap(file)
    expect(classMap(file)).toBe(first)
    writeFileSync(
      file,
      JSON.stringify({ ...MAP, classes: { card: "k3_dddd" } })
    )
    const later = new Date(Date.now() + 5000)
    utimesSync(file, later, later)
    expect(classMap(file).classes("card")).toBe("k3_dddd")
    expect(ClassMap.fromFile(file).has("card")).toBe(true)
  })
})
