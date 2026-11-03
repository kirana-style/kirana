/**
 * Builds the native engine (`kirana.<platform>.node`) with `napi build`.
 *
 *   bun scripts/build-native.ts            # release, what `bun run build` and the `engine` task use
 *   bun scripts/build-native.ts --debug    # debug, faster to compile
 *   bun scripts/build-native.ts --target aarch64-pc-windows-msvc   # CI: any other napi flag passes through
 *
 * Rust is found even when the terminal never read `~/.cargo/env` (see `scripts/rust.ts`). Without
 * Rust it stops with the install steps instead of napi's "cargo metadata failed to run".
 */
import { spawnSync } from "node:child_process"
import path from "node:path"

import { rustEnvironment } from "../../../scripts/rust.ts"

const args = [
  "build",
  "--platform",
  ...(process.argv.includes("--debug") ? [] : ["--release"]),
  "--manifest-path",
  "../../crates/kirana_napi/Cargo.toml",
  "--package-json-path",
  "package.json",
  "--output-dir",
  ".",
  "--no-js",
  "--dts",
  "native.generated.d.ts",
  ...process.argv.slice(2).filter((arg) => arg !== "--debug"),
]
const env = rustEnvironment()

// The engine allocates with mimalloc (D-123). On Linux it would commit each arena whole as it
// reserves it, and an editor's session would then hold 7 to 10 MB more than with the system's
// allocator even after `releaseMemory()`: arenas are committed on demand instead. The define reaches
// mimalloc's C through `cc-rs`, by the target's own variable, which neither napi's cross toolchain
// nor cargo-zigbuild sets. A build for the WASI engine compiles no C.
const at = process.argv.findIndex((arg) => arg === "--target" || arg === "-t")
const target =
  (at >= 0
    ? process.argv[at + 1]
    : process.argv
        .find((arg) => arg.startsWith("--target="))
        ?.slice("--target=".length)) ?? hostTriple()
if (target.includes("-linux-")) {
  const name = `CFLAGS_${target.replaceAll("-", "_")}`
  env[name] = [env[name], "-DMI_DEFAULT_ARENA_EAGER_COMMIT=0"]
    .filter(Boolean)
    .join(" ")
}

const result = spawnSync("napi", args, {
  stdio: "inherit",
  cwd: path.join(import.meta.dirname, ".."),
  env,
  shell: process.platform === "win32",
})
process.exit(result.status ?? 1)

/** The triple Rust builds for when no `--target` is given. */
function hostTriple(): string {
  const { stdout } = spawnSync("rustc", ["-vV"], { env, encoding: "utf8" })
  return /^host: (\S+)$/m.exec(stdout)?.[1] ?? ""
}
