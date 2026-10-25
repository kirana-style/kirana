/**
 * What the commands share: their options, the settings errors that stop one with exit 2, and how a
 * document that could not be read is named.
 */
import type { Io } from "./read.ts"
import type { ImportFile } from "./settings.ts"

/** Everything `main` needs from outside: tests replace the network, the environment and the loader. */
export type Options = Io & { load?: ImportFile }

/** A document that could not be read, and what failed: `--json` prints these. */
export type Failure = { document: string; message: string }

/** A command's arguments: its flags, the values of the options that take one, and the rest. */
export type Parsed = {
  flags: Set<string>
  values: Map<string, string[]>
  rest: string[]
}

/**
 * Reads `args` for one command: `flags` take no value, `valued` take the next argument. An option it
 * does not know, or one without its value, is the message to print, for exit 2.
 */
export function parseArgs(
  command: string,
  args: readonly string[],
  flags: readonly string[],
  valued: readonly string[] = []
): Parsed | string {
  const parsed: Parsed = { flags: new Set(), values: new Map(), rest: [] }
  for (let index = 0; index < args.length; index++) {
    const arg = args[index]!
    if (!arg.startsWith("--")) parsed.rest.push(arg)
    else if (flags.includes(arg)) parsed.flags.add(arg)
    else if (valued.includes(arg)) {
      const value = args[++index]
      if (value === undefined || value.startsWith("--"))
        return `kirana-style ui ${command}: ${arg} needs a value`
      parsed.values.set(arg, [...(parsed.values.get(arg) ?? []), value])
    } else return `kirana-style ui ${command}: unknown option ${arg}`
  }
  return parsed
}

/** Whether this error is about the project's settings, which no other document would fix: exit 2. */
export function isSettingsError(error: unknown): boolean {
  const name = (error as Error).name
  return name === "SettingsError" || name === "ConfigLoadError"
}

/** A failure's line: the document, then what failed, unless the message names the document already. */
export function failureLine({ document, message }: Failure): string {
  return message.startsWith(document)
    ? `${message}\n`
    : `${document}: ${message}\n`
}
