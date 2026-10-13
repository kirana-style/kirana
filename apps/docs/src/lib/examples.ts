/** What `scripts/generate-examples.ts` records for each example. Hand-written, so typecheck needs no engine. */
export type CompiledExample = {
  /** File name under `src/examples`, without the extension. */
  readonly name: string
  /** The file, exactly as it is on disk and as the app compiles it. */
  readonly source: string
  /** `source`, highlighted at build time. */
  readonly sourceHtml: string
  /** What the compiler emitted for this file, and nothing else. */
  readonly css: string
  readonly cssHtml: string
  /** Every class the emitted CSS defines. */
  readonly classNames: readonly string[]
  readonly diagnostics: readonly {
    readonly code: string
    readonly name: string
    readonly severity: string
    readonly message: string
    readonly line: number
  }[]
}

/** A homepage snippet from `showcase/`: highlighted, and compiled when it is TSX. */
export type ShowcaseSnippet = {
  readonly name: string
  readonly lang: string
  readonly source: string
  readonly html: string
  /** What the compiler reported for it; the broken snippet shows these. */
  readonly diagnostics: readonly {
    readonly code: string
    readonly name: string
    readonly message: string
    readonly help: readonly string[]
  }[]
}
