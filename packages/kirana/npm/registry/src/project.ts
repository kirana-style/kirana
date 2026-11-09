/**
 * What `ui add` reads from the project it installs into (KRN-DX-028, D-108): its framework, the
 * packages it lists and its package manager, and the directory each import alias stands for, from
 * `tsconfig.json`'s `paths`, which Nuxt and SvelteKit generate (KF-107).
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

/**
 * The packages each framework is known by, in the order they are looked for: its own, then the
 * adapters that install it as a peer, which a project may list without it (KF-109): Astro's islands,
 * Inertia's client and TanStack Start's builds.
 */
const FRAMEWORK_PACKAGES: readonly [string, Framework][] = [
  ["react", "react"],
  ["vue", "vue"],
  ["svelte", "svelte"],
  ["solid-js", "solid"],
  ["@angular/core", "angular"],
  ["@astrojs/react", "react"],
  ["@astrojs/vue", "vue"],
  ["@astrojs/svelte", "svelte"],
  ["@astrojs/solid-js", "solid"],
  ["@inertiajs/react", "react"],
  ["@inertiajs/vue3", "vue"],
  ["@inertiajs/svelte", "svelte"],
  ["@tanstack/react-start", "react"],
  ["@tanstack/solid-start", "solid"],
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
  const found = new Set(
    FRAMEWORK_PACKAGES.filter(([name]) => name in project.listed).map(
      ([, framework]) => framework
    )
  )
  return found.size === 1 ? [...found][0] : undefined
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

/**
 * A framework that writes, on its first run, the tsconfig a project's own extends or references
 * (KF-107): the `tsconfig.json` its starter has, the package.json script its starter runs the
 * generator from, and the generated tsconfigs that hold its aliases, as it will write them, for the
 * files to be placed before it has run.
 */
export type Generator = {
  tsconfig: string
  /** What `init`'s report says of the starter's tsconfig. */
  about: string
  script: { name: string; command: string; runs: string }
  /** A file the generator writes: there once it has run. */
  marker: string
  generated: Record<string, string>
}

/** Nuxt 4's starter, which references what `nuxt prepare` writes. */
const NUXT_TSCONFIG = `${JSON.stringify(
  {
    files: [],
    references: [
      { path: "./.nuxt/tsconfig.app.json" },
      { path: "./.nuxt/tsconfig.server.json" },
      { path: "./.nuxt/tsconfig.shared.json" },
      { path: "./.nuxt/tsconfig.node.json" },
    ],
  },
  null,
  2
)}\n`

/** SvelteKit 3's starter (`sv create`), which extends what `svelte-kit sync` writes. */
const SVELTEKIT_TSCONFIG = `${JSON.stringify(
  {
    extends: "$app/tsconfig",
    compilerOptions: { strict: true },
    include: ["src", "vite.config.ts"],
  },
  null,
  2
)}\n`

/**
 * Nuxt or SvelteKit 3, from the packages the project lists. Nuxt maps `@/*` and `~/*` to its source
 * folder, `app/` from Nuxt 4 on, in the tsconfigs it generates, and resolves them in Vite itself;
 * SvelteKit 3 maps none (`$lib` became `#lib`, a package.json import), so `@/*` goes into the root
 * tsconfig.
 */
export function generatorOf(
  root: string,
  listed: Readonly<Record<string, string>>
): Generator | undefined {
  if ("nuxt" in listed) {
    const source = existsSync(path.join(root, "app")) ? "../app" : ".."
    const paths = JSON.stringify({
      compilerOptions: {
        paths: {
          "~": [source],
          "~/*": [`${source}/*`],
          "@": [source],
          "@/*": [`${source}/*`],
        },
      },
    })
    return {
      tsconfig: NUXT_TSCONFIG,
      about: "Nuxt's, referencing the tsconfigs nuxt prepare writes in .nuxt",
      script: {
        name: "postinstall",
        command: "nuxt prepare",
        runs: "nuxt prepare",
      },
      marker: ".nuxt/tsconfig.app.json",
      // Nuxt 3's starter extends `.nuxt/tsconfig.json`, which Nuxt 4 still writes.
      generated: {
        ".nuxt/tsconfig.app.json": paths,
        ".nuxt/tsconfig.json": paths,
      },
    }
  }
  const kit = listed["@sveltejs/kit"]
  // SvelteKit 2's is `.svelte-kit/tsconfig.json`, whose `$lib` a root `paths` would hide.
  if (kit === undefined || Number(/\d+/.exec(kit)?.[0] ?? 3) < 3)
    return undefined
  return {
    tsconfig: SVELTEKIT_TSCONFIG,
    about: "SvelteKit's, extending the $app/tsconfig svelte-kit sync writes",
    script: {
      name: "prepare",
      command: "svelte-kit sync || echo ''",
      runs: "svelte-kit sync",
    },
    marker: "node_modules/$app/tsconfig.json",
    generated: {},
  }
}

/**
 * The command that runs the framework's generator, when the tsconfig it writes is not there: by the
 * script its starter runs it from, which `init` writes. The aliases are in that tsconfig, and an
 * install of a package can remove it (npm prunes SvelteKit's `node_modules/$app`), so every command
 * that installs packages runs this after them, before its check (KF-107).
 */
export function generateCommand(
  root: string,
  manager: PackageManager
): string | undefined {
  const packageJson = readPackage(root)
  const generator = generatorOf(root, {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  })
  if (
    generator === undefined ||
    existsSync(path.join(root, generator.marker)) ||
    !packageJson.scripts?.[generator.script.name]?.includes(
      generator.script.runs
    )
  )
    return undefined
  return `${manager === "deno" ? "deno task" : `${manager} run`} ${generator.script.name}`
}
