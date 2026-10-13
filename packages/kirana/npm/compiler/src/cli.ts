/**
 * The `kirana` command: `init`, `doctor` and `dev` run here, in Node.js, because they read and
 * write the project around the compiler; everything else loads configuration and runs the native
 * command line, or the language server for `kirana lsp`.
 */
import { spawnSync } from "node:child_process"
import { createInterface } from "node:readline/promises"
import type { Readable, Writable } from "node:stream"

import { resolveConfig } from "./config.ts"
import { runDev } from "./dev.ts"
import { runDoctor } from "./doctor.ts"
import type { Io } from "./init.ts"
import { runInit } from "./init.ts"
import type { NativeBinding } from "./native.ts"
import { loadNative } from "./native.ts"
import { runReport } from "./report.ts"

/** A terminal's questions and commands for `kirana init`. */
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
  const binding = native ?? loadNative()
  const { json } = await resolveConfig(cwd)
  // The language server owns stdin and stdout until the editor shuts it down (KRN-DX-001).
  if (command === "lsp") return binding.runLsp(json)
  const [code, output] = binding.runCli([
    "kirana",
    "--config-json",
    json,
    ...argv,
  ])
  write(output)
  return code
}
