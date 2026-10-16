/**
 * `kirana-style init` (KRN-DX-008, D-066): sets a project up for Kirana. It detects the framework, bundler
 * and package manager, then plans four steps — the configuration file, the adapter in the host's
 * configuration, the stylesheet, and the types for `sx` — shows each change as a diff, and writes
 * them once confirmed. A configuration it cannot edit safely gets the step printed instead. The
 * install command is printed, and run only with `--install`.
 *
 * `kirana-style doctor` runs the same plan without writing: a step with something left to do is a step
 * the project is missing.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs"
import path from "node:path"

import type { Detected } from "./detect.ts"
import {
  adapterOf,
  detect,
  installCommand,
  isServer,
  runCommand,
  runtimeOf,
  typesOf,
} from "./detect.ts"
import { sources } from "./host.ts"

/** One file written: created when `before` is undefined. */
export type Change = { file: string; before?: string; after: string }

export type StepName = "config" | "adapter" | "stylesheet" | "types"

/** A step is done, needs changes Kirana can make, or needs a hand. */
export type Step =
  | { name: StepName; status: "done"; detail: string }
  | { name: StepName; status: "change"; detail: string; changes: Change[] }
  | { name: StepName; status: "manual"; detail: string }

export type Plan = {
  project: Detected
  steps: Step[]
  /** Packages to install that the project does not list yet. */
  dependencies: string[]
  development: string[]
}

export type InitOptions = { preset?: boolean }

const STYLESHEET = "@kirana-style/core/stylesheet.css"
const SCRIPTS = ["tsx", "ts", "jsx", "js"]
const CONFIG_NAMES = (
  base: string,
  extensions = ["ts", "mts", "mjs", "js", "cjs"]
) => extensions.map((extension) => `${base}.config.${extension}`)

/** Where a server framework serves static files from: Phoenix's `priv/static`, else `public`. */
function staticDirectory(framework: Detected["framework"]): string {
  return framework === "phoenix" ? "priv/static" : "public"
}

/** The starter style module a server framework's templates name (D-069). */
const STARTER_STYLES = `import { css } from "@kirana-style/core"

/** The styles your templates name: each export is a class string in the class map. */
export const card = css({ padding: "1rem", borderRadius: "0.5rem" })
`

/** How a server framework's templates get `kirana()`, where it is not a JavaScript package. */
const HELPERS: Partial<Record<Detected["framework"], string>> = {
  laravel: "composer require kirana-style/kirana",
  symfony: "composer require kirana-style/kirana",
  rails: "bundle add kirana",
  phoenix:
    'add {:kirana, "~> 0.1"} to deps in mix.exs, and import Kirana, only: [kirana: 1] in your html_helpers',
}

/** Files read through the plan, so a later step sees an earlier step's edit. */
class Files {
  readonly #root: string
  readonly #planned = new Map<string, Change>()

  constructor(root: string) {
    this.#root = root
  }

  read(file: string): string | undefined {
    return this.#planned.get(file)?.after ?? this.#disk(file)
  }

  #disk(file: string): string | undefined {
    const absolute = path.join(this.#root, file)
    return existsSync(absolute) ? readFileSync(absolute, "utf8") : undefined
  }

  /** Records a change; returns it. `before` is the file on disk, whatever was planned since. */
  write(file: string, after: string): Change {
    const change = { file, before: this.#disk(file), after }
    this.#planned.set(file, change)
    return change
  }

  find(names: readonly string[]): string | undefined {
    return names.find((name) => this.read(name) !== undefined)
  }
}

/** Whether a file of a workspace package's sources mentions `text`. */
const mentions = (directory: string, text: string) =>
  sources(directory).some((file) => readFileSync(file, "utf8").includes(text))

/**
 * The workspace package a configuration imports that sets up `marker`, such as a Vite config shared
 * by every app of a monorepo: `import { defineAppConfig } from "@workspace/vite-config"`.
 */
function sharedConfig(
  text: string,
  project: Detected,
  marker: string
): string | undefined {
  const imported = [
    ...text.matchAll(/\b(?:from|import)\s*\(?\s*["']([^"'.][^"']*)["']/g),
  ].map((match) => match[1]!)
  return project.local.find(
    (entry) =>
      imported.some(
        (specifier) =>
          specifier === entry.name || specifier.startsWith(`${entry.name}/`)
      ) && mentions(entry.directory, marker)
  )?.name
}

/** `statement` in the module's own style: its quotes and its semicolons. */
export function styled(text: string, statement: string): string {
  const single =
    /(from|import)\s*'/.test(text) && !/(from|import)\s*"/.test(text)
  const semicolon = /(from|import)\s*["'][^"']+["'];/.test(text) ? ";" : ""
  return `${single ? statement.replaceAll('"', "'") : statement}${semicolon}`
}

/** Adds an import after the module's last import, in the module's style. */
export function addImport(text: string, statement: string): string {
  const line = styled(text, statement)
  const imports = [
    ...text.matchAll(/^import\b[^;]*?["'][^"'\n]+["'];?[ \t]*$/gm),
  ]
  const last = imports.at(-1)
  if (!last) return `${line}\n${text.startsWith("\n") ? "" : "\n"}${text}`
  const end = last.index + last[0].length
  return `${text.slice(0, end)}\n${line}${text.slice(end)}`
}

/**
 * Inserts `entry` first in the array or object opened by `opener` (`plugins: [`), keeping the
 * layout: on its own line when the entries are, inline otherwise. Undefined when there is none.
 */
export function insertFirst(
  text: string,
  opener: RegExp,
  entry: string
): string | undefined {
  const match = opener.exec(text)
  if (!match) return undefined
  const at = match.index + match[0].length
  const space = /^\s*/.exec(text.slice(at))![0]
  // On its own line, indented like the entry after it; inline, before the first entry.
  if (space.includes("\n"))
    return `${text.slice(0, at)}${space}${entry},${text.slice(at)}`
  const first = at + space.length
  const empty = text[first] === "]" || text[first] === "}"
  return `${text.slice(0, first)}${entry}${empty ? "" : ", "}${text.slice(first)}`
}

/**
 * Inserts `entry` last in the array opened by `opener`, before its `]` (Analog's plugin must run
 * after Angular's): on its own line when the entries are, inline otherwise. Undefined when there is
 * none. Strings are skipped, so a bracket in one does not end the array.
 */
export function insertLast(
  text: string,
  opener: RegExp,
  entry: string
): string | undefined {
  const match = opener.exec(text)
  if (!match) return undefined
  const start = match.index + match[0].length
  let depth = 0
  let close = start
  for (; close < text.length; close++) {
    const char = text[close]!
    if (char === '"' || char === "'" || char === "`") {
      close = text.indexOf(char, close + 1)
      if (close < 0) return undefined
    } else if (char === "[" || char === "(" || char === "{") depth++
    else if (char === "]" || char === ")" || char === "}") {
      if (depth === 0) break
      depth--
    }
  }
  const inner = text.slice(start, close)
  const body = inner.trimEnd()
  if (body.trim() === "")
    return `${text.slice(0, start)}${entry}${text.slice(close)}`
  const comma = body.endsWith(",") ? "" : ","
  const line = /\n([ \t]*)[^\n]*$/.exec(body)
  const separator = line ? `\n${line[1]}` : " "
  return `${text.slice(0, start)}${body}${comma}${separator}${entry}${line ? "," : ""}${inner.slice(body.length)}${text.slice(close)}`
}

/** Adds `key: [entry]` as the first property of `defineConfig({`. */
function addProperty(
  text: string,
  opener: RegExp,
  property: string
): string | undefined {
  const match = opener.exec(text)
  if (!match) return undefined
  const at = match.index + match[0].length
  const empty = /^\s*}/.test(text.slice(at))
  return `${text.slice(0, at)}${empty ? ` ${property} ` : `\n  ${property},`}${text.slice(at)}`
}

/** A plugin added to `plugins: [` or, without one, to `defineConfig({`. */
function withPlugin(
  text: string,
  key: string,
  importLine: string,
  entry: string
): string | undefined {
  const edited =
    insertFirst(text, new RegExp(`\\b${key}\\s*:\\s*\\[`), entry) ??
    addProperty(text, /defineConfig\(\s*\{/, `${key}: [${entry}]`)
  return edited && addImport(edited, importLine)
}

/** The default export wrapped in `wrapper(…)`, when it is the module's last statement. */
export function wrapDefault(text: string, wrapper: string): string | undefined {
  const match = /export default ([\s\S]+?)(;?)\s*$/.exec(text)
  // A statement after the export (`;` then more code) means it is not last: left to a person.
  if (!match || /;\s*\S/.test(match[1]!) || /\bmodule\.exports\b/.test(text))
    return undefined
  return `${text.slice(0, match.index)}export default ${wrapper}(${match[1]})${match[2]}\n`
}

function step(name: StepName, detail: string, changes: Change[]): Step {
  return { name, status: "change", detail, changes }
}

function manual(name: StepName, detail: string): Step {
  return { name, status: "manual", detail }
}

function done(name: StepName, detail: string): Step {
  return { name, status: "done", detail }
}

/** The project's configuration file. */
function configStep(
  files: Files,
  project: Detected,
  options: InitOptions
): Step {
  const existing = files.find(
    CONFIG_NAMES("kirana", ["ts", "mts", "js", "mjs", "json"])
  )
  const server = isServer(project.framework)
  const classes = `classes: { modules: ["resources/styles"], out: "${staticDirectory(project.framework)}/kirana/classes.json" }`
  // Meteor's own modules (`meteor/meteor`) only its bundler resolves.
  const externals = `externals: ["meteor/"]`
  if (existing) {
    const text = files.read(existing)!
    if (options.preset && !text.includes("@kirana-style/preset-scales"))
      return manual(
        "config",
        `add the scales preset to ${existing}: import scales from "@kirana-style/preset-scales/preset", then presets: [scales()]`
      )
    if (server && !text.includes("classes"))
      return manual("config", `add ${classes} to ${existing}`)
    if (project.framework === "meteor" && !text.includes("externals"))
      return manual("config", `add ${externals} to ${existing}`)
    return done("config", existing)
  }
  // Node.js warns on every load of an ES module whose package is not `"type": "module"`.
  const file = !project.typescript
    ? "kirana.config.mjs"
    : project.module
      ? "kirana.config.ts"
      : "kirana.config.mts"
  const preset = options.preset
  const entries = [
    ...(preset ? ["presets: [scales()]"] : []),
    ...(server ? [classes] : []),
    ...(project.framework === "meteor" ? [externals] : []),
  ]
  const text = [
    `import { defineConfig } from "@kirana-style/core/config"`,
    ...(preset
      ? [`import scales from "@kirana-style/preset-scales/preset"`]
      : []),
    "",
    entries.length
      ? `export default defineConfig({\n${entries.map((entry) => `  ${entry},`).join("\n")}\n})`
      : "export default defineConfig({})",
    "",
  ].join("\n")
  const changes = [files.write(file, text)]
  // A server app's templates name the exports of its style modules: start it with one.
  const styles = "resources/styles/app.styles.ts"
  if (
    server &&
    listDirectory(files, project.root, "resources/styles", ".ts").length === 0
  )
    changes.push(files.write(styles, STARTER_STYLES))
  return step(
    "config",
    changes.length > 1 ? `create ${file} and ${styles}` : `create ${file}`,
    changes
  )
}

/** The adapter, in the host's configuration. */
function adapterStep(files: Files, project: Detected): Step {
  const edit = (
    names: readonly string[],
    marker: string,
    apply: (text: string) => string | undefined,
    create: { file: string; text: string } | undefined,
    help: string
  ): Step => {
    const file = files.find(names)
    if (!file) {
      if (!create) return manual("adapter", help)
      return step("adapter", `create ${create.file}`, [
        files.write(create.file, create.text),
      ])
    }
    const text = files.read(file)!
    if (text.includes(marker)) return done("adapter", file)
    const shared = sharedConfig(text, project, marker)
    if (shared) return done("adapter", `${file}, through ${shared}`)
    const edited = apply(text)
    if (edited === undefined) return manual("adapter", `${file}: ${help}`)
    return step("adapter", `add ${marker} to ${file}`, [
      files.write(file, edited),
    ])
  }
  const extension = project.typescript ? "ts" : "mjs"
  switch (project.framework) {
    case "next": {
      const turbopack = project.bundler === "turbopack"
      const source = turbopack
        ? "@kirana-style/next"
        : "@kirana-style/webpack/next"
      const adapter = edit(
        CONFIG_NAMES("next"),
        source,
        (text) => {
          const wrapped = wrapDefault(text, "withKirana")
          return (
            wrapped &&
            addImport(wrapped, `import { withKirana } from "${source}"`)
          )
        },
        {
          file: `next.config.${extension}`,
          text: `import { withKirana } from "${source}"\n\nexport default withKirana({})\n`,
        },
        `wrap the exported configuration: import { withKirana } from "${source}", then export default withKirana(config)`
      )
      if (!turbopack) return adapter
      const postcss = edit(
        CONFIG_NAMES("postcss", ["mjs", "js", "cjs", "ts"]),
        "@kirana-style/postcss",
        (text) =>
          insertFirst(
            text,
            /\bplugins\s*:\s*\{/,
            `"@kirana-style/postcss": {}`
          ),
        {
          file: "postcss.config.mjs",
          text: `export default { plugins: { "@kirana-style/postcss": {} } }\n`,
        },
        `add "@kirana-style/postcss": {} to the PostCSS plugins (Turbopack's stylesheet comes from it)`
      )
      return merge(adapter, postcss)
    }
    case "nuxt":
      return edit(
        CONFIG_NAMES("nuxt"),
        "@kirana-style/vite",
        (text) => {
          if (/\b(css|vite)\s*:/.test(text)) return undefined
          const edited = addProperty(
            text,
            /defineNuxtConfig\(\s*\{/,
            `css: ["${STYLESHEET}"],\n  vite: { plugins: [kirana()] }`
          )
          return (
            edited &&
            addImport(edited, `import kirana from "@kirana-style/vite"`)
          )
        },
        undefined,
        `add css: ["${STYLESHEET}"] and vite: { plugins: [kirana()] } (import kirana from "@kirana-style/vite")`
      )
    case "angular":
      if (project.bundler === "vite")
        return edit(
          CONFIG_NAMES("vite"),
          "@kirana-style/angular/vite",
          (text) => {
            const edited = insertLast(
              text,
              /\bplugins\s*:\s*\[/,
              "kiranaAngular()"
            )
            return (
              edited &&
              addImport(
                edited,
                `import { kiranaAngular } from "@kirana-style/angular/vite"`
              )
            )
          },
          undefined,
          `add kiranaAngular() last in plugins, after analog() (import { kiranaAngular } from "@kirana-style/angular/vite")`
        )
      return angularCli(files)
    case "gatsby":
      return edit(
        ["gatsby-config.js", "gatsby-config.mjs", "gatsby-config.ts"],
        "@kirana-style/gatsby",
        (text) =>
          insertFirst(text, /\bplugins\s*:\s*\[/, `"@kirana-style/gatsby"`),
        {
          file: "gatsby-config.js",
          text: `module.exports = { jsxRuntime: "automatic", plugins: ["@kirana-style/gatsby"] }\n`,
        },
        `add "@kirana-style/gatsby" to plugins`
      )
    case "ember":
      return edit(
        CONFIG_NAMES("vite", ["mjs", "js", "ts", "mts"]),
        "@kirana-style/ember/vite",
        (text) => {
          const edited = insertLast(text, /\bplugins\s*:\s*\[/, "kiranaEmber()")
          return (
            edited &&
            addImport(
              edited,
              `import { kiranaEmber } from "@kirana-style/ember/vite"`
            )
          )
        },
        undefined,
        `add kiranaEmber() last in plugins, after Embroider's (import { kiranaEmber } from "@kirana-style/ember/vite")`
      )
    case "meteor":
      // Meteor's `rspack.config.js` returns its configuration from a function: shown, not edited.
      return edit(
        CONFIG_NAMES("rspack", ["js", "mjs", "cjs", "ts"]),
        "@kirana-style/rspack",
        () => undefined,
        undefined,
        `add new KiranaPlugin() to the plugins rspack.config.js returns (const { KiranaPlugin } = require("@kirana-style/rspack"))`
      )
    case "adonisjs":
      return edit(
        ["adonisrc.ts"],
        "@kirana-style/adonis",
        (text) =>
          insertLast(
            text,
            /\bproviders\s*:\s*\[/,
            `() => import("@kirana-style/adonis/provider")`
          ),
        undefined,
        `add () => import("@kirana-style/adonis/provider") to providers in adonisrc.ts`
      )
    case "symfony":
      return edit(
        ["config/services.yaml"],
        "KiranaExtension",
        (text) =>
          /^services:/m.test(text)
            ? `${text.trimEnd()}\n\n    Kirana\\Twig\\KiranaExtension:\n        arguments: ['%kernel.project_dir%/public/kirana/classes.json']\n`
            : undefined,
        undefined,
        `register Kirana\\Twig\\KiranaExtension with the class map's path as its argument`
      )
    case "laravel":
      return done(
        "adapter",
        "Laravel discovers the @kirana Blade directive's provider"
      )
    case "rails":
      return done(
        "adapter",
        "the gem's Railtie puts the kirana helper in every view"
      )
    case "phoenix":
      return done("adapter", "kirana/1 is a function your templates import")
    case "astro":
      return edit(
        CONFIG_NAMES("astro"),
        "@kirana-style/astro",
        (text) =>
          withPlugin(
            text,
            "integrations",
            `import kirana from "@kirana-style/astro"`,
            "kirana()"
          ),
        undefined,
        `add kirana() to integrations (import kirana from "@kirana-style/astro")`
      )
  }
  switch (project.bundler) {
    case "vite":
      return edit(
        CONFIG_NAMES("vite"),
        "@kirana-style/vite",
        (text) =>
          withPlugin(
            text,
            "plugins",
            `import kirana from "@kirana-style/vite"`,
            "kirana()"
          ),
        {
          file: `vite.config.${project.typescript ? "ts" : "js"}`,
          text: `import kirana from "@kirana-style/vite"\nimport { defineConfig } from "vite"\n\nexport default defineConfig({ plugins: [kirana()] })\n`,
        },
        `add kirana() first in plugins (import kirana from "@kirana-style/vite")`
      )
    case "rsbuild":
      return edit(
        CONFIG_NAMES("rsbuild"),
        "@kirana-style/rspack",
        (text) =>
          withPlugin(
            text,
            "plugins",
            `import { pluginKirana } from "@kirana-style/rspack"`,
            "pluginKirana()"
          ),
        undefined,
        `add pluginKirana() to plugins (import { pluginKirana } from "@kirana-style/rspack")`
      )
    case "rspack":
    case "webpack": {
      const source =
        project.bundler === "rspack"
          ? "@kirana-style/rspack"
          : "@kirana-style/webpack"
      return edit(
        CONFIG_NAMES(project.bundler),
        source,
        (text) => {
          if (/\bmodule\.exports\b/.test(text)) return undefined
          const edited = insertFirst(
            text,
            /\bplugins\s*:\s*\[/,
            "new KiranaPlugin()"
          )
          return (
            edited &&
            addImport(edited, `import { KiranaPlugin } from "${source}"`)
          )
        },
        undefined,
        `add new KiranaPlugin() to plugins (import { KiranaPlugin } from "${source}")`
      )
    }
    case "rolldown":
      return edit(
        CONFIG_NAMES("rolldown"),
        "@kirana-style/rolldown",
        (text) =>
          withPlugin(
            text,
            "plugins",
            `import kirana from "@kirana-style/rolldown"`,
            "kirana()"
          ),
        undefined,
        `add kirana() to plugins (import kirana from "@kirana-style/rolldown")`
      )
    case "parcel": {
      const transformer = edit(
        [".parcelrc"],
        "@kirana-style/parcel-transformer",
        () => undefined,
        {
          file: ".parcelrc",
          text: `{\n  "extends": "@parcel/config-default",\n  "transformers": {\n    "*.{js,mjs,jsx,ts,tsx}": ["@kirana-style/parcel-transformer", "..."]\n  }\n}\n`,
        },
        `put "@kirana-style/parcel-transformer" first in the transformers for *.{js,mjs,jsx,ts,tsx}`
      )
      const postcss = edit(
        [
          ".postcssrc",
          ".postcssrc.json",
          ...CONFIG_NAMES("postcss", ["mjs", "js", "cjs"]),
        ],
        "@kirana-style/postcss",
        () => undefined,
        {
          file: ".postcssrc",
          text: `{\n  "plugins": { "@kirana-style/postcss": {} }\n}\n`,
        },
        `add "@kirana-style/postcss" to the PostCSS plugins (the stylesheet comes from it)`
      )
      return merge(transformer, postcss)
    }
    case "bun":
      return manual(
        "adapter",
        `add kirana() to Bun.build's plugins (import kirana from "@kirana-style/bun")`
      )
    case "esbuild":
      return manual(
        "adapter",
        `add kirana() to esbuild's plugins (import kirana from "@kirana-style/esbuild")`
      )
    default:
      return done(
        "adapter",
        "no bundler: kirana-style build or kirana-style dev writes the stylesheet"
      )
  }
}

/** Two steps of one name as one. */
function merge(first: Step, second: Step): Step {
  if (first.status === "manual" || second.status === "manual")
    return manual(
      first.name,
      [first, second]
        .filter((part) => part.status !== "done")
        .map((part) => part.detail)
        .join("; ")
    )
  const changes = [first, second].flatMap((part) =>
    part.status === "change" ? part.changes : []
  )
  if (changes.length === 0)
    return done(first.name, `${first.detail}, ${second.detail}`)
  return step(
    first.name,
    [first, second]
      .filter((part) => part.status === "change")
      .map((part) => part.detail)
      .join(", "),
    changes
  )
}

/** Angular's builders, by the name an `angular.json` gives them, and Kirana's in their place. */
const ANGULAR_BUILDERS: readonly [RegExp, string][] = [
  [
    /"@angular(?:-devkit\/build-angular|\/build):application"/g,
    '"@kirana-style/angular:application"',
  ],
  [
    /"@angular(?:-devkit\/build-angular|\/build):dev-server"/g,
    '"@kirana-style/angular:dev-server"',
  ],
]

/**
 * The Angular CLI (D-068): `angular.json`'s build and serve builders become Kirana's, which compile
 * the sources into `.kirana/`; that folder is ignored like any build output.
 */
function angularCli(files: Files): Step {
  const config = files.read("angular.json")
  if (config === undefined)
    return manual(
      "adapter",
      'use "@kirana-style/angular:application" and "@kirana-style/angular:dev-server" as the build and serve builders'
    )
  if (config.includes("@kirana-style/angular:"))
    return done("adapter", "angular.json")
  let edited = config
  for (const [builder, kirana] of ANGULAR_BUILDERS)
    edited = edited.replace(builder, kirana)
  if (edited === config)
    return manual(
      "adapter",
      'angular.json: use "@kirana-style/angular:application" and "@kirana-style/angular:dev-server" as the build and serve builders'
    )
  const changes = [files.write("angular.json", edited)]
  const ignore = files.read(".gitignore") ?? ""
  if (!/^\/?\.kirana\/?$/m.test(ignore))
    changes.push(
      files.write(
        ".gitignore",
        `${[ignore.trimEnd(), "# Kirana's compiled sources (@kirana-style/angular)", ".kirana/"].filter(Boolean).join("\n")}\n`
      )
    )
  return step(
    "adapter",
    "use Kirana's builders in angular.json, and ignore .kirana/",
    changes
  )
}

/** The stylesheet: imported once where the document renders, or `@kirana;` for Turbopack. */
function stylesheetStep(files: Files, project: Detected): Step {
  const entries = (directories: readonly string[], bases: readonly string[]) =>
    directories.flatMap((directory) =>
      bases.flatMap((base) =>
        SCRIPTS.map((extension) => `${directory}${base}.${extension}`)
      )
    )
  const prepend = (file: string): Step => {
    const text = files.read(file)!
    if (text.includes(STYLESHEET)) return done("stylesheet", file)
    return step("stylesheet", `import the stylesheet in ${file}`, [
      files.write(file, `${styled(text, `import "${STYLESHEET}"`)}\n${text}`),
    ])
  }
  const entry = (candidates: readonly string[], help: string): Step => {
    const file = files.find(candidates)
    return file ? prepend(file) : manual("stylesheet", help)
  }
  const importHelp = `import "${STYLESHEET}" once, in the module that renders your document`
  switch (project.framework) {
    case "next": {
      const layouts = entries(["app/", "src/app/"], ["layout"])
      if (project.bundler === "webpack")
        return entry(
          [...layouts, ...entries(["pages/", "src/pages/"], ["_app"])],
          importHelp
        )
      const css = files.find([
        "app/globals.css",
        "src/app/globals.css",
        "styles/globals.css",
        "src/styles/globals.css",
      ])
      if (css) {
        const text = files.read(css)!
        if (/@kirana\b/.test(text)) return done("stylesheet", css)
        const after = `${[text.trimEnd(), "@kirana;"].filter(Boolean).join("\n")}\n`
        return step("stylesheet", `add @kirana; to ${css}`, [
          files.write(css, after),
        ])
      }
      const layout = files.find(layouts)
      if (!layout)
        return manual(
          "stylesheet",
          "add @kirana; to a global stylesheet your root layout imports"
        )
      const sheet = path.posix.join(path.posix.dirname(layout), "globals.css")
      return step(
        "stylesheet",
        `create ${sheet} with @kirana; and import it in ${layout}`,
        [
          files.write(sheet, "@kirana;\n"),
          files.write(
            layout,
            addImport(files.read(layout)!, `import "./globals.css"`)
          ),
        ]
      )
    }
    case "nuxt": {
      const config = files.find(CONFIG_NAMES("nuxt"))
      return config && files.read(config)!.includes(STYLESHEET)
        ? done("stylesheet", config)
        : manual("stylesheet", `add css: ["${STYLESHEET}"] to nuxt.config`)
    }
    case "sveltekit": {
      const file = "src/routes/+layout.svelte"
      const text = files.read(file)
      if (text === undefined)
        return step("stylesheet", `create ${file}`, [
          files.write(
            file,
            `<script>\n  import "${STYLESHEET}"\n\n  let { children } = $props()\n</script>\n\n{@render children()}\n`
          ),
        ])
      if (text.includes(STYLESHEET)) return done("stylesheet", file)
      const script = /<script\b[^>]*>/i.exec(text)
      const after = script
        ? `${text.slice(0, script.index + script[0].length)}\n  import "${STYLESHEET}"${text.slice(script.index + script[0].length)}`
        : `<script>\n  import "${STYLESHEET}"\n</script>\n\n${text}`
      return step("stylesheet", `import the stylesheet in ${file}`, [
        files.write(file, after),
      ])
    }
    case "astro": {
      const layouts = listDirectory(
        files,
        project.root,
        "src/layouts",
        ".astro"
      )
      const file = files.find([...layouts, "src/pages/index.astro"])
      if (!file)
        return manual(
          "stylesheet",
          `import "${STYLESHEET}" in your layout's frontmatter`
        )
      const text = files.read(file)!
      if (text.includes(STYLESHEET)) return done("stylesheet", file)
      const after = text.startsWith("---")
        ? text.replace(
            /^---[^\n]*\n/,
            (fence) => `${fence}import "${STYLESHEET}"\n`
          )
        : `---\nimport "${STYLESHEET}"\n---\n\n${text}`
      return step("stylesheet", `import the stylesheet in ${file}`, [
        files.write(file, after),
      ])
    }
    case "qwik":
      // Qwik Router's root renders the document; a client-only app's entry, without one.
      return entry(
        [
          ...entries(["src/"], ["root"]),
          ...entries(["src/"], ["main", "index"]),
        ],
        importHelp
      )
    case "angular":
      if (project.bundler !== "vite")
        return done("stylesheet", "the builders add the stylesheet to styles")
      return entry(entries(["src/"], ["main"]), importHelp)
    case "react-router":
      return entry(entries(["app/"], ["root"]), importHelp)
    case "ember":
      return entry(entries(["app/"], ["app"]), importHelp)
    case "meteor":
      return entry(entries(["client/"], ["main"]), importHelp)
    case "gatsby": {
      const browser = files.find(entries([""], ["gatsby-browser"]))
      return browser
        ? prepend(browser)
        : step("stylesheet", "create gatsby-browser.js", [
            files.write("gatsby-browser.js", `import "${STYLESHEET}"\n`),
          ])
    }
    case "laravel":
    case "symfony":
    case "rails":
    case "phoenix":
    case "adonisjs": {
      const out = `${staticDirectory(project.framework)}/kirana/kirana.css`
      const helper = HELPERS[project.framework]
      return manual(
        "stylesheet",
        `${helper ? `${helper}; ` : ""}run kirana-style dev resources/styles --out ${out} beside your server (kirana-style build --minify for production), and link /kirana/kirana.css from your layout`
      )
    }
    case "tanstack-start": {
      const route = files.find(
        entries(["src/routes/", "app/routes/"], ["__root"])
      )
      return route && files.read(route)!.includes(STYLESHEET)
        ? done("stylesheet", route)
        : manual(
            "stylesheet",
            `in the root route, import kiranaCss from "${STYLESHEET}?url" and add { rel: "stylesheet", href: kiranaCss } to head().links`
          )
    }
  }
  if (project.bundler === "none")
    return done(
      "stylesheet",
      "no bundler: link the file kirana-style build --out or kirana-style dev --out writes"
    )
  if (project.bundler === "parcel")
    return manual(
      "stylesheet",
      "add @kirana; to a stylesheet your HTML links: the PostCSS plugin writes the stylesheet there"
    )
  if (project.bundler === "rolldown")
    return done(
      "stylesheet",
      "the Rolldown adapter emits kirana.css: link it from your HTML"
    )
  return entry(
    entries(["src/"], ["main", "index", "app", "entry-client"]),
    importHelp
  )
}

/** The files with `extension` directly in a directory, relative to the root. */
function listDirectory(
  files: Files,
  root: string,
  directory: string,
  extension: string
): string[] {
  const absolute = path.join(root, directory)
  if (!existsSync(absolute)) return []
  return readdirSync(absolute)
    .filter((name) => name.endsWith(extension))
    .sort()
    .map((name) => (directory === "." ? name : `${directory}/${name}`))
    .filter((file) => files.read(file) !== undefined)
}

/** One reference to the framework's `sx` types, where `tsconfig.json` includes it. */
function typesStep(files: Files, project: Detected): Step {
  // Angular types `[sx]` through the directive's input; a component must import the directive.
  if (project.framework === "angular") {
    const source = path.join(project.root, "src")
    const imported =
      existsSync(source) &&
      sources(source).some((file) =>
        readFileSync(file, "utf8").includes("SxDirective")
      )
    return imported
      ? done("types", "SxDirective types [sx]")
      : manual(
          "types",
          'add SxDirective (import { SxDirective } from "@kirana-style/angular") to the imports of each component that uses [sx]'
        )
  }
  if (isServer(project.framework))
    return done("types", "templates name styles through the class map")
  const types = typesOf(project.framework)
  if (!types) return done("types", "no JSX: nothing to type")
  if (!project.typescript) return done("types", "no tsconfig.json")
  const directory = existsSync(path.join(project.root, "src")) ? "src" : ""
  const declared = [
    "tsconfig.json",
    "tsconfig.app.json",
    ...listDirectory(files, project.root, directory || ".", ".d.ts"),
  ].find((file) => files.read(file)?.includes("@kirana-style/core/"))
  if (declared) return done("types", declared)
  // A shared UI package that imports the types brings them into every app that uses it.
  const shared = project.local.find((entry) => mentions(entry.directory, types))
  if (shared) return done("types", `through ${shared.name}`)
  const file = path.posix.join(directory, "kirana.d.ts")
  return step("types", `create ${file}`, [
    files.write(file, `/// <reference types="${types}" />\n`),
  ])
}

/** What `kirana-style init` would do in `root`. */
export function plan(root: string, options: InitOptions = {}): Plan {
  const project = detect(root)
  const files = new Files(root)
  const steps = [
    configStep(files, project, options),
    adapterStep(files, project),
    stylesheetStep(files, project),
    typesStep(files, project),
  ]
  const missing = (names: readonly string[]) =>
    names.filter((name) => !(name in project.dependencies))
  // The command and the adapter may come from the workspace: its root, or a shared config package.
  const tools = ["kirana-style", ...adapterOf(project)].filter(
    (name) => !(name in project.workspace)
  )
  return {
    project,
    steps,
    dependencies: missing(runtimeOf(project)),
    // `kirana-style` carries the command and depends on the compiler, so the project gets both.
    development: missing([
      ...tools,
      ...(options.preset ? ["@kirana-style/preset-scales"] : []),
    ]),
  }
}

/**
 * A line diff of a setup change: the longest common subsequence of lines, each changed run shown
 * with a line of context around it. Configuration files are short, so the quadratic table is fine.
 */
export function diff(change: Change): string {
  const before = change.before === undefined ? [] : change.before.split("\n")
  const after = change.after.split("\n")
  const common: number[][] = Array.from({ length: before.length + 1 }, () =>
    Array.from({ length: after.length + 1 }, () => 0)
  )
  for (let i = before.length - 1; i >= 0; i--)
    for (let j = after.length - 1; j >= 0; j--)
      common[i]![j] =
        before[i] === after[j]
          ? common[i + 1]![j + 1]! + 1
          : Math.max(common[i + 1]![j]!, common[i]![j + 1]!)
  const lines: { mark: " " | "-" | "+"; text: string }[] = []
  let [i, j] = [0, 0]
  while (i < before.length || j < after.length) {
    if (i < before.length && j < after.length && before[i] === after[j]) {
      lines.push({ mark: " ", text: before[i++]! })
      j++
    } else if (
      i < before.length &&
      (j === after.length || common[i + 1]![j]! >= common[i]![j + 1]!)
    ) {
      lines.push({ mark: "-", text: before[i++]! })
    } else {
      lines.push({ mark: "+", text: after[j++]! })
    }
  }
  // Context: unchanged lines next to a change; a gap between hunks is marked.
  const near = (index: number) =>
    lines[index]!.mark !== " " ||
    lines[index - 1]?.mark.trim() ||
    lines[index + 1]?.mark.trim()
  const out = [
    change.before === undefined
      ? `+++ ${change.file} (new)`
      : `--- ${change.file}`,
  ]
  let skipped = false
  lines.forEach((line, index) => {
    if (!near(index)) {
      skipped = true
      return
    }
    if (skipped && out.length > 1) out.push("  …")
    skipped = false
    out.push(`${line.mark} ${line.text}`.trimEnd())
  })
  return `${out.join("\n")}\n`
}

/** What a terminal session gives the command. */
export type Io = {
  write: (text: string) => void
  /** Asks a yes-or-no question. */
  ask: (question: string) => Promise<boolean>
  /** Runs a command line; returns its exit code. */
  run: (command: string) => number
}

const NAMES: Record<Detected["framework"], string> = {
  next: "Next.js",
  nuxt: "Nuxt",
  sveltekit: "SvelteKit",
  astro: "Astro",
  "tanstack-start": "TanStack Start",
  react: "React",
  preact: "Preact",
  solid: "Solid",
  vue: "Vue",
  svelte: "Svelte",
  qwik: "Qwik",
  angular: "Angular",
  "react-router": "React Router",
  gatsby: "Gatsby",
  ember: "Ember.js",
  meteor: "Meteor",
  laravel: "Laravel",
  symfony: "Symfony",
  rails: "Ruby on Rails",
  phoenix: "Phoenix",
  adonisjs: "AdonisJS",
  vanilla: "No framework",
}

/** A one-line description of a detected project. */
export function describe(project: Detected): string {
  const bundler = project.bundler === "none" ? "no bundler" : project.bundler
  const language = project.typescript ? "TypeScript" : "JavaScript"
  return `${NAMES[project.framework]} · ${bundler} · ${project.packageManager} · ${language}`
}

/** `kirana-style init [--yes] [--dry-run] [--install] [--preset]`. */
export async function runInit(
  argv: readonly string[],
  root: string,
  io: Io
): Promise<number> {
  const flags = new Set(argv)
  const unknown = argv.filter(
    (flag) =>
      !["--yes", "-y", "--dry-run", "--install", "--preset"].includes(flag)
  )
  if (unknown.length) {
    io.write(
      `unknown option ${unknown[0]}\nusage: kirana-style init [--yes] [--dry-run] [--install] [--preset]\n`
    )
    return 2
  }
  // A server framework's root has its own manifest; npm adds package.json with the first install.
  if (
    !existsSync(path.join(root, "package.json")) &&
    !isServer(detect(root).framework)
  ) {
    io.write(
      "no package.json here: run kirana-style init in your project's root\n"
    )
    return 2
  }
  const result = plan(root, { preset: flags.has("--preset") })
  io.write(`${describe(result.project)}\n\n`)
  const changes = result.steps.flatMap((part) =>
    part.status === "change" ? part.changes : []
  )
  for (const part of result.steps) {
    const mark =
      part.status === "done" ? "✓" : part.status === "change" ? "+" : "!"
    io.write(`${mark} ${part.name}: ${part.detail}\n`)
  }
  for (const change of changes) io.write(`\n${diff(change)}`)
  const manualSteps = result.steps.filter((part) => part.status === "manual")
  if (manualSteps.length) {
    io.write("\nTo do by hand:\n")
    for (const part of manualSteps) io.write(`  ${part.name}: ${part.detail}\n`)
  }
  const commands = installCommand(
    result.project.packageManager,
    result.dependencies,
    result.development
  )
  if (flags.has("--dry-run")) {
    io.write(
      `\nDry run: nothing written.${commands.map((line) => `\n  ${line}`).join("")}\n`
    )
    return 0
  }
  if (changes.length) {
    const write =
      flags.has("--yes") ||
      flags.has("-y") ||
      (await io.ask(`\nWrite ${changes.length} file(s)? [y/N] `))
    if (!write) {
      io.write("Nothing written.\n")
      return 1
    }
    for (const change of changes) {
      const file = path.join(root, change.file)
      mkdirSync(path.dirname(file), { recursive: true })
      writeFileSync(file, change.after)
    }
    io.write(`Wrote ${changes.length} file(s).\n`)
  }
  if (commands.length) {
    if (flags.has("--install")) {
      for (const command of commands) {
        io.write(`\n$ ${command}\n`)
        const code = io.run(command)
        if (code !== 0) return code
      }
    } else {
      io.write(`\nInstall:\n${commands.map((line) => `  ${line}\n`).join("")}`)
    }
  }
  io.write(
    changes.length || commands.length || manualSteps.length
      ? `\nThen check the setup with: ${runCommand(result.project.packageManager, "kirana-style doctor")}\n`
      : "\nAlready set up.\n"
  )
  return 0
}
