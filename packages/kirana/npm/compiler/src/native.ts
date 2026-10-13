/**
 * Loads the native engine for the current platform (D-029). Per-platform packages arrive at
 * release; in the workspace the addon sits next to this package as `kirana.<triple>.node`.
 */
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"

import type * as Native from "../native.generated.d.ts"

export type NativeBinding = typeof Native

/** The napi-rs platform triple for a platform, architecture and C library. */
export function platformTriple(
  platform: string,
  arch: string,
  musl: boolean
): string {
  if (platform === "win32") return `win32-${arch}-msvc`
  if (platform === "linux") return `linux-${arch}-${musl ? "musl" : "gnu"}`
  return `${platform}-${arch}`
}

/** Whether this Node.js process runs on musl libc. */
export function isMusl(
  report: { header?: { glibcVersionRuntime?: string } } | undefined
): boolean {
  return !report?.header?.glibcVersionRuntime
}

/** Which build of the engine a binding is: the Node-API addon, or the WASI build (KRN-INT-006). */
export type Engine = "native" | "wasi"

export function engineOf(binding: NativeBinding): Engine {
  return (binding as { __napiBindingTarget?: string }).__napiBindingTarget ===
    "wasm32-wasi"
    ? "wasi"
    : "native"
}

/** Whether `error` says `id` itself is not installed (not that something it requires is missing). */
const missing = (error: unknown, id: string) =>
  (error as { code?: string }).code === "MODULE_NOT_FOUND" &&
  String((error as Error).message).includes(id)

/**
 * Loads the engine (D-029, D-050, KRN-INT-006).
 *
 * In order: `KIRANA_NATIVE_PATH` (instrumented test builds); the installed platform package the
 * package manager picked from `optionalDependencies`; the workspace build beside this package; then
 * the WASI build — `@kirana-style/compiler-wasm32-wasi`, or the workspace's `kirana.wasi.cjs`. A native
 * addon that is installed but fails to load falls back to WASI with a warning, because the build
 * still works, only slower; with no WASI build either, its own error surfaces rather than "not
 * found". `KIRANA_FORCE_WASI=1` skips the native addon.
 */
export function loadNative(
  env: NodeJS.ProcessEnv = process.env,
  load: (id: string) => unknown = createRequire(import.meta.url),
  warn: (message: string) => void = console.warn
): NativeBinding {
  const musl =
    process.platform === "linux" &&
    isMusl(
      process.report?.getReport() as {
        header?: { glibcVersionRuntime?: string }
      }
    )
  const triple = platformTriple(process.platform, process.arch, musl)
  if (env.KIRANA_NATIVE_PATH)
    return load(env.KIRANA_NATIVE_PATH) as NativeBinding
  let failure: unknown
  const attempt = (id: string) => {
    try {
      return load(id) as NativeBinding
    } catch (error) {
      if (!missing(error, id)) failure ??= error
      return undefined
    }
  }
  if (!env.KIRANA_FORCE_WASI) {
    const native =
      attempt(`@kirana-style/compiler-${triple}`) ??
      (failure === undefined
        ? attempt(
            fileURLToPath(new URL(`../kirana.${triple}.node`, import.meta.url))
          )
        : undefined)
    if (native) return native
  }
  const nativeFailure = failure
  const wasi =
    attempt("@kirana-style/compiler-wasm32-wasi") ??
    attempt(fileURLToPath(new URL("../kirana.wasi.cjs", import.meta.url)))
  if (wasi) {
    if (nativeFailure !== undefined) {
      warn(
        `Kirana: the native engine for ${triple} did not load (${(nativeFailure as Error).message}); using the WASI engine, which is slower`
      )
    }
    return wasi
  }
  throw (
    failure ??
    new Error(
      `Kirana has no engine for ${triple}: install @kirana-style/compiler-${triple}, or @kirana-style/compiler-wasm32-wasi to run anywhere`
    )
  )
}
