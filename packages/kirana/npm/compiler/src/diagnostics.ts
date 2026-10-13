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

/** `line:column` of an engine offset, which counts UTF-8 bytes. */
export function position(source: string, offset: number): string {
  const lines = Buffer.from(source).subarray(0, offset).toString().split("\n")
  return `${lines.length}:${lines.at(-1)!.length + 1}`
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
