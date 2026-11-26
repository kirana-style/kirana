/**
 * The names a finished bundle keeps its definitions under (D-086, D-094). Nothing here reads a file
 * or imports a Node.js module: the bundler adapters (through `./host`) and the browser engine's
 * production output (`@kirana-style/compiler-browser`, KF-145) both read a bundle's names with it.
 */

/**
 * The variable tokens (`--{prefix}v` and four characters), keyframes (`{prefix}f` and four),
 * position-try fallbacks (`--{prefix}p`) and counter styles (`{prefix}c`) a text names: what a
 * finished bundle's chunks and stylesheets still use, so its stylesheet keeps them (D-086, D-094)
 * under the names they use (D-084).
 */
export function definitionNames(text: string, prefix: string): string[] {
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return [
    ...new Set(
      text.match(
        new RegExp(
          `(?:--${escaped}[vp]|(?<![0-9A-Za-z_-])${escaped}[fc])[0-9A-Za-z]{4}(?![0-9A-Za-z_-])`,
          "g"
        )
      ) ?? []
    ),
  ]
}
