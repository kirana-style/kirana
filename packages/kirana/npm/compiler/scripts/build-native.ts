/**
 * Builds the native engine (`kirana.<platform>.node`) with `napi build`.
 *
 *   bun scripts/build-native.ts            # release, what `bun run build` and Turbo use
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
const result = spawnSync("napi", args, {
  stdio: "inherit",
  cwd: path.join(import.meta.dirname, ".."),
  env: rustEnvironment(),
  shell: process.platform === "win32",
})
process.exit(result.status ?? 1)
