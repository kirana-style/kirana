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
 * The last source asked about, as UTF-8, with the byte offset each of its lines starts at. A host
 * formats a module's diagnostics one after another, and walking the source to each one cost 7.8 s
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
 * One line per diagnostic plus help lines, for host warnings and errors. With the module's source
 * the location is `file:line:column`; project-wide diagnostics without a span name the file only.
 */
export function formatDiagnostic(
  diagnostic: Diagnostic,
  source?: string
): string {
  const spanned = diagnostic.span.start > 0 || diagnostic.span.end > 0
  const at =
    source !== undefined && spanned
      ? `:${position(source, diagnostic.span.start)}`
      : ""
  const location = diagnostic.file ? ` (${diagnostic.file}${at})` : ""
  const help = diagnostic.help.map((line) => `\n  help: ${line}`).join("")
  return `${diagnostic.severity}[${diagnostic.code}] ${diagnostic.name}: ${diagnostic.message}${location}${help}`
}
