import { existsSync, readdirSync, readFileSync, realpathSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vite-plus/test"

import * as ark from "../src/ark-ui.ts"
import * as bits from "../src/bits-ui.ts"
import * as ng from "../src/ng-primitives.ts"
import * as reka from "../src/reka-ui.ts"
import { entries } from "./entries.ts"

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

  it("Angular Primitives, by the directives that bind a state (KF-099)", () => {
    const modules = path.join(packageOf("ng-primitives"), "fesm2022")
    // The entry points that hold the library's machinery rather than components.
    const machinery = new Set([
      "state",
      "internal",
      "utils",
      "interactions",
      "a11y",
      "common",
      "portal",
    ])
    const vocabulary = ng as unknown as Record<string, Record<string, unknown>>
    const missing: string[] = []
    for (const file of readdirSync(modules)) {
      const entry = /^ng-primitives-([\w-]+)\.mjs$/.exec(file)?.[1]
      if (!entry || machinery.has(entry)) continue
      const component = entry.replace(/(^|-)(\w)/g, (_, __, letter: string) =>
        letter.toUpperCase()
      )
      const text = readFileSync(path.join(modules, file), "utf8")
      // A state written through `createPrimitive`'s bindings, or the interactions it turns on.
      if (
        /dataBinding\(\w+, 'data-|ngpInteractions\(\{/.test(text) &&
        !(component in vocabulary)
      )
        missing.push(component)
      // A state a directive binds in its declaration's host properties, part by part.
      for (const [, call] of text.matchAll(
        /ngDeclareDirective\((\{[^\n]*\})\)/g
      )) {
        if (!call!.includes('"attr.data-')) continue
        const name = /type: Ngp(\w+),/.exec(call!)![1]!
        const part =
          name === component
            ? "Root"
            : name.startsWith(component)
              ? name.slice(component.length)
              : name
        if (!(part in (vocabulary[component] ?? {})))
          missing.push(`${component}.${part}`)
      }
    }
    expect(missing).toEqual([])
  })

  it("Angular Primitives, every part it exports with what the code it composes binds (KF-102)", () => {
    const modules = path.join(packageOf("ng-primitives"), "fesm2022")
    const machinery = new Set([
      "state",
      "internal",
      "utils",
      "interactions",
      "a11y",
      "common",
      "portal",
    ])
    const pascal = (entry: string) =>
      entry.replace(/(^|-)(\w)/g, (_, __, letter: string) =>
        letter.toUpperCase()
      )
    // Every `NgpName`'s code, in any entry point: a directive's class, a `createPrimitive` body,
    // a function (`ngpFormControl`), each up to the line that closes it.
    const code = new Map<string, { component: string; text: string }>()
    const exported: { component: string; name: string }[] = []
    for (const file of readdirSync(modules)) {
      const entry = /^ng-primitives-([\w-]+)\.mjs$/.exec(file)?.[1]
      if (!entry) continue
      const component = pascal(entry)
      const text = readFileSync(path.join(modules, file), "utf8")
      for (const match of text.matchAll(
        /^(?:class Ngp(\w+) \{|function ngp([A-Z]\w*)\(|.*createPrimitive\('Ngp(\w+)')/gm
      )) {
        const name = match[1] ?? match[2] ?? match[3]!
        const end = match[3] ? "\n});" : "\n}\n"
        const body = text.slice(match.index, text.indexOf(end, match.index))
        code.set(name, { component, text: (code.get(name)?.text ?? "") + body })
      }
      const names = [...text.matchAll(/^export \{([^}]*)\}/gm)].flatMap(
        ([, list]) => list!.split(",").map((name) => name.trim())
      )
      // The directives and components it exports, not its services (`NgpToastManager`).
      if (!machinery.has(entry))
        for (const [, name] of text.matchAll(/^class Ngp(\w+) \{/gm))
          if (
            names.includes(`Ngp${name}`) &&
            /\.ɵ(?:dir|cmp) = /.test(code.get(name!)!.text)
          )
            exported.push({ component, name: name! })
    }
    // What a name's code reaches: the functions it calls and the directives it hosts, at any depth.
    const reach = (name: string, seen = new Set<string>()): Set<string> => {
      seen.add(name)
      const text = code.get(name)?.text ?? ""
      const hosted = [...text.matchAll(/hostDirectives: \[([^\]]*)\]/g)]
        .map(([, list]) => list)
        .join()
      for (const [, called] of [
        ...text.matchAll(/\bngp([A-Z]\w*)\(/g),
        ...hosted.matchAll(/\bNgp(\w+)/g),
      ])
        if (!seen.has(called!)) reach(called!, seen)
      return seen
    }
    const binds = (name: string) =>
      [...reach(name)].some((reached) =>
        // A binding, a host property, the renderer (`ngpFocusVisible`), or interactions turned on;
        // not the hints Password writes for password managers.
        /(?:data|attr)Binding\(\w+, 'data-(?!1p-ignore|lpignore|bwignore)|"attr\.data-|setAttribute\([^)]*'data-|ngpInteractions\(\{\s*\w/.test(
          code.get(reached)?.text ?? ""
        )
      )
    const vocabulary = ng as unknown as Record<string, Record<string, object>>
    const partOf = (component: string, name: string) =>
      name === component
        ? "Root"
        : name.startsWith(component) &&
            /^[A-Z]/.test(name.slice(component.length))
          ? name.slice(component.length)
          : name
    const keys = (states: object | undefined) =>
      entries({ X: { P: states ?? {} } }).map(([, , state]) => state)
    const missing: string[] = []
    const short: string[] = []
    for (const { component, name } of exported) {
      const part = partOf(component, name)
      const own = vocabulary[component]?.[part]
      if (!own && binds(name)) missing.push(`${component}.${part}`)
      // An accordion item takes its collapsible's states, a menu item its button's.
      for (const reached of reach(name)) {
        const other = code.get(reached)
        if (!other || reached === name) continue
        const composed =
          vocabulary[other.component]?.[partOf(other.component, reached)]
        const lacking = keys(composed).filter((key) => !keys(own).includes(key))
        if (lacking.length)
          short.push(`${component}.${part} (${reached}): ${lacking.join(", ")}`)
      }
    }
    expect(exported.length).toBeGreaterThan(150)
    expect({ missing, short }).toEqual({ missing: [], short: [] })
  })

  it("Angular Primitives, with the values of every state its types enumerate (KF-100)", () => {
    const types = path.join(packageOf("ng-primitives"), "types")
    const declarations = readdirSync(types)
      .filter((file) => file.endsWith(".d.ts"))
      .map((file) => readFileSync(path.join(types, file), "utf8"))
      .join("\n")
    // Types with a fixed set of string values: unions of literals, and string enums.
    const enumerated = new Set([
      ...[
        ...declarations.matchAll(
          /\btype (\w+) = ('[^';]+'(?: \| '[^';]+')+);/g
        ),
      ].map((match) => match[1]!),
      ...[...declarations.matchAll(/\benum (\w+) \{\s*\w+ = "/g)].map(
        (match) => match[1]!
      ),
    ])
    for (const [, alias, target] of declarations.matchAll(
      /\btype (\w+) = (\w+);/g
    ))
      if (enumerated.has(target!)) enumerated.add(alias!)
    // The members declared as a signal of one: `orientation?: Signal<NgpOrientation>`.
    const members = new Set(
      [
        ...declarations.matchAll(
          /\b(\w+)\??: (?:\w+\.)?(?:Writable|Input)?Signal<(\w+)(?: \| undefined)?>;/g
        ),
      ]
        .filter((match) => enumerated.has(match[2]!))
        .map((match) => match[1]!)
    )
    const vocabulary = ng as unknown as Record<
      string,
      Record<string, Record<string, unknown>>
    >
    const presences: string[] = []
    for (const [component, parts] of Object.entries(vocabulary))
      for (const [part, states] of Object.entries(parts ?? {}))
        for (const [name, selector] of Object.entries(states ?? {}))
          if (members.has(name) && typeof selector === "string")
            presences.push(`${component}.${part}.${name}`)
    expect(members.size).toBeGreaterThan(0)
    expect(presences).toEqual([])
  })
})
