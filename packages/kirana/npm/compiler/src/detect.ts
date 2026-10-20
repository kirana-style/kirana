/**
 * What a project is built with (KRN-DX-008): its framework, bundler and package manager, read from
 * `package.json` and lockfiles. `kirana-style init` sets a project up from it and `kirana-style doctor` checks
 * the setup against it, so the two never disagree about what a project needs.
 */
import { existsSync, readFileSync, realpathSync } from "node:fs"
import path from "node:path"

export type Framework =
  | "next"
  | "nuxt"
  | "sveltekit"
  | "astro"
  | "tanstack-start"
  | "react"
  | "preact"
  | "solid"
  | "vue"
  | "svelte"
  | "qwik"
  | "angular"
  | "react-router"
  | "waku"
  | "vitepress"
  | "docusaurus"
  | "gatsby"
  | "ember"
  | "meteor"
  | "laravel"
  | "symfony"
  | "rails"
  | "phoenix"
  | "adonisjs"
  | "vanilla"

export type Bundler =
  | "turbopack"
  | "webpack"
  | "vite"
  | "rsbuild"
  | "rspack"
  | "rolldown"
  | "bun"
  | "esbuild"
  | "angular-cli"
  | "parcel"
  /** Kirana's own command line: a server framework, whose templates read a class map. */
  | "cli"
  | "none"

export type PackageManager = "npm" | "pnpm" | "yarn" | "bun" | "deno"

export type PackageJson = {
  name?: string
  type?: string
  scripts?: Record<string, string>
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  packageManager?: string
  workspaces?: unknown
}

/** A package of the project's own workspace that it depends on, such as a shared Vite config. */
export type LocalPackage = { name: string; directory: string }

export type Detected = {
  root: string
  framework: Framework
  bundler: Bundler
  packageManager: PackageManager
  /** Whether the project has a `tsconfig.json`. */
  typescript: boolean
  /** Whether `package.json` says `"type": "module"`. */
  module: boolean
  /** Every dependency, development ones included. */
  dependencies: Record<string, string>
  /** The dependencies that are packages of the same workspace, linked rather than installed. */
  local: LocalPackage[]
  /**
   * What the rest of the workspace lists: its root's dependencies and its local packages'. An app
   * that takes its adapter from a shared config package, or the command from the root, has them.
   */
  workspace: Record<string, string>
}

/** Where a dependency is linked from, when `node_modules` links it to a directory outside any. */
function linkedDirectory(root: string, name: string): string | undefined {
  for (let directory = root; ; directory = path.dirname(directory)) {
    const link = path.join(directory, "node_modules", name)
    if (existsSync(link)) {
      const real = realpathSync(link)
      return real.split(path.sep).includes("node_modules") ? undefined : real
    }
    if (path.dirname(directory) === directory) return undefined
  }
}

/** The root of the workspace above a project: a `workspaces` field or `pnpm-workspace.yaml`. */
function workspaceRoot(root: string): string | undefined {
  for (
    let directory = path.dirname(root);
    directory !== path.dirname(directory);
    directory = path.dirname(directory)
  ) {
    if (
      readPackage(directory).workspaces !== undefined ||
      existsSync(path.join(directory, "pnpm-workspace.yaml"))
    )
      return directory
  }
  return undefined
}

const listed = (pkg: PackageJson) => ({
  ...pkg.dependencies,
  ...pkg.devDependencies,
})

/** The project's `package.json`, or an empty one. */
export function readPackage(root: string): PackageJson {
  const file = path.join(root, "package.json")
  return existsSync(file)
    ? (JSON.parse(readFileSync(file, "utf8")) as PackageJson)
    : {}
}

/** Lockfiles by package manager, in the order they are looked for. */
const LOCKFILES: readonly [string, PackageManager][] = [
  ["bun.lock", "bun"],
  ["bun.lockb", "bun"],
  ["pnpm-lock.yaml", "pnpm"],
  ["yarn.lock", "yarn"],
  ["deno.lock", "deno"],
  ["package-lock.json", "npm"],
]

/**
 * The package manager: `packageManager` in `package.json`, else the nearest lockfile in the root or
 * a workspace above it, else npm.
 */
export function packageManagerOf(
  root: string,
  pkg: PackageJson
): PackageManager {
  const named = pkg.packageManager?.split("@")[0]
  if (named && LOCKFILES.some(([, manager]) => manager === named))
    return named as PackageManager
  for (let directory = root; ; directory = path.dirname(directory)) {
    const found = LOCKFILES.find(([file]) =>
      existsSync(path.join(directory, file))
    )
    if (found) return found[1]
    if (path.dirname(directory) === directory) return "npm"
  }
}

/** Frameworks by the dependency that names them; a meta-framework before the library it uses. */
const FRAMEWORKS: readonly [string, Framework][] = [
  ["next", "next"],
  ["nuxt", "nuxt"],
  ["@sveltejs/kit", "sveltekit"],
  ["astro", "astro"],
  ["@tanstack/react-start", "tanstack-start"],
  ["@react-router/dev", "react-router"],
  ["waku", "waku"],
  ["vitepress", "vitepress"],
  ["@docusaurus/core", "docusaurus"],
  ["gatsby", "gatsby"],
  ["ember-source", "ember"],
  ["@qwik.dev/core", "qwik"],
  ["@builder.io/qwik", "qwik"],
  ["@angular/core", "angular"],
  ["preact", "preact"],
  ["solid-js", "solid"],
  ["vue", "vue"],
  ["svelte", "svelte"],
  ["react", "react"],
]

/** Frameworks that always build on Vite. */
const ON_VITE: readonly Framework[] = [
  "nuxt",
  "sveltekit",
  "astro",
  "tanstack-start",
  "qwik",
  "react-router",
  "waku",
  "vitepress",
  "ember",
]

/**
 * Server frameworks (D-069), by a line of their own manifest: their templates name styles from a
 * class map, so they are told apart before the JavaScript dependencies of their front end.
 */
const SERVER: readonly [string, RegExp, Framework][] = [
  ["composer.json", /"laravel\/framework"/, "laravel"],
  ["composer.json", /"symfony\/framework-bundle"/, "symfony"],
  ["Gemfile", /^\s*gem\s+["'](rails|railties)["']/m, "rails"],
  ["mix.exs", /\{:phoenix,/, "phoenix"],
  ["package.json", /"@adonisjs\/core"/, "adonisjs"],
]

/** Whether a framework renders server templates that read a class map. */
export function isServer(framework: Framework): boolean {
  return SERVER.some(([, , name]) => name === framework)
}

/** Bundlers by the dependency that names them. */
const BUNDLERS: readonly [string, Bundler][] = [
  ["vite", "vite"],
  ["@rsbuild/core", "rsbuild"],
  ["@rspack/core", "rspack"],
  ["parcel", "parcel"],
  ["webpack", "webpack"],
  ["rolldown", "rolldown"],
  ["esbuild", "esbuild"],
]

/** What builds a framework's code, from its dependencies and scripts where it has a choice. */
function bundlerOf(
  framework: Framework,
  has: (name: string) => boolean,
  scripts: string
): Bundler {
  if (isServer(framework)) return "cli"
  switch (framework) {
    case "gatsby":
    case "docusaurus":
      return "webpack"
    case "meteor":
      return "rspack"
    case "next":
      return /\bnext (build|dev)\b[^\n]*--webpack/.test(scripts)
        ? "webpack"
        : "turbopack"
    case "angular":
      // Angular builds with its CLI, or on Vite through Analog.
      return has("@analogjs/platform") ? "vite" : "angular-cli"
  }
  if (ON_VITE.includes(framework)) return "vite"
  return (
    BUNDLERS.find(([name]) => has(name))?.[1] ??
    (/\bbun build\b/.test(scripts) ? "bun" : "none")
  )
}

/** The framework and bundler a project's dependencies and scripts name. */
export function detect(root: string): Detected {
  const pkg = readPackage(root)
  const dependencies = listed(pkg)
  const has = (name: string) => name in dependencies
  const scripts = Object.values(pkg.scripts ?? {}).join("\n")
  const manifest = (file: string) =>
    existsSync(path.join(root, file))
      ? readFileSync(path.join(root, file), "utf8")
      : ""
  const framework =
    SERVER.find(([file, line]) => line.test(manifest(file)))?.[2] ??
    (existsSync(path.join(root, ".meteor", "release"))
      ? "meteor"
      : undefined) ??
    FRAMEWORKS.find(([name]) => has(name))?.[1] ??
    "vanilla"
  const bundler = bundlerOf(framework, has, scripts)
  const local = Object.keys(dependencies).flatMap((name) => {
    const directory = linkedDirectory(root, name)
    return directory ? [{ name, directory }] : []
  })
  const above = workspaceRoot(root)
  const workspace = Object.assign(
    {},
    above ? listed(readPackage(above)) : {},
    ...local.map((entry) => listed(readPackage(entry.directory)))
  ) as Record<string, string>
  return {
    root,
    framework,
    bundler,
    packageManager: packageManagerOf(root, pkg),
    typescript: existsSync(path.join(root, "tsconfig.json")),
    module: pkg.type === "module",
    dependencies,
    local,
    workspace,
  }
}

/** The adapter packages a project installs (development dependencies). */
export function adapterOf(project: Detected): string[] {
  if (project.framework === "next")
    return project.bundler === "turbopack"
      ? ["@kirana-style/next", "@kirana-style/postcss", "postcss"]
      : ["@kirana-style/webpack"]
  if (project.framework === "astro") return ["@kirana-style/astro"]
  if (project.framework === "gatsby") return ["@kirana-style/gatsby"]
  // Angular's runtime package (the `[sx]` directive) is a dependency: see `runtimeOf`.
  if (project.framework === "angular")
    return project.bundler === "vite" ? ["@kirana-style/vite"] : []
  const byBundler: Record<Bundler, string[]> = {
    turbopack: [],
    vite: ["@kirana-style/vite"],
    rsbuild: ["@kirana-style/rspack"],
    rspack: ["@kirana-style/rspack"],
    webpack: ["@kirana-style/webpack"],
    rolldown: ["@kirana-style/rolldown"],
    bun: ["@kirana-style/bun"],
    esbuild: ["@kirana-style/esbuild"],
    "angular-cli": [],
    parcel: [
      "@kirana-style/parcel-transformer",
      "@kirana-style/postcss",
      "postcss",
    ],
    // A server framework runs `kirana-style dev` and `kirana-style build`, from `kirana-style`.
    cli: [],
    none: [],
  }
  return byBundler[project.bundler]
}

/**
 * The packages an app runs with: `@kirana-style/core`, and the framework's own runtime half — Angular's
 * `[sx]` directive, Ember's `sx` helper, AdonisJS's Edge global.
 */
export function runtimeOf(project: Detected): string[] {
  const own: Partial<Record<Framework, string>> = {
    angular: "@kirana-style/angular",
    ember: "@kirana-style/ember",
    adonisjs: "@kirana-style/adonis",
  }
  const extra = own[project.framework]
  return extra ? ["@kirana-style/core", extra] : ["@kirana-style/core"]
}

/**
 * The `@kirana-style/core` subpath that types `sx` for a framework; none for plain DOM projects, none for
 * Angular, whose `SxDirective` carries the type, and none where templates take class strings
 * (Ember, the server frameworks).
 */
export function typesOf(framework: Framework): string | undefined {
  const types: Record<Framework, string | undefined> = {
    next: "react",
    "tanstack-start": "react",
    react: "react",
    preact: "preact",
    solid: "solid",
    vue: "vue",
    nuxt: "vue",
    svelte: "svelte",
    sveltekit: "svelte",
    astro: "astro",
    qwik: "qwik",
    angular: undefined,
    "react-router": "react",
    waku: "react",
    vitepress: "vue",
    docusaurus: "react",
    gatsby: "react",
    meteor: "react",
    ember: undefined,
    laravel: undefined,
    symfony: undefined,
    rails: undefined,
    phoenix: undefined,
    adonisjs: undefined,
    vanilla: undefined,
  }
  const name = types[framework]
  return name && `@kirana-style/core/${name}`
}

/** How a project runs an installed package's binary: `npx kirana-style doctor`, `pnpm exec …`. */
export function runCommand(manager: PackageManager, command: string): string {
  // What goes before the binary's name; Deno runs an npm package by specifier, which resolves to
  // the version the project lists.
  const prefix: Record<PackageManager, string> = {
    npm: "npx ",
    pnpm: "pnpm exec ",
    yarn: "yarn ",
    bun: "bunx ",
    deno: "deno run -A npm:",
  }
  return `${prefix[manager]}${command}`
}

/** The command that installs runtime and development dependencies. */
export function installCommand(
  manager: PackageManager,
  dependencies: readonly string[],
  development: readonly string[]
): string[] {
  const add = manager === "npm" ? "install" : "add"
  const dev = manager === "bun" ? "-d" : "-D"
  // Deno takes each npm package as an `npm:` specifier.
  const names = (list: readonly string[]) =>
    manager === "deno" ? list.map((name) => `npm:${name}`) : list
  return [
    dependencies.length ? [manager, add, ...names(dependencies)].join(" ") : "",
    development.length
      ? [manager, add, dev, ...names(development)].join(" ")
      : "",
  ].filter(Boolean)
}
