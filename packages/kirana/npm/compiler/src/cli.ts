/**
 * The `kirana-style` command (its binary lives in the `kirana-style` package). `init`, `doctor` and
 * `dev` run here in Node.js because they read and write the project around the compiler; `ui` hands
 * its arguments to the project's `@kirana-style/registry`; everything else loads configuration and
 * runs the native command line, or the language server for `kirana-style lsp`.
 */
import { spawnSync } from "node:child_process"
import { statSync } from "node:fs"
import path from "node:path"
import { createInterface } from "node:readline/promises"
import type { Readable, Writable } from "node:stream"

import {
  ConfigLoadError,
  findConfigAbove,
  resolveConfig,
  resolveConfigFile,
} from "./config.ts"
import { runDev } from "./dev.ts"
import { runDoctor } from "./doctor.ts"
import type { Io } from "./init.ts"
import { runInit } from "./init.ts"
import type { NativeBinding } from "./native.ts"
import { loadNative } from "./native.ts"
import { runReport } from "./report.ts"
import { runUi } from "./ui.ts"

/** A terminal's questions and commands for `kirana-style init`. */
export function terminal(
  input: Readable & { isTTY?: boolean },
  output: Writable,
  write: (text: string) => void
): Omit<Io, "write"> {
  return {
    async ask(question) {
      if (!input.isTTY) {
        write(
          `${question}\nnot a terminal: pass --yes to write without asking\n`
        )
        return false
      }
      const prompt = createInterface({ input, output })
      const answer = await prompt.question(question)
      prompt.close()
      return /^y(es)?$/i.test(answer.trim())
    },
    run(command) {
      const result = spawnSync(command, { shell: true, stdio: "inherit" })
      return result.status ?? 1
    },
  }
}

export async function main(
  argv: readonly string[],
  cwd: string,
  write: (text: string) => void,
  native?: NativeBinding,
  io?: Omit<Io, "write">
): Promise<number> {
  const [command, ...rest] = argv
  // These work before a configuration exists, or to find out why one does not load. Only `init`
  // touches `process.stdin`: once Node.js opens it, the language server can no longer read fd 0.
  if (command === "init")
    return runInit(rest, cwd, {
      ...(io ?? terminal(process.stdin, process.stdout, write)),
      write,
    })
  if (command === "doctor")
    return (rest.includes("--report") ? runReport : runDoctor)(
      rest,
      cwd,
      write,
      native && (() => native)
    )
  if (command === "dev")
    return (await runDev(rest, cwd, write, { native })).code
  // The component registry's commands, from their own package (D-103).
  if (command === "ui") return runUi(rest, cwd, write)
  const binding = native ?? loadNative()
  try {
    // The language server owns stdin and stdout until the editor shuts it down (KRN-DX-001).
    if (command === "lsp")
      return binding.runLsp((await resolveConfig(cwd)).json)
    return await runGrouped(argv, cwd, write, binding)
  } catch (error) {
    if (!(error instanceof ConfigLoadError)) throw error
    write(`${error.message}\n`)
    return 2
  }
}

/** Options of the native commands that take a value, so that the value is not taken for a path. */
const VALUED = new Set([
  "--format",
  "--max-warnings",
  "--out",
  "--report",
  "--html",
])

/** The commands whose paths each read their own configuration (KF-003). */
const PER_PATH = new Set(["check", "trace", "export"])

/**
 * Runs a native command. `check`, `trace` and `export` read, for each path, the nearest
 * `kirana.config.*` above it, as TypeScript finds a `tsconfig.json`, so a command at a workspace
 * root reads each app's own; paths with no configuration above them read the working directory's.
 * `--config <file>` makes every path read that file. Paths that share a configuration run together;
 * when that is not the working directory's, or there are several, the human output names which
 * configuration each group read.
 */
async function runGrouped(
  argv: readonly string[],
  cwd: string,
  write: (text: string) => void,
  binding: NativeBinding
): Promise<number> {
  const [command = "", ...rest] = argv
  const forced = valueOf(rest, "--config")
  const args = withoutOption(rest, "--config")
  const run = (json: string, commandArgs: readonly string[]) =>
    binding.runCli([
      "kirana-style",
      "--config-json",
      json,
      command,
      ...commandArgs,
    ])
  const paths = PER_PATH.has(command) ? pathsOf(command, args) : []
  const every = withPaths(args, paths, [...paths.keys()], cwd)
  if (forced !== undefined) {
    const { json } = await resolveConfigFile(path.resolve(cwd, forced))
    return emit(write, run(json, every))
  }
  const own = await resolveConfig(cwd)
  if (paths.length === 0) return emit(write, run(own.json, args))
  // Each path's configuration file, or undefined for the working directory's.
  const groups = new Map<string | undefined, number[]>()
  for (const [index, entry] of paths.entries()) {
    const target = path.resolve(cwd, entry.file)
    const directory = isDirectory(target) ? target : path.dirname(target)
    const found = findConfigAbove(directory)
    const key = found === undefined || found === own.file ? undefined : found
    groups.set(key, [...(groups.get(key) ?? []), index])
  }
  if (groups.size === 1 && groups.has(undefined))
    return emit(write, run(own.json, every))
  if (command === "export" && groups.size > 1) {
    write(
      `kirana-style export reads one configuration, and these paths read ${groups.size}: ${[
        ...groups.keys(),
      ]
        .map((file) => path.relative(cwd, file ?? own.file ?? cwd) || ".")
        .join(", ")}; pass --config <file>\n`
    )
    return 2
  }
  const asJson = /--format(=|\s+)json/.test(args.join(" "))
  const answers: unknown[] = []
  let code = 0
  for (const [file, indices] of groups) {
    const { json: config } =
      file === undefined ? own : await resolveConfigFile(file)
    const [status, output] = run(config, withPaths(args, paths, indices, cwd))
    code = Math.max(code, status)
    if (asJson && groups.size > 1) {
      answers.push(...(JSON.parse(output) as unknown[]))
      continue
    }
    if (!asJson) {
      const shown = indices.map((index) => paths[index]!.file).join(", ")
      const source = file ?? own.file
      write(
        `${source === undefined ? "no kirana.config" : path.relative(cwd, source)}: ${shown}\n`
      )
    }
    write(output)
  }
  if (asJson && groups.size > 1) write(`${JSON.stringify(answers, null, 2)}\n`)
  return code
}

function emit(
  write: (text: string) => void,
  [code, output]: [number, string]
): number {
  write(output)
  return code
}

/** A path argument: where it is among the arguments, and the file or directory it names. */
type PathArgument = { at: number; file: string }

/**
 * The paths among a command's arguments: every positional of `check` and `export`, and the
 * `file` of each `file:line property` pair of `trace`.
 */
function pathsOf(command: string, args: readonly string[]): PathArgument[] {
  const positional: PathArgument[] = []
  for (let at = 0; at < args.length; at++) {
    const arg = args[at]!
    if (VALUED.has(arg)) at++
    else if (!arg.startsWith("-")) positional.push({ at, file: arg })
  }
  if (command !== "trace") return positional
  return positional
    .filter((_, index) => index % 2 === 0)
    .map(({ at, file }) => ({ at, file: file.replace(/:\d+$/, "") }))
}

/**
 * `args` with only the paths at `keep` (a `trace` pair keeps its property), each written from the
 * process's directory, which the engine resolves them against: the same text when that is `cwd`.
 */
function withPaths(
  args: readonly string[],
  paths: readonly PathArgument[],
  keep: readonly number[],
  cwd: string
): string[] {
  const out = [...args]
  const dropped = new Set<number>()
  for (const [index, { at, file }] of paths.entries()) {
    if (keep.includes(index)) {
      // `join` writes the directory itself as `.`, where `relative` gives "".
      const written = path.join(
        path.relative(process.cwd(), path.resolve(cwd, file))
      )
      out[at] = written + args[at]!.slice(file.length)
      continue
    }
    dropped.add(at)
    // A trace location's property follows it.
    if (args[at] !== file) dropped.add(at + 1)
  }
  return out.filter((_, at) => !dropped.has(at))
}

function valueOf(args: readonly string[], option: string): string | undefined {
  const at = args.indexOf(option)
  if (at !== -1) return args[at + 1]
  return args
    .find((arg) => arg.startsWith(`${option}=`))
    ?.slice(option.length + 1)
}

function withoutOption(args: readonly string[], option: string): string[] {
  const at = args.indexOf(option)
  if (at !== -1) return [...args.slice(0, at), ...args.slice(at + 2)]
  return args.filter((arg) => !arg.startsWith(`${option}=`))
}

function isDirectory(file: string): boolean {
  try {
    return statSync(file).isDirectory()
  } catch {
    return false
  }
}
