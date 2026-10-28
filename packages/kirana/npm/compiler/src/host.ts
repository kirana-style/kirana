/**
 * What every host adapter shares (KRN-INT-001): which modules reach the Driver, the stylesheet
 * entry's placeholder and its content-hashed replacement, and how diagnostics are reported once.
 * None of it interprets styles (D-028); it is the part of an adapter that does not depend on the
 * host's API.
 */
import { createHash } from "node:crypto"
import { readFileSync, readdirSync } from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"

import { formatDiagnostic } from "./diagnostics.ts"
import type { Diagnostic } from "./diagnostics.ts"

/** The placeholder rule the stylesheet entry compiles to until the adapter replaces it. */
export const PLACEHOLDER = '.kirana-placeholder{--kirana:"stylesheet"}'
// `[^{}]`, not `[^}]`: a body never holds a brace, and excluding the opening one too keeps the
// match linear on a stylesheet with many unclosed `.kirana-placeholder{` (CodeQL js/polynomial-redos).
export const PLACEHOLDER_RULE = /\.kirana-placeholder\s*\{[^{}]*\}/

/**
 * A module to compile, including one a framework re-emits under a query.
 *
 * TanStack Start's route splitting serves `route.tsx?tsr-split=component`, and a
 * plugin that only matched a bare extension would hand the browser the original,
 * uncompiled source of that chunk.
 */
export const SCRIPT = /\.[cm]?[jt]sx?(?:[?#]|$)/
/** `?raw`, `?url` and `?inline` ask for the file itself, not for a module. */
export const ASSET_QUERY = /[?&](url|raw|inline)\b/
/**
 * A module a plugin generates rather than reads from a file (`virtual:vite-rsc/css?…&lang.js`,
 * Rollup's `\0`-prefixed ids): it holds the plugin's own code, never a project's styles, though its
 * id can end in a script extension.
 */
export const VIRTUAL = /^(?:\0|virtual:)/
/** Installed packages are compiled by their own build, or consumed through a manifest (KRN-INT-008). */
export const NODE_MODULES = /[\\/]node_modules[\\/]/
/**
 * Source that can hold a style: imports Kirana, passes `sx`, or reads a relation it imports
 * (`scope.within(…)`, KF-051). The engine's prefilter is exact.
 */
export const STYLE_BEARING =
  /@kirana-style\/|\bsx\s*[=:]|\.(?:within|parent|after|before)\s*\(/

/** A script a project's styles are written in, by file name. */
export const SCRIPT_FILE = /\.[cm]?[jt]sx?$/

/** Directories that hold no source: installed packages, build output, tools' caches. */
export const SKIPPED = new Set([
  "node_modules",
  "dist",
  "build",
  "out",
  "coverage",
])

/** Every script under `directory`, without installed packages, build output, hidden folders or declarations. */
export function sources(directory: string, out: string[] = []): string[] {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      if (!SKIPPED.has(entry.name) && !entry.name.startsWith("."))
        sources(file, out)
    } else if (SCRIPT_FILE.test(entry.name) && !entry.name.endsWith(".d.ts")) {
      out.push(file)
    }
  }
  return out
}

/**
 * Kirana's own packages that declare tokens or styles. An application compiles them from
 * `node_modules` as it compiles a listed library, without listing them: the evaluator already folds
 * their values as Kirana's (KRN-TOK-008), and a module of theirs that the application imports at
 * runtime would otherwise reach the browser with its `defineTokens()` calls uncompiled.
 */
export const KIRANA_LIBRARIES: readonly string[] = [
  "@kirana-style/preset-scales",
]

/** The installed packages an application compiles: Kirana's own, then its `libraries`. */
export function compiledLibraries(libraries: readonly string[]): string[] {
  return [...new Set([...KIRANA_LIBRARIES, ...libraries])]
}

/**
 * Whether a module is the application's to compile: anything outside `node_modules`, and inside it
 * only the packages listed in `libraries` (KRN-INT-008). The path is matched as
 * `node_modules/<name>/`, which holds for npm's, pnpm's and Bun's layouts alike.
 */
export function compilesModule(
  id: string,
  libraries: readonly string[]
): boolean {
  if (!NODE_MODULES.test(id)) return true
  const normalized = id.replaceAll("\\", "/")
  return libraries.some((name) => normalized.includes(`/node_modules/${name}/`))
}

/** Whether a host without its own filters should hand this module to the Driver. */
export function shouldCompile(
  id: string,
  code: string,
  libraries: readonly string[] = []
): boolean {
  return (
    SCRIPT.test(id) &&
    !ASSET_QUERY.test(id) &&
    !VIRTUAL.test(id) &&
    compilesModule(id, libraries) &&
    STYLE_BEARING.test(code)
  )
}

/** The module id without a query string. */
/**
 * The variable tokens (`--{prefix}v` and four characters) and keyframes (`{prefix}f` and four) a
 * text names: what a finished bundle's chunks and stylesheets still use, so its stylesheet keeps
 * them (D-086, D-094).
 */
export function definitionNames(text: string, prefix: string): string[] {
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return [
    ...new Set(
      text.match(
        new RegExp(
          `(?:--${escaped}v|(?<![0-9A-Za-z_-])${escaped}f)[0-9A-Za-z]{4}(?![0-9A-Za-z_-])`,
          "g"
        )
      ) ?? []
    ),
  ]
}

export function cleanId(id: string): string {
  return id.split("?", 1)[0]!
}

/** Where `@kirana-style/core/stylesheet.css` resolves from a project root. */
export function stylesheetPath(root: string): string {
  return createRequire(path.join(root, "package.json")).resolve(
    "@kirana-style/core/stylesheet.css"
  )
}

/** A stylesheet with the placeholder rule replaced by the compiled one; undefined when it has none. */
export function fillStylesheet(
  source: string,
  css: string
): string | undefined {
  return PLACEHOLDER_RULE.test(source)
    ? source.replace(PLACEHOLDER_RULE, () => css)
    : undefined
}

/** Replaces the placeholder asset with the real stylesheet under a content-hashed name. */
export function renameAsset(fileName: string, css: string): string {
  const hash = createHash("sha256").update(css).digest("base64url").slice(0, 8)
  const directory = path.posix.dirname(fileName)
  // Vite separates the hash with `-`, Astro with `.`: either is replaced, not appended to.
  const base = path.posix
    .basename(fileName, ".css")
    .replace(/[.-][\w-]{8}$/, "")
  return path.posix.join(directory, `${base}-${hash}.css`)
}

/** A diagnostic's source file read from the project root, for its line and column; undefined when unreadable. */
export function readSource(root: string, file: string): string | undefined {
  try {
    return readFileSync(path.resolve(root, file), "utf8")
  } catch {
    return undefined
  }
}

/** FNV-1a of a module's source: enough to tell "same text" from "new text". */
export function digestOf(text: string): number {
  let value = 0x811c9dc5
  for (let index = 0; index < text.length; index++) {
    value ^= text.charCodeAt(index)
    value = Math.imul(value, 0x01000193)
  }
  return value >>> 0
}

/** The two things a host lets an adapter do with a diagnostic. */
export type ReportContext = {
  warn: (message: string) => void
  error: (message: string) => never
}

/**
 * Reports diagnostics the way every adapter does: warnings (and infos when asked) through the
 * host's warning channel, errors together as one failure.
 *
 * A host may compile the same module twice — Vite's client and SSR environments, webpack's
 * server and client compilers — and end the build twice. Each module's warnings are printed once
 * per source text and the project's once per message; errors still fail every time. A hash stands
 * in for the text, which would otherwise be a second copy of every module in memory.
 */
export function createReporter(options: { reportInfo?: boolean } = {}) {
  const digests = new Map<string, number>()
  const project = new Set<string>()

  const report = (
    context: ReportContext,
    diagnostics: readonly Diagnostic[],
    sourceOf: (file: string) => string | undefined,
    warn: boolean
  ) => {
    const format = (diagnostic: Diagnostic) =>
      formatDiagnostic(diagnostic, sourceOf(diagnostic.file))
    for (const diagnostic of diagnostics) {
      if (
        warn &&
        (diagnostic.severity === "warning" ||
          (options.reportInfo && diagnostic.severity === "info"))
      ) {
        context.warn(format(diagnostic))
      }
    }
    const errors = diagnostics.filter(
      (diagnostic) => diagnostic.severity === "error"
    )
    if (errors.length) context.error(errors.map(format).join("\n"))
  }

  return {
    /** A module's diagnostics, after its transform. */
    module(
      context: ReportContext,
      file: string,
      code: string,
      diagnostics: readonly Diagnostic[]
    ) {
      const digest = digestOf(code)
      const fresh = digests.get(file) !== digest
      digests.set(file, digest)
      report(context, diagnostics, () => code, fresh)
    },
    /** The project's diagnostics, at the end of a build. */
    project(
      context: ReportContext,
      root: string,
      diagnostics: readonly Diagnostic[]
    ) {
      const key = JSON.stringify(diagnostics)
      report(
        context,
        diagnostics,
        (file) => readSource(root, file),
        !project.has(key)
      )
      project.add(key)
    },
  }
}
