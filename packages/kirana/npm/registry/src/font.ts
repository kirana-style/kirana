/**
 * Font items (KF-050, D-107): an item of type `font` names its family and the stylesheet that loads
 * it (`font.import`, a package it lists in `dependencies`). `ui add` imports that stylesheet once in
 * the app's entry, after Kirana's; a design system's axis names the font item each of its values
 * installs (`design.axes.<axis>.items`), which `ui init --preset` and `ui preset` add.
 */
import { addImport } from "@kirana-style/compiler"

import type { Planned } from "./add.ts"
import { parseReference } from "./read.ts"
import type { Design } from "./types.ts"

/** Kirana's stylesheet, as the app's entry imports it. */
export const STYLESHEET = "@kirana-style/core/stylesheet.css"

/**
 * The script that loads Kirana's stylesheet, where the design system's and the fonts' stylesheets
 * go after it: one that imports it, or a configuration that lists it in `css` (Nuxt's
 * `nuxt.config.ts`, KF-107), which runs in Node and takes them in the same list instead.
 */
export function stylesheetEntry(
  scripts: readonly string[],
  read: (file: string) => string | undefined
): { file: string; listed: boolean } | undefined {
  const file = scripts.find((entry) => read(entry)!.includes(STYLESHEET))
  if (file === undefined) return undefined
  return { file, listed: LISTED.test(read(file)!) }
}

/** Kirana's stylesheet as an entry of a configuration's `css` list. */
const LISTED =
  /\bcss\s*:\s*\[[^\]]*(["'])@kirana-style\/core\/stylesheet\.css\1/

/** `text` loading `specifier` after Kirana's stylesheet: imported, or listed beside it in `css`. */
export function withStylesheet(
  text: string,
  specifier: string,
  listed: boolean
): string {
  if (!listed) return addImport(text, `import "${specifier}"`)
  return text.replace(
    LISTED,
    (entry, quote: string) => `${entry}, ${quote}${specifier}${quote}`
  )
}

/** The line reporting `withStylesheet`'s edit. */
export const loadsLine = (file: string, specifier: string, listed: boolean) =>
  `${file}: ${listed ? "css lists" : "imports"} ${specifier}`

/** The full reference of an item a design system names: a bare name is the design system's registry's. */
const qualified = (reference: string, namespace: string) =>
  reference.startsWith("@") ? reference : `${namespace}/${reference}`

/**
 * The items a design's values install, as full references, each once: for every axis that names
 * one for its value. `system` is the design system's own reference, whose registry a bare name is in.
 */
export function axisItems(
  design: Design,
  values: Readonly<Record<string, string>>,
  system: string
): string[] {
  const { namespace } = parseReference(system)
  const items = new Set<string>()
  for (const [axis, value] of Object.entries(values)) {
    const item = design.axes[axis]?.items?.[value]
    if (item !== undefined) items.add(qualified(item, namespace))
  }
  return [...items]
}

/** Every item any value of the design installs, as full references. */
export function allAxisItems(design: Design, system: string): string[] {
  const { namespace } = parseReference(system)
  return [
    ...new Set(
      Object.values(design.axes).flatMap((axis) =>
        Object.values(axis.items ?? {}).map((item) =>
          qualified(item, namespace)
        )
      )
    ),
  ]
}

/**
 * The imports of the planned font items' stylesheets, each once, in the script that imports
 * Kirana's stylesheet: the edited texts by file, and a line for each. A project without such a
 * script (a PostCSS `@kirana;` directive) is told what to import, by hand.
 */
export function importFonts(
  planned: readonly Pick<Planned, "key" | "item">[],
  scripts: readonly string[],
  read: (file: string) => string | undefined
): { edits: Map<string, string>; report: string[]; manual: string[] } {
  const edits = new Map<string, string>()
  const report: string[] = []
  const manual: string[] = []
  const entry = stylesheetEntry(scripts, read)
  for (const { item } of planned) {
    if (item.font === undefined) continue
    const specifier = item.font.import
    if (entry === undefined) {
      manual.push(`import "${specifier}" after Kirana's stylesheet`)
      continue
    }
    const { file, listed } = entry
    const text = edits.get(file) ?? read(file)!
    if (text.includes(`"${specifier}"`) || text.includes(`'${specifier}'`))
      continue
    edits.set(file, withStylesheet(text, specifier, listed))
    report.push(loadsLine(file, specifier, listed))
  }
  return { edits, report, manual }
}
