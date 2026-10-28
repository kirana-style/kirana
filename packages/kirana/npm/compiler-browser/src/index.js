/**
 * The Kirana engine in a browser (D-113). Importing this module fetches the WebAssembly engine
 * beside it and starts its threads, so the page must be cross-origin isolated (COOP `same-origin`,
 * COEP `require-corp`): the engine's memory is a `SharedArrayBuffer`.
 *
 * Hand-written JavaScript: the engine it imports is the loader napi-rs writes for browsers, with an
 * in-memory file system (`napi.wasm.browser.fs`), and exists only once the WebAssembly build has
 * run. `scripts/pack.ts` bundles it, its worker and its runtime into this package.
 */
import * as engine from "@kirana-style/compiler-wasm32-wasi"

import { openProject } from "./project.ts"

export { positionOf } from "./project.ts"
export { engineJson as configJson } from "@kirana-style/compiler/engine-json"

/** Opens a project in the engine's in-memory file system. */
export function createProject(options) {
  return openProject(engine, options)
}
