/**
 * Runs a shell command with Rust on PATH, so every Kirana script works from a terminal that never
 * read `~/.cargo/env` (a non-login shell, an editor task, a Vite+ `bun` shim).
 *
 *   bun scripts/rust.ts "cargo fmt --all --check && cargo nextest run --workspace"
 *
 * cargo is looked up on PATH, then in `$CARGO_HOME/bin`, then in `~/.cargo/bin`. When it is missing,
 * or a cargo subcommand named in the command or in the script file it runs is (`cargo nextest`,
 * `cargo deny`, `cargo llvm-cov`), it stops with the install command instead of "command not found".
 */
import { spawnSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { homedir } from "node:os"
import path from "node:path"

const extension = process.platform === "win32" ? ".exe" : ""

/** The process environment with the directory holding cargo first on PATH; exits when Rust is missing. */
export function rustEnvironment(command = ""): NodeJS.ProcessEnv {
  const directories = [
    ...(process.env.PATH ?? "").split(path.delimiter),
    process.env.CARGO_HOME && path.join(process.env.CARGO_HOME, "bin"),
    path.join(homedir(), ".cargo", "bin"),
  ].filter((directory): directory is string => Boolean(directory))
  const has = (tool: string) =>
    directories.some((directory) =>
      existsSync(path.join(directory, tool + extension))
    )
  const cargo = directories.find((directory) =>
    existsSync(path.join(directory, `cargo${extension}`))
  )

  if (!cargo) {
    console.error(`Kirana needs Rust, and cargo was not found on PATH or in ~/.cargo/bin.

  Install it once:  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
  Then either open a new terminal, or run:  . "$HOME/.cargo/env"

The toolchain version is pinned in packages/kirana/rust-toolchain.toml; rustup installs it on first use.`)
    process.exit(1)
  }

  const [program = ""] = command.split(" ")
  const text = existsSync(program) ? readFileSync(program, "utf8") : command
  const missing = ["nextest", "deny", "llvm-cov"].filter(
    (tool) => text.includes(`cargo ${tool}`) && !has(`cargo-${tool}`)
  )
  if (missing.length > 0) {
    const crates = missing.map((tool) => `cargo-${tool}`).join(" ")
    console.error(`This command needs ${crates}. Install once with:

  cargo install --locked ${crates}`)
    process.exit(1)
  }

  return {
    ...process.env,
    PATH: [cargo, process.env.PATH].filter(Boolean).join(path.delimiter),
  }
}

if (import.meta.main) {
  const command = process.argv.slice(2).join(" ")
  const result = spawnSync(command, {
    stdio: "inherit",
    shell: true,
    env: rustEnvironment(command),
  })
  process.exit(result.status ?? 1)
}
