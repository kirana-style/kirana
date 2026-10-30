/**
 * The JSON the engine receives (KRN-INT-001), built from a configuration object that is already
 * loaded. Nothing here reads a file or imports a Node.js module: the Driver's `resolveConfig` and
 * the browser entry (`@kirana-style/compiler-browser`) both build their JSON with it, so the two
 * cannot drift.
 */
import type {
  ExportSource,
  KiranaConfig,
  ScaleSource,
  UtilityGrammar,
  UtilityRule,
  UtilityVariant,
} from "@kirana-style/core/config"

/** The `jsx` modes other than React's. */
export type JsxMode = "preact" | "solid" | "qwik"

/** Where a relative module named by the configuration lives, given the project root. */
export type ResolveModule = (root: string, module: string) => string

/**
 * `root` joined with a relative module, for POSIX paths: `.` and `..` segments are resolved and
 * the result is absolute when `root` is. The browser's in-memory projects have no other kind.
 */
export function posixResolve(root: string, module: string): string {
  const segments: string[] = []
  for (const segment of `${root}/${module}`.split("/")) {
    if (segment === "" || segment === ".") continue
    if (segment === "..") segments.pop()
    else segments.push(segment)
  }
  return `${root.startsWith("/") ? "/" : ""}${segments.join("/")}`
}

/**
 * The engine's JSON: file configuration, overridden key by key by inline options. `jsx` is the
 * mode detected from the project when the configuration names none.
 */
export function engineJson(
  root: string,
  config: KiranaConfig,
  inline: KiranaConfig,
  options: { jsx?: JsxMode; resolveModule?: ResolveModule } = {}
): string {
  // `ui` is `kirana-style ui`'s (D-103), never the engine's, which refuses keys it does not know.
  const {
    presets = [],
    utilities,
    ui: _registry,
    ...merged
  } = { ...config, ...inline }
  const jsx = merged.jsx ?? options.jsx
  const grammar = mergeGrammars(
    [...presets.map((preset) => preset.utilities), utilities],
    root,
    options.resolveModule
  )
  return JSON.stringify({
    ...merged,
    ...(jsx ? { jsx } : {}),
    ...(grammar ? { utilities: grammar } : {}),
    root,
  })
}

/**
 * The presets' utility grammars and the project's, merged in order: a later scale, root, variant or
 * handle replaces an earlier one of the same name (KRN-TOK-008). A relative module is resolved from
 * the project root, since the engine reads it from whichever module uses the utility.
 */
export function mergeGrammars(
  grammars: readonly (UtilityGrammar | undefined)[],
  root: string,
  resolveModule: ResolveModule = posixResolve
): UtilityGrammar | undefined {
  const present = grammars.filter((grammar) => grammar !== undefined)
  if (present.length === 0) return undefined
  const scales: Record<string, ScaleSource[]> = {}
  const utilities: Record<string, readonly UtilityRule[]> = {}
  const variants: Record<string, UtilityVariant> = {}
  const handles: Record<string, ExportSource> = {}
  const resolved = (module: string) =>
    /^\.\.?\//.test(module) ? resolveModule(root, module) : module
  for (const grammar of present) {
    for (const [name, sources] of Object.entries(grammar.scales ?? {})) {
      scales[name] = sources.map((source) => ({
        module: resolved(source.module),
        export: source.export,
      }))
    }
    Object.assign(utilities, grammar.utilities)
    for (const [name, variant] of Object.entries(grammar.variants ?? {})) {
      variants[name] =
        typeof variant === "string"
          ? variant
          : { ...variant, module: resolved(variant.module) }
    }
    for (const [name, source] of Object.entries(grammar.handles ?? {})) {
      handles[name] = { ...source, module: resolved(source.module) }
    }
  }
  // Only when declared, so a grammar without handles reaches the engine as before.
  const declared = Object.keys(handles).length > 0
  return { scales, utilities, variants, ...(declared ? { handles } : {}) }
}
