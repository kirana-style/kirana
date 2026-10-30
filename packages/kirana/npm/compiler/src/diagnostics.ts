import type { NativeBinding } from "./native.ts"
import { loadNative } from "./native.ts"

/** Diagnostics as the engine reports them (KRN-CMP-011). */
export type Diagnostic = {
  code: string
  name: string
  severity: "info" | "warning" | "error"
  file: string
  span: { start: number; end: number }
  message: string
  help: string[]
}

/** Parses the engine's JSON. */
export function parseDiagnostics(json: string): Diagnostic[] {
  return JSON.parse(json) as Diagnostic[]
}

/**
 * The last source asked about, as UTF-8, with the byte offset each of its lines starts at. A caller
 * places a module's diagnostics one after another, and walking the source to each one cost 7.8 s
 * for 1,567 warnings in a 6.6 MB module (KF-075).
 */
let indexed: { source: string; bytes: Buffer; starts: number[] } | undefined

function lineIndex(source: string): { bytes: Buffer; starts: number[] } {
  if (indexed?.source !== source) {
    const bytes = Buffer.from(source)
    const starts = [0]
    for (let at = bytes.indexOf(10); at !== -1; at = bytes.indexOf(10, at + 1))
      starts.push(at + 1)
    indexed = { source, bytes, starts }
  }
  return indexed
}

/** `line:column` of an engine offset, which counts UTF-8 bytes. */
export function position(source: string, offset: number): string {
  const { bytes, starts } = lineIndex(source)
  // The last line that starts at or before the offset.
  let low = 0
  let high = starts.length - 1
  while (low < high) {
    const middle = (low + high + 1) >> 1
    if (starts[middle]! <= offset) low = middle
    else high = middle - 1
  }
  const column = bytes.subarray(starts[low], offset).toString().length
  return `${low + 1}:${column + 1}`
}

/**
 * Diagnostics as the command line prints them (D-116), one report each: Oxc's graphical report, the
 * one oxlint prints, with the span underlined among the lines around it in a frame headed
 * `file:line:column`, then the help. `sourceOf` gives the text of a file a diagnostic names; the
 * engine reads each file once for all of its reports, as a module with thousands of warnings needs
 * (KF-075). `colour` adds ANSI colours, for a terminal that shows them: a host's warnings and errors
 * go without, since an overlay or a log shows them as written. A report has no blank line before
 * it and no line break after it.
 */
export function formatDiagnostics(
  diagnostics: readonly Diagnostic[],
  sourceOf: (file: string) => string | undefined = () => undefined,
  options: { colour?: boolean; native?: NativeBinding } = {}
): string[] {
  if (diagnostics.length === 0) return []
  const sources: Record<string, string> = {}
  const asked = new Set<string>()
  for (const { file } of diagnostics) {
    if (!file || asked.has(file)) continue
    asked.add(file)
    const text = sourceOf(file)
    if (text !== undefined) sources[file] = text
  }
  return (options.native ?? loadNative())
    .renderDiagnostics(
      JSON.stringify(diagnostics),
      sources,
      options.colour ?? false
    )
    .map((report) => report.slice(1, -1))
}

/** One diagnostic, as {@link formatDiagnostics} renders it; `source` is the text of its file. */
export function formatDiagnostic(
  diagnostic: Diagnostic,
  source?: string
): string {
  return formatDiagnostics([diagnostic], () => source)[0]!
}
