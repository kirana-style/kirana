/**
 * Kirana for the Angular CLI (D-068, `design-notes/angular.md`). Angular's builder offers no hook to
 * change a source, but honours `fileReplacements`, so the builders keep a mirror of the source folder
 * in `.kirana/`: every file copied, the ones that hold styles compiled. Relative imports and
 * `templateUrl`s resolve inside the mirror; in watch mode each change is mirrored again and Angular,
 * which watches the replacements, rebuilds.
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  watch as fsWatch,
  writeFileSync,
} from "node:fs"
import path from "node:path"

import { Driver, formatDiagnostic } from "@kirana-style/compiler"
import type { Diagnostic } from "@kirana-style/compiler"
import { SKIPPED, shouldCompile } from "@kirana-style/compiler/host"

/** Where the mirror lives, under the workspace root. */
export const MIRROR = ".kirana"

/** The stylesheet the builders add to `styles`. */
export const STYLESHEET = path.join(MIRROR, "kirana.css")

/** Every file under `directory`, relative to it, without installed packages or hidden folders. */
export function walk(directory: string, prefix = ""): string[] {
  const out: string[] = []
  for (const entry of readdirSync(path.join(directory, prefix), {
    withFileTypes: true,
  })) {
    const relative = path.join(prefix, entry.name)
    if (entry.isDirectory()) {
      if (!SKIPPED.has(entry.name) && !entry.name.startsWith("."))
        out.push(...walk(directory, relative))
    } else out.push(relative)
  }
  return out
}

export type Mirror = {
  /** `fileReplacements` for every TypeScript file of the source folder. */
  replacements: { replace: string; with: string }[]
  /** Mirrors one changed or deleted file (and what read from it); returns whether anything changed. */
  update: (file: string) => boolean
  /** Diagnostics from the last pass, formatted. */
  messages: () => string[]
}

const SCRIPT = /\.[cm]?tsx?$/

/** Builds the mirror of `sourceRoot` (relative to `root`) and writes the stylesheet. */
export async function createMirror(
  root: string,
  sourceRoot: string,
  options: { minify?: boolean } = {}
): Promise<Mirror> {
  const driver = await Driver.create({ root })
  const source = path.join(root, sourceRoot)
  const target = path.join(root, MIRROR, sourceRoot)
  const reported: Diagnostic[] = []
  const texts = new Map<string, string>()

  const mirror = (relative: string): void => {
    const from = path.join(source, relative)
    const to = path.join(target, relative)
    if (!existsSync(from)) {
      driver.remove(from)
      rmSync(to, { force: true })
      return
    }
    mkdirSync(path.dirname(to), { recursive: true })
    const text = SCRIPT.test(relative) ? readFileSync(from, "utf8") : undefined
    if (text === undefined || !shouldCompile(from, text, driver.libraries)) {
      copyFileSync(from, to)
      return
    }
    const result = driver.transform(from, text, { map: false })
    texts.set(path.relative(root, from).replaceAll("\\", "/"), text)
    reported.push(...result.diagnostics)
    writeFileSync(to, result.code ?? text)
  }
  const stylesheet = () => {
    reported.push(...driver.diagnostics())
    const css = driver.stylesheet(options.minify ?? false)
    const file = path.join(root, STYLESHEET)
    const changed = !existsSync(file) || readFileSync(file, "utf8") !== css
    if (changed) writeFileSync(file, css)
    return changed
  }

  rmSync(target, { recursive: true, force: true })
  const files = walk(source)
  for (const relative of files) mirror(relative)
  stylesheet()

  return {
    replacements: files
      .filter(
        (relative) => SCRIPT.test(relative) && !relative.endsWith(".d.ts")
      )
      .map((relative) => ({
        replace: path.join(sourceRoot, relative),
        with: path.join(MIRROR, sourceRoot, relative),
      })),
    update(file) {
      reported.length = 0
      const absolute = path.resolve(root, file)
      // The changed file, and every module that read a value from it.
      const affected = [absolute, ...driver.invalidate(absolute)]
      for (const changed of affected) mirror(path.relative(source, changed))
      return stylesheet()
    },
    messages: () =>
      reported.map((diagnostic) =>
        formatDiagnostic(diagnostic, texts.get(diagnostic.file))
      ),
  }
}

/** Mirrors every change under the source folder until closed (watch builds and the dev server). */
export function watchMirror(
  root: string,
  sourceRoot: string,
  mirror: Mirror,
  onUpdate: () => void,
  watch = fsWatch
): { close: () => void } {
  return watch(path.join(root, sourceRoot), { recursive: true }, (_, name) => {
    const relative = String(name)
    // Editors' swap files and tools' folders are not sources.
    if (
      relative
        .split(/[\\/]/)
        .some((part) => part.startsWith(".") || SKIPPED.has(part))
    )
      return
    mirror.update(path.join(sourceRoot, relative))
    onUpdate()
  })
}
