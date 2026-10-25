import { existsSync, readdirSync, readFileSync, realpathSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vite-plus/test"

import * as ark from "../src/ark-ui.ts"
import * as bits from "../src/bits-ui.ts"
import * as reka from "../src/reka-ui.ts"

/** A package's directory: Bits UI's `exports` hide its `package.json` from the resolver. */
const packageOf = (name: string) =>
  realpathSync(path.join(import.meta.dirname, "../../../node_modules", name))

/** Every file under a directory. */
const files = (directory: string): string[] =>
  readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(entry.parentPath, entry.name))

/**
 * Each library's components that write a state, read more simply than the generator does (any
 * `data-*` attribute their files set that is not a part's name on its element), against the
 * vocabulary (KF-032): a component a library adds is not missed.
 */
describe("every component that writes a state has a vocabulary", () => {
  it("Bits UI", () => {
    const root = path.join(packageOf("bits-ui"), "dist/bits")
    const index = readFileSync(path.join(root, "index.d.ts"), "utf8")
    const missing: string[] = []
    for (const [, names, folder] of index.matchAll(
      /export \{ ([^}]+) \} from "\.\/([\w-]+)\/index\.js"/g
    )) {
      const component = names!
        .split(",")
        .map((name) => name.trim())
        .find((name) => /^[A-Z]/.test(name))!
      const writes = files(path.join(root, folder!))
        .filter((file) => file.endsWith(".svelte.d.ts"))
        .some((file) =>
          [
            ...readFileSync(file, "utf8").matchAll(
              /readonly "data-([a-z][a-z0-9-]*)"/g
            ),
          ].some(([, name]) => !name!.startsWith(`${folder}-`))
        )
      if (writes && !(component in bits)) missing.push(component)
    }
    expect(missing).toEqual([])
  })

  it("Ark UI", () => {
    const zag = JSON.parse(
      readFileSync(
        path.join(packageOf("@zag-js/docs"), "data/data-attr.json"),
        "utf8"
      )
    ) as Record<string, Record<string, Record<string, string>>>
    const components = path.join(packageOf("@ark-ui/react"), "dist/components")
    // Machinery with no state of its own to style: presence, a swap's animation, a JSON viewer's nodes.
    const internal = new Set(["Presence", "Swap", "JsonTreeView"])
    const missing: string[] = []
    for (const folder of readdirSync(components)) {
      const component = folder.replace(/(^|-)(\w)/g, (_, __, letter: string) =>
        letter.toUpperCase()
      )
      if (internal.has(component)) continue
      const machine = Object.values(zag[folder] ?? {}).some((attributes) =>
        Object.keys(attributes).some(
          (name) => name !== "data-scope" && name !== "data-part"
        )
      )
      const hook = path.join(components, folder, `use-${folder}.js`)
      const own =
        existsSync(hook) && readFileSync(hook, "utf8").includes("dataAttr(")
      if ((machine || own) && !(component in ark)) missing.push(component)
    }
    expect(missing).toEqual([])
  })

  it("Reka UI", () => {
    const source = path.join(packageOf("reka-ui"), "src")
    const missing: string[] = []
    for (const component of readdirSync(source)) {
      const folder = path.join(source, component)
      if (!existsSync(path.join(folder, "index.ts"))) continue
      const writes = readdirSync(folder)
        .filter((entry) => entry.endsWith(".vue"))
        .some((entry) =>
          /[\s:]data-(?!reka-)[a-z]/.test(
            readFileSync(path.join(folder, entry), "utf8")
          )
        )
      if (writes && !(component in reka)) missing.push(component)
    }
    expect(missing).toEqual([])
  })
})
