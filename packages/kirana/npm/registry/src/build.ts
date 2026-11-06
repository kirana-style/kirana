/**
 * `kirana-style ui build [registry.json] --out <dir>` (KRN-DX-034): a source registry built into
 * the documents `ui add` reads. The source lists each item as the item schema writes it, but each
 * file names the source it is read from (`{ "source": "src/ui/button.tsx", "type": "ui" }`, or the
 * path alone where a folder says its type) in place of its content. Each file is read; an import of
 * another of the registry's files (`./button.styles`, `../lib/utils`) is written as an installed
 * project names it, `@/registry/<type>/<path>`, or `./<name>` beside it; the packages it imports
 * become the item's dependencies, at the ranges the registry's `package.json` gives, and the items
 * that hold what it imports its registry dependencies; it is hashed. Every item is checked against
 * the schema, and `<out>/<name>.json` and `<out>/index.json` are written, nothing when a problem is
 * found. Grown from Kirana UI's builder, which builds its registry with `buildRegistry`.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

import { check, hashOf } from "./check.ts"
import { parseArgs } from "./command.ts"
import { RegistryError } from "./read.ts"
import type { FileType, Framework, Item, RegistryFile } from "./types.ts"

/** A file in the source: where it is read from, and where it installs. */
export type SourceFile =
  | string
  | { source: string; type?: FileType; path?: string; target?: string }

type Packages = Record<string, string>

/** A framework's base in the source. */
export type SourceBase = {
  files: SourceFile[]
  dependencies?: Packages
  registryDependencies?: string[]
}

/** An item in the source: the item schema's fields, files by their source. */
export type SourceItem = Omit<
  Item,
  "$schema" | "styles" | "files" | "frameworks"
> & {
  styles?: SourceFile[]
  files?: SourceFile[]
  frameworks?: Partial<Record<Framework, Record<string, SourceBase>>>
}

/** A source registry, `registry.json`. */
export type SourceRegistry = {
  $schema?: string
  name?: string
  homepage?: string
  items: SourceItem[]
}

export const ITEM_SCHEMA_URL = "https://kirana.style/schema/registry-item.json"
export const INDEX_SCHEMA_URL =
  "https://kirana.style/schema/registry-index.json"

/** Packages a project has by being of its framework, or by having Kirana: never a dependency. */
const PROVIDED = new Set([
  "react",
  "react-dom",
  "vue",
  "svelte",
  "solid-js",
  "@angular/core",
  "kirana-style",
])

/** The folder that names a file's type, when the source does not: `src/ui/button.tsx` is `ui`. */
const FOLDERS: [string, FileType][] = [
  ["ui", "ui"],
  ["lib", "lib"],
  ["hooks", "hook"],
  ["components", "component"],
  ["blocks", "component"],
  ["pages", "page"],
]

/**
 * A module specifier after `from`, `import` or `import(`: each part matches what the next cannot, so
 * the pattern stays linear on any source (no run that can stretch over the next statement).
 */
const IMPORT =
  /\bfrom\s*(["'])([^"'\n]+)\1|\bimport\s*(?:\(\s*)?(["'])([^"'\n]+)\3/g

/**
 * The code without its comments: block comments (an unclosed one to the end), and line comments
 * that are not a URL's `://`. A scan, not a pattern: it is linear in the source, whatever it holds.
 */
export function withoutComments(code: string): string {
  let out = ""
  let at = 0
  // The next `/*` and the next `//` that is no URL's, each found again only once passed.
  let block = -1
  let line = -1
  const next = (from: number) => {
    if (block < from && block !== Infinity)
      block =
        code.indexOf("/*", from) === -1 ? Infinity : code.indexOf("/*", from)
    if (line < from && line !== Infinity) {
      let found = code.indexOf("//", from)
      while (found > 0 && code[found - 1] === ":")
        found = code.indexOf("//", found + 2)
      line = found === -1 ? Infinity : found
    }
  }
  for (next(0); block !== Infinity || line !== Infinity; next(at)) {
    const start = Math.min(block, line)
    out += code.slice(at, start)
    const end =
      start === block
        ? code.indexOf("*/", start + 2)
        : code.indexOf("\n", start + 2)
    at = end === -1 ? code.length : start === block ? end + 2 : end
  }
  return out + code.slice(at)
}

/** Every module a file's source imports; comments first, so one's apostrophe hides no statement. */
export function importsOf(code: string): string[] {
  return [...withoutComments(code).matchAll(IMPORT)].map(
    (match) => match[2] ?? match[4]!
  )
}

/** The npm package a specifier names: `@scope/name` or `name`. */
export const packageOf = (specifier: string) =>
  specifier
    .split("/")
    .slice(0, specifier.startsWith("@") ? 2 : 1)
    .join("/")

/** A source file's place: its type, its path under the type's alias, and a `file`'s target. */
export function sourcePlace(file: SourceFile): {
  source: string
  type: FileType
  path: string
  target?: string
} {
  const entry = typeof file === "string" ? { source: file } : file
  const source = entry.source.replaceAll("\\", "/").replace(/^\.\//, "")
  // The deepest folder that names a type (the given one, if any): `components/ui/x` is `ui`.
  const parts = source.split("/").slice(0, -1)
  let type = entry.type
  let at = -1
  for (const [folder, folderType] of FOLDERS) {
    const found = parts.lastIndexOf(folder)
    if (found > at && (entry.type === undefined || entry.type === folderType)) {
      at = found
      type = folderType
    }
  }
  if (type === undefined)
    throw new RegistryError(
      `${source}: no folder says its type (ui/, lib/, hooks/, components/, blocks/, pages/): give it a "type"`
    )
  const all = source.split("/")
  const place =
    entry.path ?? (at >= 0 ? all.slice(at + 1).join("/") : all.at(-1)!)
  return {
    source,
    type,
    path: place,
    ...(entry.target === undefined ? {} : { target: entry.target }),
  }
}

const SCRIPT = /\.(ts|tsx|js|jsx|mjs|mts)$/
const EXTENSION = /\.(ts|tsx|js|jsx|mjs|mts|vue|svelte|css|json)$/
const RESOLVE = [
  "",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".vue",
  ".svelte",
  "/index.ts",
  "/index.tsx",
  "/index.js",
]

/** A place as an import names it: without a script's extension. */
const named = (place: string) => place.replace(SCRIPT, "")

type Located = {
  item: string
  type: FileType
  path: string
}

/** The registry built: each item, the index, and what stopped it. */
export type Built = {
  items: Item[]
  index: {
    $schema: string
    name?: string
    homepage?: string
    items: {
      name: string
      type: Item["type"]
      title?: string
      description?: string
      version: string
      frameworks?: Partial<Record<Framework, string[]>>
    }[]
  }
  problems: string[]
}

/**
 * The registry's items and index, from its source. `root` is where the sources are read from;
 * `versions` gives a package's range (the registry's `package.json` by default, `versionsFrom`).
 */
export function buildRegistry(
  source: SourceRegistry,
  root: string,
  versions: (name: string) => string | undefined = versionsFrom(root)
): Built {
  const problems: string[] = []
  // Every source file's item and place, the item's own first.
  const located = new Map<string, Located[]>()
  /** The items holding each installed place (`lib/utils`), the first the one others import. */
  const holders = new Map<string, string[]>()
  type Group = { key: string; files: ReturnType<typeof sourcePlace>[] }
  const groupsOf = (item: SourceItem): Group[] => {
    const groups: Group[] = []
    const place = (key: string, files: SourceFile[] | undefined) => {
      if (files === undefined) return
      try {
        groups.push({ key, files: files.map(sourcePlace) })
      } catch (error) {
        problems.push(`${item.name}: ${(error as Error).message}`)
      }
    }
    place("styles", item.styles)
    place("files", item.files)
    for (const [framework, bases] of Object.entries(item.frameworks ?? {}))
      for (const [base, entry] of Object.entries(bases))
        place(`${framework}/${base}`, entry.files)
    return groups
  }
  const groups = new Map<SourceItem, Group[]>()
  for (const item of source.items) {
    if (item.name === "index")
      problems.push("index: an item cannot be named index")
    const found = groupsOf(item)
    groups.set(item, found)
    for (const { files } of found)
      for (const file of files) {
        located.set(file.source, [
          ...(located.get(file.source) ?? []),
          { item: item.name, type: file.type, path: file.path },
        ])
        const key = `${file.type}/${named(file.path)}`
        holders.set(key, [...(holders.get(key) ?? []), item.name])
      }
  }

  /** The registry file a relative import names, from the importing file. */
  const resolve = (from: string, specifier: string) => {
    const base = path.posix.join(path.posix.dirname(from), specifier)
    return RESOLVE.map((extension) => `${base}${extension}`).find((candidate) =>
      located.has(candidate)
    )
  }

  const items = source.items.map((item): Item => {
    const dependencies: Packages = { ...item.dependencies }
    const registryDependencies = new Set(item.registryDependencies ?? [])
    /** One file read, its imports written for an installed project, its dependencies gathered. */
    const build = (
      file: ReturnType<typeof sourcePlace>,
      into: { packages: Packages; items: Set<string>; declared: Packages }
    ): RegistryFile | undefined => {
      const where = `${item.name}: ${file.source}`
      const absolute = path.resolve(root, file.source)
      if (!existsSync(absolute)) {
        problems.push(`${where}: not found`)
        return undefined
      }
      const own = located
        .get(file.source)!
        .find((place) => place.item === item.name)!
      let content = readFileSync(absolute, "utf8").replace(
        /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(["'])(\.{1,2}\/[^"']+)\2/g,
        (whole, lead: string, quote: string, specifier: string) => {
          const target = resolve(file.source, specifier)
          if (target === undefined) {
            problems.push(
              `${where}: imports ${specifier}, which is not a file of the registry`
            )
            return whole
          }
          const places = located.get(target)!
          const place =
            places.find((entry) => entry.item === item.name) ?? places[0]!
          if (place.item !== item.name) into.items.add(place.item)
          // A folder's `index`, imported by the folder, keeps being imported by the folder.
          const imported = specifier.endsWith("index")
            ? named(place.path)
            : named(place.path).replace(/\/index$/, "")
          // A specifier that names its file's extension (`./Button.vue`) keeps it.
          const keep = EXTENSION.test(specifier) ? place.path : imported
          const beside =
            place.type === own.type &&
            path.posix.dirname(place.path) === path.posix.dirname(own.path)
          return `${lead}${quote}${beside ? `./${path.posix.basename(keep)}` : `@/registry/${place.type}/${keep}`}${quote}`
        }
      )
      for (const specifier of importsOf(content)) {
        if (specifier.startsWith(".")) continue
        if (specifier.startsWith("@/registry/")) {
          const key = named(specifier.slice("@/registry/".length))
          const held = holders.get(key) ?? holders.get(`${key}/index`)
          if (held === undefined)
            problems.push(
              `${where}: imports ${specifier}, which no item provides`
            )
          else if (!held.includes(item.name)) into.items.add(held[0]!)
          continue
        }
        if (specifier.startsWith("node:") || specifier.startsWith("@/"))
          continue
        const name = packageOf(specifier)
        if (PROVIDED.has(name) || name.startsWith("@kirana-style/")) continue
        const range =
          into.declared[name] ?? dependencies[name] ?? versions(name)
        if (range === undefined)
          problems.push(
            `${where}: imports ${name}, which has no version: name it in the item's dependencies`
          )
        else into.packages[name] = range
      }
      content = content.replace(/\r\n/g, "\n")
      return {
        path: file.path,
        type: file.type,
        ...(file.target === undefined ? {} : { target: file.target }),
        content,
        hash: hashOf(content),
      }
    }
    const shared = {
      packages: dependencies,
      items: registryDependencies,
      declared: {},
    }
    const built: Partial<Pick<Item, "styles" | "files" | "frameworks">> = {}
    for (const group of groups.get(item)!) {
      if (group.key === "styles" || group.key === "files") {
        built[group.key] = group.files.flatMap(
          (file) => build(file, shared) ?? []
        )
        continue
      }
      const [framework, base] = group.key.split("/") as [Framework, string]
      const declared = item.frameworks![framework]![base]!
      const own = {
        packages: { ...declared.dependencies },
        items: new Set(declared.registryDependencies ?? []),
        declared: declared.dependencies ?? {},
      }
      const files = group.files.flatMap((file) => build(file, own) ?? [])
      for (const name of own.items)
        if (registryDependencies.has(name)) own.items.delete(name)
      own.items.delete(item.name)
      built.frameworks ??= {}
      built.frameworks[framework] ??= {}
      built.frameworks[framework]![base] = {
        files,
        ...(Object.keys(own.packages).length === 0
          ? {}
          : { dependencies: sorted(own.packages) }),
        ...(own.items.size === 0
          ? {}
          : { registryDependencies: [...own.items].sort() }),
      }
    }
    registryDependencies.delete(item.name)
    const {
      styles: _styles,
      files: _files,
      frameworks: _frameworks,
      ...fields
    } = item
    const document: Item = {
      $schema: ITEM_SCHEMA_URL,
      ...fields,
      ...(registryDependencies.size === 0
        ? {}
        : { registryDependencies: [...registryDependencies].sort() }),
      ...(Object.keys(dependencies).length === 0
        ? {}
        : { dependencies: sorted(dependencies) }),
      ...built,
    } as Item
    if (Object.keys(dependencies).length === 0) delete document.dependencies
    for (const problem of check(document).problems)
      problems.push(`${item.name}: ${problem.pointer} ${problem.message}`)
    return document
  })

  const index: Built["index"] = {
    $schema: INDEX_SCHEMA_URL,
    ...(source.name === undefined ? {} : { name: source.name }),
    ...(source.homepage === undefined ? {} : { homepage: source.homepage }),
    items: items.map((item) => ({
      name: item.name,
      type: item.type,
      ...(item.title === undefined ? {} : { title: item.title }),
      ...(item.description === undefined
        ? {}
        : { description: item.description }),
      version: item.version,
      ...(item.frameworks === undefined
        ? {}
        : {
            frameworks: Object.fromEntries(
              Object.entries(item.frameworks).map(([framework, bases]) => [
                framework,
                Object.keys(bases!),
              ])
            ),
          }),
    })),
  }
  return { items, index, problems }
}

const sorted = (packages: Packages): Packages =>
  Object.fromEntries(
    Object.entries(packages).sort(([a], [b]) => a.localeCompare(b))
  )

/**
 * Each package's range as the registry's `package.json` declares it (its dependencies, then its
 * peer and dev dependencies); a workspace's `catalog:` read from the nearest `package.json` above
 * that has a catalog.
 */
export function versionsFrom(
  root: string
): (name: string) => string | undefined {
  const read = (file: string) =>
    existsSync(file)
      ? (JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>)
      : undefined
  const manifest = read(path.join(root, "package.json")) ?? {}
  const declared: Packages = {
    ...(manifest.devDependencies as Packages | undefined),
    ...(manifest.peerDependencies as Packages | undefined),
    ...(manifest.dependencies as Packages | undefined),
  }
  let catalog: Packages | undefined
  const catalogOf = () => {
    if (catalog !== undefined) return catalog
    catalog = {}
    for (let at = path.resolve(root); ; at = path.dirname(at)) {
      const workspace = read(path.join(at, "package.json")) as
        | { workspaces?: { catalog?: Packages }; catalog?: Packages }
        | undefined
      const found = workspace?.workspaces?.catalog ?? workspace?.catalog
      if (found !== undefined) return (catalog = found)
      if (path.dirname(at) === at) return catalog
    }
  }
  return (name) => {
    const range = declared[name]
    if (range === undefined) return undefined
    return range.startsWith("catalog:") ? catalogOf()[name] : range
  }
}

/** `kirana-style ui build [registry.json] [--out <dir>]`: 0 when built, 1 on a problem, 2 on a malformed command. */
export async function runBuild(
  args: readonly string[],
  cwd: string,
  write: (text: string) => void
): Promise<number> {
  const parsed = parseArgs("build", args, [], ["--out"])
  if (typeof parsed === "string") {
    write(`${parsed}\n`)
    return 2
  }
  if (parsed.rest.length > 1) {
    write("kirana-style ui build takes one source registry\n")
    return 2
  }
  const file = path.resolve(cwd, parsed.rest[0] ?? "registry.json")
  const out = path.resolve(
    cwd,
    parsed.values.get("--out")?.at(-1) ?? "public/r"
  )
  let source: SourceRegistry
  try {
    source = JSON.parse(readFileSync(file, "utf8")) as SourceRegistry
  } catch (error) {
    write(`${path.relative(cwd, file) || file}: ${(error as Error).message}\n`)
    return 1
  }
  if (!Array.isArray(source.items)) {
    write(`${path.relative(cwd, file)}: lists no items\n`)
    return 1
  }
  const built = buildRegistry(source, path.dirname(file))
  if (built.problems.length > 0) {
    for (const problem of built.problems) write(`${problem}\n`)
    write(`build: ${built.problems.length} problem(s), nothing written\n`)
    return 1
  }
  mkdirSync(out, { recursive: true })
  const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`
  for (const item of built.items)
    writeFileSync(path.join(out, `${item.name}.json`), json(item))
  writeFileSync(path.join(out, "index.json"), json(built.index))
  write(
    `build: ${built.items.length} item(s) and the index in ${path.relative(cwd, out) || "."}\n`
  )
  return 0
}
