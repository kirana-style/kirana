import { existsSync, readFileSync, realpathSync } from "node:fs"
import path from "node:path"

import { css } from "@kirana-style/core"
import { describe, expect, it } from "vite-plus/test"

import * as bits from "../src/bits-ui.ts"
import * as ng from "../src/ng-primitives.ts"
import * as reka from "../src/reka-ui.ts"
import { entries, SELECTOR } from "./entries.ts"

/** A package's directory: Bits UI's `exports` hide its `package.json` from the resolver. */
const packageOf = (name: string) =>
  realpathSync(path.join(import.meta.dirname, "../../../node_modules", name))

/** Reka UI, Bits UI and Angular Primitives: the vocabularies read from each library's own code. */
describe("@kirana-style/states for Vue, Svelte and Angular libraries", () => {
  it("names only parts each library exports", () => {
    const rekaSource = path.join(packageOf("reka-ui"), "src")
    for (const [component, part] of entries(reka)) {
      const index = readFileSync(
        path.join(rekaSource, component, "index.ts"),
        "utf8"
      )
      const name =
        part === "Root" && !index.includes(`default as ${component}Root`)
          ? component
          : `${component}${part}`
      expect(index, `${component}.${part}`).toContain(`default as ${name}`)
    }
    const bitsSource = path.join(packageOf("bits-ui"), "dist/bits")
    const folders = new Map(
      [
        ...readFileSync(path.join(bitsSource, "index.d.ts"), "utf8").matchAll(
          /export \{ ([^}]+) \} from "\.\/([\w-]+)\/index\.js"/g
        ),
      ].flatMap(([, names, folder]) =>
        names!
          .split(",")
          .map((name) => name.trim())
          .map((name) => [name, folder!] as const)
      )
    )
    for (const [component, part] of entries(bits)) {
      const exports = readFileSync(
        path.join(bitsSource, folders.get(component)!, "exports.d.ts"),
        "utf8"
      )
      expect(exports, `${component}.${part}`).toContain(`default as ${part} }`)
    }
    const ngModules = path.join(packageOf("ng-primitives"), "fesm2022")
    for (const [component, part] of entries(ng)) {
      const kebab = component.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase()
      const file = path.join(ngModules, `ng-primitives-${kebab}.mjs`)
      expect(existsSync(file), component).toBe(true)
      const directive =
        part === "Root" ? `Ngp${component}` : `Ngp${component}${part}`
      expect(readFileSync(file, "utf8"), `${component}.${part}`).toMatch(
        new RegExp(`class (?:${directive}|Ngp${part}) \\{`)
      )
    }
  })

  it("holds attribute selectors only, one per state or value", () => {
    for (const vocabulary of [reka, bits, ng]) {
      const all = entries(vocabulary)
      expect(all.length).toBeGreaterThan(200)
      for (const [component, part, state, selector] of all)
        expect(selector, `${component}.${part}.${state}`).toMatch(SELECTOR)
    }
    // A value read from the template, through the helper it calls.
    expect(reka.Checkbox.Root.state.indeterminate).toBe(
      '[data-state="indeterminate"]'
    )
    // An attribute set by the component the part renders through (`PopperContent`).
    expect(reka.Popover.Content.side).toBe("[data-side]")
    expect(bits.Popover.Content.state.open).toBe('[data-state="open"]')
    expect(bits.Popover.Content.startingStyle).toBe("[data-starting-style]")
    // Angular Primitives' interactions, which `ngpInteractions()` turns on.
    expect(ng.Checkbox.Root.hover).toBe("[data-hover]")
    expect(ng.Checkbox.Root.checked).toBe("[data-checked]")
  })

  it("compiles as condition keys", () => {
    const thumb = css({
      opacity: { [reka.Switch.Root.state.checked]: 1 },
      color: { [bits.Switch.Root.state.checked]: "red" },
      translate: { [ng.Switch.Root.checked]: "1rem" },
    })
    expect(String(thumb)).toMatch(/^k\S+( k\S+){2}$/)
  })
})
