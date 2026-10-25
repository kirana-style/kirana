/**
 * What `ui add` reads from the project it installs into (KRN-DX-028, D-108): its framework, the
 * packages it lists and its package manager, and the directory each import alias stands for, from
 * `tsconfig.json`'s `paths`.
 */
import { existsSync, readFileSync, statSync } from "node:fs"
import path from "node:path"

import {
  packageManagerOf,
  readJsonc,
  readPackage,
} from "@kirana-style/compiler"
import type { PackageJson, PackageManager } from "@kirana-style/compiler"

import { RegistryError } from "./read.ts"
import type { Framework } from "./types.ts"

/** The package each framework is known by, in the order they are looked for. */
const FRAMEWORK_PACKAGES: readonly [string, Framework][] = [
  ["react", "react"],
  ["vue", "vue"],
  ["svelte", "svelte"],
  ["solid-js", "solid"],
  ["@angular/core", "angular"],
]

export type Project = {
  root: string
  packageJson: PackageJson
  manager: PackageManager
  /** Every package it lists, development ones included. */
  listed: Readonly<Record<string, string>>
}

export function readProject(root: string): Project {
  const packageJson = readPackage(root)
  return {
    root,
    packageJson,
    manager: packageManagerOf(root, packageJson),
    listed: { ...packageJson.dependencies, ...packageJson.devDependencies },
  }
}

/** The framework the project depends on, when it is exactly one. */
export function frameworkOf(project: Project): Framework | undefined {
  const found = FRAMEWORK_PACKAGES.filter(([name]) => name in project.listed)
  return found.length === 1 ? found[0]![1] : undefined
}

/** Reads a project file: from disk, or as planned changes leave it. Undefined when there is none. */
export type ReadFile = (file: string) => string | undefined

const fromDisk: ReadFile = (file) =>
  existsSync(file) && statSync(file).isFile()
    ? readFileSync(file, "utf8")
    : undefined

type Tsconfig = {
  extends?: unknown
  references?: { path?: unknown }[]
  compilerOptions?: { baseUrl?: string; paths?: Record<string, string[]> }
}

/** A tsconfig's `paths`, the directory they start from, and the file that holds them. */
export type Paths = {
  paths: Record<string, string[]>
  from: string
  file: string
}

/** `paths` and the directory they start from, following `extends` and then `references`. */
export function pathsOf(
  file: string,
  read: ReadFile = fromDisk,
  seen = new Set<string>()
): Paths | undefined {
  const text = seen.has(file) ? undefined : read(file)
  if (text === undefined) return undefined
  seen.add(file)
  const config = readJsonc(text) as Tsconfig
  const directory = path.dirname(file)
  const { paths, baseUrl } = config.compilerOptions ?? {}
  if (paths)
    return { paths, from: path.resolve(directory, baseUrl ?? "."), file }
  const next: string[] = []
  if (typeof config.extends === "string" && config.extends.startsWith("."))
    next.push(path.resolve(directory, config.extends))
  for (const reference of config.references ?? [])
    if (typeof reference.path === "string") {
      const target = path.resolve(directory, reference.path)
      next.push(
        existsSync(target) && statSync(target).isDirectory()
          ? path.join(target, "tsconfig.json")
          : target
      )
    }
  for (const candidate of next) {
    const found = pathsOf(candidate, read, seen)
    if (found) return found
  }
  return undefined
}

/**
 * The directory an import alias (`@/components/ui`) stands for: the `paths` entry it matches most
 * closely, `@/*` to `./src/*` making it `src/components/ui`. Stops, naming what to add, when none does.
 */
export function aliasDirectory(
  root: string,
  alias: string,
  read: ReadFile = fromDisk
): string {
  const found = pathsOf(path.join(root, "tsconfig.json"), read)
  let best: { length: number; directory: string } | undefined
  for (const [pattern, targets] of Object.entries(found?.paths ?? {})) {
    const target = targets[0]
    if (target === undefined) continue
    const wildcard = pattern.endsWith("*")
    const prefix = wildcard ? pattern.slice(0, -1) : pattern
    const matches = wildcard
      ? `${alias}/`.startsWith(prefix)
      : alias === pattern
    if (!matches || (best && best.length >= prefix.length)) continue
    const rest = wildcard ? alias.slice(prefix.length) : ""
    best = {
      length: prefix.length,
      directory: path.resolve(found!.from, target.replaceAll("*", rest)),
    }
  }
  if (best) return best.directory
  throw new RegistryError(
    `${alias}: no compilerOptions.paths entry in tsconfig.json maps it to a directory (for example "@/*": ["./src/*"])`
  )
}
