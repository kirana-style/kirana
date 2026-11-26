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

/**
 * Whether diagnostics written to `stream` get colours, as the engine's binary decides it:
 * `FORCE_COLOR` turns them on unless it is `0` or `false`, else a non-empty `NO_COLOR` turns them
 * off, else a terminal gets them.
 */
export function colourOf(
  stream: { isTTY?: boolean },
  env: NodeJS.ProcessEnv = process.env
): boolean {
  if (env.FORCE_COLOR !== undefined)
    return env.FORCE_COLOR !== "0" && env.FORCE_COLOR !== "false"
  if (env.NO_COLOR) return false
  return stream.isTTY === true
}

/**
 * The help of each command this package runs in Node.js rather than in the engine. Its first line
 * is the line the engine's `--help` lists the command with, which lists all of them.
 */
export const NODE_HELP = {
  init: `Set a project up: the configuration, the bundler plugin, the stylesheet and the \`sx\` types

Usage: kirana-style init [OPTIONS]

Detects the framework, bundler and package manager, shows each change as a diff and writes the
changes once you confirm. A configuration it cannot edit safely gets the step printed instead.

Options:
  -y, --yes      Write without asking
      --dry-run  Show the changes and write nothing
      --install  Also run the install command for the packages it adds
      --preset   Also set up the scales preset (@kirana-style/preset-scales)
  -h, --help     Print help
`,
  dev: `Watch files and rewrite the stylesheet when they change, for a project without a bundler plugin

Usage: kirana-style dev [PATHS]... [OPTIONS]

Arguments:
  [PATHS]...  Directories to watch: src, else the project root, when none are given

Options:
      --out <FILE>  Where to write the stylesheet [default: kirana.css]
      --minify      Write minified CSS
  -h, --help        Print help
`,
  ui: `Install components from a registry and keep them up to date, with @kirana-style/registry

Usage: kirana-style ui <COMMAND>

The commands come from @kirana-style/registry, which this project does not have: add it as a
development dependency, or start a new project with
npx @kirana-style/registry init --template <example> <directory>. Then kirana-style ui --help
lists its commands, and kirana-style ui <COMMAND> --help prints one command's help.
`,
  doctor: `Say what the project's Kirana setup is and what is missing; \`--report\` writes a bug report

Usage: kirana-style doctor [OPTIONS]

Reports the engine, the installed @kirana-style packages, the configuration, the framework,
bundler and package manager, and whether the plugin, stylesheet and \`sx\` types are set up.
Exits with 1 when something fails.

Options:
      --json                         Print the checks as JSON
      --report [FILE]                Write a bug report to paste into an issue instead, to
                                     kirana-report.md unless a file follows; with --json, print it
      --trace <FILE:LINE> <PROPERTY> With --report, add the trace of one property
  -h, --help                         Print help
`,
} as const

/** Whether `argv` asks a command for its help. */
function asksHelp(argv: readonly string[]): boolean {
  return argv.some((arg) => arg === "--help" || arg === "-h")
}

/**
 * Runs `kirana-style` with `argv`, writing its output through `write`; returns the exit code.
 * `colour` adds ANSI colours to diagnostics, for a terminal that shows them: the binary passes
 * whether its standard output does, asked of the descriptor (`isatty(1)`), never of
 * `process.stdout`.
 */
export async function main(
  argv: readonly string[],
  cwd: string,
  write: (text: string) => void,
  native?: NativeBinding,
  io?: Omit<Io, "write">,
  colour = false
): Promise<number> {
  const [command, ...rest] = argv
  // `help <command>` and `--help` for a command run here. `ui`'s commands are the registry
  // package's, which prints their help when the project has it.
  const asked = command === "help" ? rest[0] : command
  if (command === "help" && asked === "ui")
    return runUi(["--help"], cwd, write, undefined, NODE_HELP.ui)
  if (
    asked !== undefined &&
    asked !== "ui" &&
    Object.hasOwn(NODE_HELP, asked) &&
    (command === "help" || asksHelp(rest))
  ) {
    write(NODE_HELP[asked as keyof typeof NODE_HELP])
    return 0
  }
  // These work before a configuration exists, or to find out why one does not load. Only `init`
  // touches `process.stdin`: once Node.js opens it, the language server can no longer read fd 0.
  // Nothing on the way to `lsp` may touch `process.stdout` either: Node.js makes the pipe
  // non-blocking, and the server's writer gives up on a full one, cutting a reply short.
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
    return (await runDev(rest, cwd, write, { native, colour })).code
  // The component registry's commands, from their own package (D-103).
  if (command === "ui") return runUi(rest, cwd, write, undefined, NODE_HELP.ui)
  const binding = native ?? loadNative()
  // The engine's help, and its own commands', need no configuration: one that does not load must
  // not hide them. `help <command>` is `<command> --help`.
  if (command === "help")
    return emit(
      write,
      binding.runCli(["kirana-style", ...rest, "--help"], colour)
    )
  if (command === undefined || asksHelp(argv))
    return emit(write, binding.runCli(["kirana-style", ...argv], colour))
  try {
    // The language server owns stdin and stdout until the editor shuts it down (KRN-DX-001).
    if (command === "lsp")
      return binding.runLsp((await resolveConfig(cwd)).json)
    return await runGrouped(argv, cwd, write, binding, colour)
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
  binding: NativeBinding,
  colour: boolean
): Promise<number> {
  const [command = "", ...rest] = argv
  const forced = valueOf(rest, "--config")
  const args = withoutOption(rest, "--config")
  const run = (json: string, commandArgs: readonly string[]) =>
    binding.runCli(
      ["kirana-style", "--config-json", json, command, ...commandArgs],
      colour
    )
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
