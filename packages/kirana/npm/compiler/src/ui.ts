/**
 * `kirana-style ui …` (KRN-DX-020, D-103): the component registry's commands. They live in
 * `@kirana-style/registry`, which a project installs to use them, so the compiler every project
 * installs carries no registry client. The package is resolved from the project, as its other tools
 * are, and runs with the arguments after `ui`.
 */
import { createRequire } from "node:module"
import path from "node:path"
import { pathToFileURL } from "node:url"

import { importFile } from "./config.ts"
import type { ImportFile } from "./config.ts"

/** The package that provides `kirana-style ui`. */
export const REGISTRY = "@kirana-style/registry"

/** What the package exports for the command: the same contract as this package's `main`. */
export type RegistryCommand = {
  main: (
    argv: readonly string[],
    cwd: string,
    write: (text: string) => void
  ) => Promise<number>
}

/**
 * Runs `kirana-style ui <argv…>` in `cwd`: the project's `@kirana-style/registry` gets the arguments
 * and returns the exit code. Exit 1, with the reason, when the project does not have the package,
 * when it fails to load (the 0.0.0 placeholder throws on purpose), or when it exports no `main`.
 */
export async function runUi(
  argv: readonly string[],
  cwd: string,
  write: (text: string) => void,
  load: ImportFile = importFile
): Promise<number> {
  let file: string
  try {
    file = createRequire(path.join(cwd, "package.json")).resolve(REGISTRY)
  } catch {
    write(
      `kirana-style ui needs ${REGISTRY}, which this project does not have: add it as a development dependency\n`
    )
    return 1
  }
  let registry: Partial<RegistryCommand>
  try {
    registry = (await load(
      pathToFileURL(file).href
    )) as Partial<RegistryCommand>
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    write(`loading ${REGISTRY}: ${reason.split("\n")[0]}\n`)
    return 1
  }
  if (typeof registry.main !== "function") {
    write(
      `${REGISTRY} (${file}) exports no main(): kirana-style ui needs a version released with Kirana\n`
    )
    return 1
  }
  return registry.main(argv, cwd, write)
}
