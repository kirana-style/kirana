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
import { createRequire } from "node:module"
import { homedir } from "node:os"
import path from "node:path"

import { GLIBC_FLOOR, glibcGaps, staticTls } from "../../../scripts/glibc.ts"
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

// `--use-napi-cross` links the engine against napi-rs's glibc 2.17 toolchain. Its C compiler reaches
// cc-rs only through `TARGET_CC`, which cc-rs reads when the target is not the host, and both Linux
// gnu engines build on a runner of their own architecture; the toolchain's gcc (4.8) is too old for
// mimalloc anyway. So mimalloc's C was compiled by the runner's gcc against the runner's glibc: on
// Ubuntu 26.04, whose gcc writes C23, `strtol` became `__isoc23_strtol`, which glibc defines from
// 2.38, and 0.4.0 did not load on Debian 12, Ubuntu 22.04, RHEL 9 or Amazon Linux 2023 (KF-104). The
// runner's gcc now reads the toolchain's glibc headers, through the target's own flags, so no symbol
// newer than 2.17 can come from them.
const cross =
  target.endsWith("-linux-gnu") && process.argv.includes("--use-napi-cross")
if (cross) {
  const here = createRequire(import.meta.url)
  const napi = createRequire(here.resolve("@napi-rs/cli/package.json"))
  const { version } = napi("@napi-rs/cross-toolchain/package.json") as {
    version: string
  }
  // Where napi unpacks the toolchain, before cargo runs.
  const sysroot = path.join(
    homedir(),
    ".napi-rs",
    "cross-toolchain",
    version,
    target,
    target,
    "sysroot"
  )
  const name = `CFLAGS_${target.replaceAll("-", "_")}`
  env[name] = [`--sysroot=${sysroot}`, env[name]].filter(Boolean).join(" ")
}

const result = spawnSync("napi", args, {
  stdio: "inherit",
  cwd: path.join(import.meta.dirname, ".."),
  env,
  shell: process.platform === "win32",
})
if (result.status === 0 && target.includes("-linux-")) {
  const triple = `linux-${target.startsWith("aarch64") ? "arm64" : "x64"}-${target.endsWith("-musl") ? "musl" : "gnu"}`
  const engine = path.join(import.meta.dirname, "..", `kirana.${triple}.node`)
  // A Linux engine is loaded with `dlopen`, so its thread-locals must not need static TLS: one that
  // does fails to load beside a second Kirana version (KF-118). `readelf` comes with the linker
  // every Linux build already uses.
  const dynamic = spawnSync("readelf", ["-d", engine], { encoding: "utf8" })
  if (dynamic.status !== 0 || staticTls(dynamic.stdout)) {
    console.error(
      dynamic.status === 0
        ? `kirana.${triple}.node is marked STATIC_TLS: something in it reads a thread-local with the initial-exec model (KF-118)`
        : `readelf -d ${engine} failed`
    )
    process.exit(1)
  }
  // A symbol the toolchain's glibc lacks still links and fails only when the engine loads: the
  // build fails instead (KF-104).
  if (cross) {
    const dump = spawnSync("objdump", ["-T", engine], { encoding: "utf8" })
    const gaps =
      dump.status === 0
        ? glibcGaps(dump.stdout)
        : [`objdump -T ${engine} failed`]
    if (gaps.length) {
      console.error(
        `kirana.${triple}.node needs what glibc ${GLIBC_FLOOR} does not provide:\n  ${gaps.join("\n  ")}`
      )
      process.exit(1)
    }
  }
}
process.exit(result.status ?? 1)

/** The triple Rust builds for when no `--target` is given. */
function hostTriple(): string {
  const { stdout } = spawnSync("rustc", ["-vV"], { env, encoding: "utf8" })
  return /^host: (\S+)$/m.exec(stdout)?.[1] ?? ""
}
