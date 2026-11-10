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
 * Angular Primitives' code by `NgpName`, the directives and components it exports, what each one's
 * code reaches and a part's name within its component (KF-102).
 */
function angularCode() {
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
    entry.replace(/(^|-)(\w)/g, (_, __, letter: string) => letter.toUpperCase())
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
  const partOf = (component: string, name: string) =>
    name === component
      ? "Root"
      : name.startsWith(component) &&
          /^[A-Z]/.test(name.slice(component.length))
        ? name.slice(component.length)
        : name
  return { modules, code, exported, reach, partOf }
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

  it("Reka UI, with every value its parts write in data-state (KF-115)", () => {
    const source = path.join(packageOf("reka-ui"), "src")
    const vocabulary = reka as unknown as Record<
      string,
      Record<string, Record<string, unknown>>
    >
    // The values a file's template writes in `data-state`: a static one, and the literals of a
    // bound expression (`checked ? 'checked' : 'unchecked'`) but those it compares with.
    const written = (file: string) =>
      [
        ...readFileSync(file, "utf8").matchAll(/\s(:?)data-state="([^"]*)"/g),
      ].flatMap(([, bound, value]) =>
        bound
          ? [...value!.matchAll(/(?<![=!]=\s*)'([a-z][a-z-]*)'/g)].map(
              ([, literal]) => literal!
            )
          : [value!]
      )
    const bare: string[] = []
    const lacking: string[] = []
    for (const component of readdirSync(source)) {
      const folder = path.join(source, component)
      const index = path.join(folder, "index.ts")
      if (!existsSync(index)) continue
      const exported = [
        ...readFileSync(index, "utf8").matchAll(
          /default as (\w+)[^}]*\}\s*from\s*["']\.\/(\w+)\.vue["']/g
        ),
      ].map(([, name, file]) => ({ name: name!, file: file! }))
      const vue = readdirSync(folder).filter((entry) => entry.endsWith(".vue"))
      for (const { name, file } of exported) {
        if (!name.startsWith(component)) continue
        const part = name === component ? "Root" : name.slice(component.length)
        const text = readFileSync(path.join(folder, `${file}.vue`), "utf8")
        // The part's file, its internal variants (`TooltipContentImpl`) and the components beside
        // it that it imports (`RadioGroupItem` renders `Radio`).
        const rendered = vue.filter(
          (entry) =>
            entry === `${file}.vue` ||
            (entry.startsWith(file) &&
              !exported.some((other) => `${other.file}.vue` === entry)) ||
            new RegExp(`import \\w+ from '\\./${entry}'`).test(text)
        )
        const values = new Set(
          rendered.flatMap((entry) => written(path.join(folder, entry)))
        )
        const state = vocabulary[component]?.[part]?.state
        if (typeof state === "string") bare.push(`${component}.${part}`)
        const selectors = Object.values(
          typeof state === "object" && state !== null ? state : {}
        )
        for (const value of values)
          if (!selectors.includes(`[data-state="${value}"]`))
            lacking.push(`${component}.${part}: ${value}`)
      }
    }
    // Reka never writes `data-state` empty: a part with the state has its values.
    expect({ bare, lacking }).toEqual({ bare: [], lacking: [] })
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
    const { code, exported, reach, partOf } = angularCode()
    const binds = (name: string) =>
      [...reach(name)].some((reached) =>
        // A binding, a host property, the renderer (`ngpFocusVisible`), or interactions turned on;
        // not the hints Password writes for password managers.
        /(?:data|attr)Binding\(\w+, 'data-(?!1p-ignore|lpignore|bwignore)|"attr\.data-|setAttribute\([^)]*'data-|ngpInteractions\(\{\s*\w/.test(
          code.get(reached)?.text ?? ""
        )
      )
    const vocabulary = ng as unknown as Record<string, Record<string, object>>
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

  it("Angular Primitives, with the presence of a state also written with a value (KF-100)", () => {
    const { modules } = angularCode()
    // A `dataBinding` that returns a literal on one branch and something else on the other
    // (`softDisabled() ? 'soft' : hardDisabled()`), which `dataBinding` writes empty when `true`.
    const both: string[] = []
    for (const file of readdirSync(modules).filter((name) =>
      name.endsWith(".mjs")
    ))
      for (const [, attribute, expression] of readFileSync(
        path.join(modules, file),
        "utf8"
      ).matchAll(/dataBinding\(\w+, '(data-[a-z-]+)', ([^\n]*)\);/g)) {
        const [, value] =
          /\? '([a-z-]+)' : (?!'|null|undefined)\w/.exec(expression!) ?? []
        if (value) both.push(`[${attribute}="${value}"]`)
      }
    const lacking: string[] = []
    for (const [component, parts] of Object.entries(
      ng as unknown as Record<string, Record<string, Record<string, unknown>>>
    ))
      for (const [part, states] of Object.entries(parts ?? {}))
        for (const [name, state] of Object.entries(states ?? {})) {
          if (typeof state !== "object" || state === null) continue
          const values = Object.values(state) as string[]
          const attribute = /^\[([\w-]+)=/.exec(values.at(-1)!)?.[1]
          if (
            values.some((selector) => both.includes(selector)) &&
            (state as Record<string, string>).any !== `[${attribute}]`
          )
            lacking.push(`${component}.${part}.${name}`)
        }
    expect(both).toContain('[data-disabled="soft"]')
    expect(lacking).toEqual([])
  })

  it("Angular Primitives, every part a portal renders with what the portal writes (KF-102)", () => {
    const { modules, code, exported, reach, partOf } = angularCode()
    const read = (entry: string) =>
      readFileSync(path.join(modules, `ng-primitives-${entry}.mjs`), "utf8")
    // The functions that write an attribute with `setAttribute` rather than a binding
    // (`setupExitAnimation`'s `data-enter` and `data-exit`), in any entry point.
    const writers = new Map<string, string[]>()
    for (const file of readdirSync(modules).filter((name) =>
      name.endsWith(".mjs")
    )) {
      const text = readFileSync(path.join(modules, file), "utf8")
      for (const match of text.matchAll(/^function (\w+)\(/gm)) {
        const body = text.slice(match.index, text.indexOf("\n}\n", match.index))
        const set = [
          ...body.matchAll(/\.setAttribute\('(data-[a-z-]+)', ''\)/g),
        ].map(([, attribute]) => attribute!)
        if (set.length) writers.set(match[1]!, set)
      }
    }
    const calls = (text: string) =>
      [...text.matchAll(/\b(\w+)\(/g)].flatMap(
        ([, call]) => writers.get(call!) ?? []
      )
    // What the portal's classes write as they attach an element, and what the overlay marks on
    // its portal's elements.
    const portal = read("portal")
    const rendered = [
      ...portal.matchAll(/^class \w+ extends NgpPortal \{[\s\S]*?\n\}\n/gm),
    ].flatMap(([body]) => calls(body))
    const overlaid = [
      ...portal.matchAll(
        /of portal\.getElements\(\)\) \{\s*\w+\.setAttribute\('(data-[a-z-]+)', ''\)/g
      ),
    ].map(([, attribute]) => attribute!)
    // A toast's portal is created with the hook its `NgpToast` registers itself through.
    const registered = [
      ...read("toast").matchAll(/provide(\w+)\(\{[^}]*\bregister:/g),
    ].map(([, name]) => `inject${name}()`)
    expect(new Set(rendered)).toEqual(new Set(["data-enter", "data-exit"]))
    expect(overlaid).toEqual(["data-instant"])
    expect(registered).toEqual(["injectToastOptions()"])
    const vocabulary = ng as unknown as Record<string, Record<string, object>>
    const short: string[] = []
    for (const { component, name } of exported) {
      const text = [...reach(name)]
        .map((reached) => code.get(reached)?.text ?? "")
        .join("\n")
      const expected = new Set(calls(text))
      if (/\boverlay\b[^\n;]*?\.position\(\)/.test(text))
        for (const attribute of [...rendered, ...overlaid])
          expected.add(attribute)
      if (
        registered.some((call) => text.includes(call)) &&
        text.includes(".register(this)")
      )
        for (const attribute of rendered) expected.add(attribute)
      const own = vocabulary[component]?.[partOf(component, name)] ?? {}
      const lacking = [...expected].filter(
        (attribute) =>
          !(
            attribute
              .slice("data-".length)
              .replace(/-(\w)/g, (_, letter: string) => letter.toUpperCase()) in
            own
          )
      )
      if (lacking.length)
        short.push(`${component}.${name}: ${lacking.join(", ")}`)
    }
    expect(short).toEqual([])
  })
})
