import { EXAMPLES } from "@/generated/examples.gen"
import type { CompiledExample } from "@/lib/examples"

/**
 * Where compiled results come from. The one engine is the curated examples, compiled by the real
 * compiler when the site was built. Arbitrary source needs the WASM engine (M4) or a server route;
 * either becomes another engine behind this interface, and the playground does not change.
 */
export type CompileEngine = {
  readonly id: "curated" | "server" | "wasm"
  /** Whether the source pane accepts edits. False for the curated engine. */
  readonly editable: boolean
  readonly compile: (input: {
    name?: string
    source?: string
  }) => Promise<CompiledExample>
}

export class UnsupportedSource extends Error {
  constructor() {
    super("this engine compiles curated examples only")
  }
}

export const curated: CompileEngine = {
  id: "curated",
  editable: false,
  async compile({ name, source }) {
    if (source !== undefined) throw new UnsupportedSource()
    const example = name ? EXAMPLES[name] : undefined
    if (!example)
      throw new Error(`no example named ${JSON.stringify(name ?? "")}`)
    return example
  },
}

export const engine: CompileEngine = curated
export const examples = Object.values(EXAMPLES)
