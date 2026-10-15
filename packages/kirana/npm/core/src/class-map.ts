/**
 * The class map for server templates (D-069), read in Node.js: Edge (`@kirana-style/adonis`) and any other
 * JavaScript template engine name the handles a server app's style modules export, and this merges
 * their class strings with the runtime every compiled module uses. `kirana-style build` and `kirana-style dev`
 * write the file (`classes` in `kirana.config`).
 */
import { readFileSync, statSync } from "node:fs"

import { runtime } from "./internal.ts"

/** The file `kirana-style build` and `kirana-style dev` write. */
export type ClassMapFile = {
  readonly version: number
  readonly prefix?: string
  readonly families?: { readonly four?: number; readonly two?: number }
  readonly classes?: Readonly<Record<string, string>>
}

/** A name, or a falsy value a condition leaves (`active && "card.active"`). */
export type StyleName = string | false | null | undefined

export class ClassMap {
  readonly #classes: Readonly<Record<string, string>>
  readonly #runtime: ReturnType<typeof runtime>

  constructor(map: ClassMapFile) {
    if (map.version !== 1)
      throw new Error(
        "kirana: this class map was written by another version of Kirana; rebuild it"
      )
    this.#classes = map.classes ?? {}
    this.#runtime = runtime(map.prefix ?? "k", "class")
  }

  /** Reads the class map `kirana-style build` or `kirana-style dev` wrote. */
  static fromFile(file: string): ClassMap {
    let text: string
    try {
      text = readFileSync(file, "utf8")
    } catch {
      throw new Error(
        `kirana: no class map at ${file}; run \`kirana-style dev\` or \`kirana-style build\` first`
      )
    }
    return new ClassMap(JSON.parse(text) as ClassMapFile)
  }

  /** The classes of the named handles, merged, later ones winning; falsy names are skipped. */
  classes(...names: readonly StyleName[]): string {
    const strings = names.filter(Boolean).map((name) => {
      if (!this.has(name as string))
        throw new Error(`kirana: no style named "${name}" in the class map`)
      return this.#classes[name as string]!
    })
    return this.#runtime.sx(strings, [], []).class ?? ""
  }

  /** Whether the map has a handle by this name. */
  has(name: string): boolean {
    return Object.hasOwn(this.#classes, name)
  }
}

const cache = new Map<string, { stamp: string; map: ClassMap }>()

/** The class map at `file`, read again when the file changes (`kirana-style dev` rewrites it). */
export function classMap(file: string): ClassMap {
  const stats = statSync(file, { throwIfNoEntry: false })
  const stamp = stats ? `${stats.mtimeMs}:${stats.size}` : ""
  const cached = cache.get(file)
  if (cached && stamp && cached.stamp === stamp) return cached.map
  const map = ClassMap.fromFile(file)
  cache.set(file, { stamp, map })
  return map
}
