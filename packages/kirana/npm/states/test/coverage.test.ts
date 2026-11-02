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

/** Zag's data-attribute reference, by machine and part. */
const zagReference = () =>
  JSON.parse(
    readFileSync(
      path.join(packageOf("@zag-js/docs"), "data/data-attr.json"),
      "utf8"
    )
  ) as Record<string, Record<string, Record<string, string>>>

/** An Ark UI component's hook, and the machine it imports: Segment Group runs Radio Group's (KF-087). */
function arkHook(components: string, folder: string) {
  const hook = path.join(components, folder, `use-${folder}.js`)
  const source = existsSync(hook) ? readFileSync(hook, "utf8") : ""
  const runs =
    [...source.matchAll(/from "@zag-js\/([a-z-]+)"/g)]
      .map(([, name]) => name!)
      .find((name) => name !== "react") ?? folder
  return { source, runs }
}

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
    const zag = zagReference()
    const components = path.join(packageOf("@ark-ui/react"), "dist/components")
    // Machinery with no state of its own to style: presence, a swap's animation, a JSON viewer's nodes.
    const internal = new Set(["Presence", "Swap", "JsonTreeView"])
    const missing: string[] = []
    for (const folder of readdirSync(components)) {
      const component = folder.replace(/(^|-)(\w)/g, (_, __, letter: string) =>
        letter.toUpperCase()
      )
      if (internal.has(component)) continue
      const { source, runs } = arkHook(components, folder)
      const machine = Object.values(zag[runs] ?? {}).some((attributes) =>
        Object.keys(attributes).some(
          (name) => name !== "data-scope" && name !== "data-part"
        )
      )
      const own = source.includes("dataAttr(")
      if ((machine || own) && !(component in ark)) missing.push(component)
    }
    expect(missing).toEqual([])
  })

  it("Ark UI's parts, by the getters their modules call", () => {
    const zag = zagReference()
    const components = path.join(packageOf("@ark-ui/react"), "dist/components")
    const missing: string[] = []
    for (const [component, parts] of Object.entries(ark)) {
      if (component === "exclusive") continue
      const folder = component.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase()
      const { runs } = arkHook(components, folder)
      // `export { MenuCheckboxItem as CheckboxItem }`, from `./menu-checkbox-item.js`: a part whose
      // module calls a getter the reference gives states (`getOptionItemProps`) has them (R3-FIX-27).
      // `RootProvider` renders the root's element, under `Root`'s keys.
      const namespace = readFileSync(
        path.join(components, folder, `${folder}.js`),
        "utf8"
      )
      for (const [, local, part] of namespace.matchAll(
        /(\w+) as ([A-Z]\w*)/g
      )) {
        const file = namespace.match(
          new RegExp(`import \\{ ${local} \\} from "\\./([\\w-]+\\.js)"`)
        )?.[1]
        if (!file || part === "RootProvider") continue
        const writes = [
          ...readFileSync(path.join(components, folder, file), "utf8").matchAll(
            /\.get([A-Z]\w*?)(?:Props)?\b/g
          ),
        ].some(([, name]) =>
          Object.keys(zag[runs]?.[name!] ?? {}).some(
            (attribute) =>
              attribute !== "data-scope" && attribute !== "data-part"
          )
        )
        if (writes && !(part! in parts)) missing.push(`${component}.${part}`)
      }
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
