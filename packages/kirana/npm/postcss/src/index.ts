/**
 * Kirana for PostCSS (KRN-INT-010, `design-notes/turbopack.md`): in a stylesheet holding the
 * `@kirana;` directive, the plugin compiles the project and writes the stylesheet in its place.
 *
 * This is how a host that runs loaders but no plugins — Turbopack — still gets one stylesheet: the
 * module transform happens in a loader (`@kirana-style/next/loader`), the stylesheet here, each in a session
 * of its own. They agree without talking because a class name is a hash of what it styles, never of
 * the order modules compiled in (D-037). The project is compiled incrementally: a run transforms only
 * the files whose modification time changed, and what they invalidated. The plugin returns a
 * `dir-dependency` on the project, so a dev server runs it again when a component changes.
 */
import { readFileSync, statSync } from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"

import { Driver } from "@kirana-style/compiler"
import {
  KIRANA_LIBRARIES,
  PLACEHOLDER_RULE,
  createReporter,
  sources,
} from "@kirana-style/compiler/host"
import postcss from "postcss"
import type { AtRule, PluginCreator, Rule } from "postcss"

export type KiranaPostcssOptions = {
  /** The project root; defaults to the working directory, which is the project's in Next.js. */
  root?: string
  /** Minified output; defaults to on in production (`NODE_ENV`). */
  minify?: boolean
  /** Report info diagnostics too, not only warnings and errors. */
  reportInfo?: boolean
}

/** The globs a dev server watches for the plugin (`dir-dependency`). */
export const WATCHED = "**/*.{js,jsx,ts,tsx,mjs,cjs,mts,cts}"

export { sources }

/** One project's compiled state, kept across runs in a process. */
export class Project {
  readonly root: string
  readonly #driver: Promise<Driver>
  /** Each compiled file's modification time at its last transform. */
  readonly #seen = new Map<string, number>()

  constructor(root: string, driver?: Promise<Driver>) {
    this.root = root
    this.#driver = driver ?? Driver.create({ root })
  }

  driver(): Promise<Driver> {
    return this.#driver
  }

  /** The directories compiled: the project, and the packages it compiles as its own. */
  directories(driver: Driver): string[] {
    const require = createRequire(path.join(this.root, "package.json"))
    const libraries = driver.libraries.flatMap((name) => {
      try {
        return [path.dirname(require.resolve(`${name}/package.json`))]
      } catch (error) {
        // Kirana's own are compiled when the project has them; a listed library must resolve.
        if (KIRANA_LIBRARIES.includes(name)) return []
        throw error
      }
    })
    return [this.root, ...libraries]
  }

  /** Compiles what changed since the last run; returns the stylesheet. */
  async stylesheet(minify: boolean): Promise<string> {
    const driver = await this.#driver
    const files = this.directories(driver).flatMap((directory) =>
      sources(directory)
    )
    const present = new Set(files)
    const changed = new Set<string>()
    for (const file of files) {
      const time = statSync(file).mtimeMs
      if (this.#seen.get(file) === time) continue
      this.#seen.set(file, time)
      // A changed module, and every module that read a value from it (KRN-INT-009) still here.
      const affected = [file, ...driver.invalidate(file)]
      for (const module of affected.filter((id) => present.has(id)))
        changed.add(module)
    }
    for (const file of this.#seen.keys()) {
      if (present.has(file)) continue
      this.#seen.delete(file)
      driver.remove(file)
    }
    for (const file of changed)
      driver.transform(file, readFileSync(file, "utf8"), { map: false })
    return driver.stylesheet(minify)
  }
}

const projects = new Map<string, Project>()

/** The project for a root, opened once per process. */
export function projectFor(root: string): Project {
  let project = projects.get(root)
  if (!project) {
    project = new Project(root)
    projects.set(root, project)
  }
  return project
}

/** The node the stylesheet replaces: the `@kirana;` directive or the stylesheet's placeholder. */
function target(root: postcss.Root): AtRule | Rule | undefined {
  let found: AtRule | Rule | undefined
  root.walkAtRules("kirana", (rule) => {
    found ??= rule
  })
  root.walkRules((rule) => {
    if (!found && PLACEHOLDER_RULE.test(rule.toString())) found = rule
  })
  return found
}

const plugin: PluginCreator<KiranaPostcssOptions> = (options = {}) => {
  const reporter = createReporter({ reportInfo: options.reportInfo })
  return {
    postcssPlugin: "@kirana-style/postcss",
    async Once(root, { result }) {
      const node = target(root)
      if (!node) return
      const project = projectFor(path.resolve(options.root ?? process.cwd()))
      const minify = options.minify ?? process.env.NODE_ENV === "production"
      const css = await project.stylesheet(minify)
      const driver = await project.driver()
      reporter.project(
        {
          warn: (message) => {
            result.warn(message)
          },
          error: (message) => {
            throw node.error(message)
          },
        },
        project.root,
        driver.diagnostics()
      )
      node.replaceWith(postcss.parse(css, { from: result.opts.from }).nodes)
      // A dev server runs the plugin again when any script of the project changes, or the config.
      for (const directory of project.directories(driver)) {
        result.messages.push({
          type: "dir-dependency",
          plugin: "@kirana-style/postcss",
          dir: directory,
          glob: WATCHED,
          parent: result.opts.from,
        })
      }
      if (driver.configFile) {
        result.messages.push({
          type: "dependency",
          plugin: "@kirana-style/postcss",
          file: driver.configFile,
          parent: result.opts.from,
        })
      }
    },
  }
}
plugin.postcss = true

export default plugin
