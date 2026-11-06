/**
 * `kirana-style ui mcp` (KRN-DX-035): the project's registries for an AI assistant, as a Model
 * Context Protocol server over stdio. Each line on stdin is a JSON-RPC 2.0 message, each answer one
 * line on stdout; nothing else is written there. It answers `initialize`, `ping`, `tools/list` and
 * `tools/call`, with no dependency: the tools list the project's registries, search them, view an
 * item, read its files and give the `ui add` command that installs items. It reads; it installs
 * nothing. Settings are read again for every call, so a changed `kirana.config` is seen.
 */
import { runCommand } from "@kirana-style/compiler"

import { failureLine, parseArgs } from "./command.ts"
import type { Options } from "./command.ts"
import { frameworkOf, readProject } from "./project.ts"
import { RegistryError, registryOf } from "./read.ts"
import { REFERENCE_PATTERN } from "./schema.ts"
import { searchRegistries } from "./search.ts"
import { loadSettings } from "./settings.ts"
import type { Settings } from "./settings.ts"
import type { Framework, RegistryFile } from "./types.ts"
import { version } from "./version.ts"
import { describe, readItem } from "./view.ts"

/** The protocol's revisions this server speaks, newest first. */
export const PROTOCOL_VERSIONS = [
  "2025-11-25",
  "2025-06-18",
  "2025-03-26",
  "2024-11-05",
]

type Json = null | boolean | number | string | Json[] | { [key: string]: Json }

/** A tool's description, as `tools/list` gives it. */
type Tool = {
  name: string
  title: string
  description: string
  inputSchema: {
    type: "object"
    properties: Record<string, Json>
    required?: string[]
  }
}

const STRINGS = { type: "array", items: { type: "string" } } as const

export const TOOLS: Tool[] = [
  {
    name: "list_registries",
    title: "List registries",
    description:
      "The registries this project installs from (each namespace and its URL template), and the project's framework, base and icon library.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "search_items",
    title: "Search items",
    description:
      "Items whose name, title or description holds every word of the query, from every registry or those named; an empty query lists every item.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Words to look for." },
        registries: {
          ...STRINGS,
          description:
            "Namespaces to search (@kirana, @acme); every registry when left out.",
        },
      },
    },
  },
  {
    name: "view_items",
    title: "View items",
    description:
      "What each item is and what installing it brings: its version, the items and packages it needs, and where each file installs, per framework and base.",
    inputSchema: {
      type: "object",
      properties: {
        items: {
          ...STRINGS,
          description: "References: @namespace/name, or a name for @kirana's.",
        },
      },
      required: ["items"],
    },
  },
  {
    name: "get_item_files",
    title: "Get an item's files",
    description:
      "An item's files with their content, as its registry publishes them: its styles and shared files, and those of the framework and base asked for (by default the project's framework, every base). Installing writes them with the project's aliases and icon library.",
    inputSchema: {
      type: "object",
      properties: {
        item: {
          type: "string",
          description: "A reference: @namespace/name, or a name for @kirana's.",
        },
        framework: {
          type: "string",
          description: "react, vue, svelte, solid or angular.",
        },
        base: {
          type: "string",
          description: "A base of that framework: base, aria, ark, ng.",
        },
      },
      required: ["item"],
    },
  },
  {
    name: "get_add_command",
    title: "Get the add command",
    description:
      "The command that installs items into this project with its package manager; run it to install them.",
    inputSchema: {
      type: "object",
      properties: {
        items: { ...STRINGS, description: "References to install." },
      },
      required: ["items"],
    },
  },
]

const INSTRUCTIONS =
  "Kirana UI's registries for this project. Search for items, view them and read their files; to install, run the command get_add_command gives in the project's directory."

/** A tool's answer: its text, and whether it is an error the assistant should see. */
type Answer = { text: string; isError?: true }

class ArgumentError extends Error {}

/** A string argument, or `undefined` when it is optional and left out. */
function stringArgument(
  values: Record<string, unknown>,
  name: string,
  required: boolean
): string | undefined {
  const value = values[name]
  if (value === undefined && !required) return undefined
  if (typeof value !== "string" || value === "")
    throw new ArgumentError(`${name} is a string`)
  return value
}

/** A list of strings, or `undefined` when it is optional and left out. */
function stringsArgument(
  values: Record<string, unknown>,
  name: string,
  required: boolean
): string[] | undefined {
  const value = values[name]
  if (value === undefined && !required) return undefined
  if (
    !Array.isArray(value) ||
    (required && value.length === 0) ||
    value.some((entry) => typeof entry !== "string")
  )
    throw new ArgumentError(
      `${name} is a list of strings${required ? ", not empty" : ""}`
    )
  return value as string[]
}

const json = (value: unknown) => JSON.stringify(value, null, 2)

/** Where an item's file installs, as `view` names it. */
const placeOf = (file: RegistryFile) =>
  file.type === "file" ? file.target! : `${file.type}/${file.path}`

/** The project's framework: its settings', else the one its `package.json` lists. */
const projectFramework = (settings: Settings): Framework | undefined =>
  settings.framework ?? frameworkOf(readProject(settings.root))

/** A tool's work: the answer, or the error that stops it. */
export async function callTool(
  name: string,
  values: Record<string, unknown>,
  cwd: string,
  options: Options
): Promise<Answer> {
  const settings = await loadSettings(cwd, options.load)
  switch (name) {
    case "list_registries":
      return {
        text: json({
          root: settings.root,
          framework: projectFramework(settings) ?? null,
          base: settings.base ?? null,
          iconLibrary: settings.iconLibrary,
          // Headers stay out: they may carry a token.
          registries: [...settings.registries.values()].map((registry) => ({
            namespace: registry.namespace,
            url: registry.template,
          })),
        }),
      }
    case "search_items": {
      const query = stringArgument(values, "query", false) ?? ""
      const namespaces = stringsArgument(values, "registries", false) ?? [
        ...settings.registries.keys(),
      ]
      for (const namespace of namespaces) registryOf(namespace, settings)
      const words = query.toLowerCase().split(/\s+/).filter(Boolean)
      const { results, failures } = await searchRegistries(
        namespaces,
        words,
        settings,
        options
      )
      return {
        text: json({
          results,
          failures,
        }),
        ...(results.length === 0 && failures.length > 0
          ? { isError: true }
          : {}),
      }
    }
    case "view_items": {
      const references = stringsArgument(values, "items", true)!
      const outcomes = await Promise.allSettled(
        references.map((reference) => readItem(reference, settings, options))
      )
      const texts: string[] = []
      const failures: string[] = []
      outcomes.forEach((outcome, index) => {
        const reference = references[index]!
        if (outcome.status === "fulfilled")
          texts.push(describe(reference, outcome.value.url, outcome.value.item))
        else
          failures.push(
            failureLine({
              document: reference,
              message: (outcome.reason as Error).message,
            })
          )
      })
      return {
        text: [...texts, failures.join("")].filter(Boolean).join("\n"),
        ...(texts.length === 0 ? { isError: true } : {}),
      }
    }
    case "get_item_files": {
      const reference = stringArgument(values, "item", true)!
      const asked = stringArgument(values, "framework", false)
      const base = stringArgument(values, "base", false)
      const { item } = await readItem(reference, settings, options)
      const framework = (asked ?? projectFramework(settings)) as
        | Framework
        | undefined
      const groups: [string, RegistryFile[]][] = [
        ["styles", item.styles ?? []],
        ["files", item.files ?? []],
      ]
      const frameworks = Object.entries(item.frameworks ?? {}).filter(
        ([key]) => framework === undefined || key === framework
      )
      if (framework !== undefined && frameworks.length === 0 && item.frameworks)
        throw new RegistryError(
          `${reference} has no ${framework} markup: it has ${Object.keys(item.frameworks).join(", ")}`
        )
      for (const [key, bases] of frameworks) {
        if (base !== undefined && !(base in bases))
          throw new RegistryError(
            `${reference} has no ${key} base ${base}: it has ${Object.keys(bases).join(", ")}`
          )
        for (const [own, entry] of Object.entries(bases))
          if (base === undefined || own === base)
            groups.push([`${key}/${own}`, entry.files])
      }
      return {
        text: json({
          name: item.name,
          version: item.version,
          files: groups.flatMap(([group, files]) =>
            files.map((file) => ({
              group,
              installsAt: placeOf(file),
              content: file.content,
            }))
          ),
        }),
      }
    }
    case "get_add_command": {
      const references = stringsArgument(values, "items", true)!
      const wrong = references.filter(
        (reference) => !REFERENCE_PATTERN.test(reference)
      )
      if (wrong.length > 0)
        throw new ArgumentError(
          `${wrong.join(", ")}: not an item (@namespace/name, or a name for @kirana's)`
        )
      return {
        text: runCommand(
          readProject(settings.root).manager,
          `kirana-style ui add ${references.join(" ")}`
        ),
      }
    }
  }
  throw new ArgumentError(
    `no tool ${name}: ${TOOLS.map((tool) => tool.name).join(", ")}`
  )
}

type Message = {
  jsonrpc?: unknown
  id?: unknown
  method?: unknown
  params?: unknown
}

const PARSE_ERROR = -32700
const INVALID_REQUEST = -32600
const METHOD_NOT_FOUND = -32601
const INVALID_PARAMS = -32602

const reply = (id: Json, result: Json) => ({ jsonrpc: "2.0", id, result })
const failure = (id: Json, code: number, message: string) => ({
  jsonrpc: "2.0",
  id,
  error: { code, message },
})

/** A JSON-RPC message's answer, or `undefined` for a notification, which has none. */
export async function handle(
  message: unknown,
  cwd: string,
  options: Options
): Promise<Json | undefined> {
  const { jsonrpc, id, method, params } = (message ?? {}) as Message
  const valid =
    typeof message === "object" &&
    !Array.isArray(message) &&
    jsonrpc === "2.0" &&
    typeof method === "string" &&
    (id === undefined || typeof id === "string" || typeof id === "number")
  if (!valid) {
    const known = typeof id === "string" || typeof id === "number" ? id : null
    return failure(known, INVALID_REQUEST, "not a JSON-RPC 2.0 request")
  }
  // A notification (`notifications/initialized`, `notifications/cancelled` …) is not answered.
  if (id === undefined) return undefined
  const values = (params ?? {}) as Record<string, unknown>
  switch (method) {
    case "initialize": {
      const asked = values.protocolVersion
      return reply(id, {
        protocolVersion: PROTOCOL_VERSIONS.includes(asked as string)
          ? (asked as string)
          : PROTOCOL_VERSIONS[0]!,
        capabilities: { tools: {} },
        serverInfo: {
          name: "kirana-style-ui",
          title: "Kirana UI",
          version: await version(),
        },
        instructions: INSTRUCTIONS,
      })
    }
    case "ping":
      return reply(id, {})
    case "tools/list":
      return reply(id, { tools: TOOLS as unknown as Json })
    case "tools/call": {
      const { name, arguments: given } = values as {
        name?: unknown
        arguments?: unknown
      }
      if (typeof name !== "string" || !TOOLS.some((tool) => tool.name === name))
        return failure(id, INVALID_PARAMS, `no tool ${String(name)}`)
      if (
        given !== undefined &&
        (typeof given !== "object" || given === null || Array.isArray(given))
      )
        return failure(id, INVALID_PARAMS, "arguments is an object")
      let answer: Answer
      try {
        answer = await callTool(
          name,
          (given ?? {}) as Record<string, unknown>,
          cwd,
          options
        )
      } catch (error) {
        // The assistant reads what went wrong and can try again.
        answer = { text: (error as Error).message, isError: true }
      }
      return reply(id, {
        content: [{ type: "text", text: answer.text }],
        ...(answer.isError ? { isError: true } : {}),
      })
    }
  }
  return failure(id, METHOD_NOT_FOUND, `no method ${method}`)
}

/**
 * `kirana-style ui mcp`: answers each line of `input` (stdin) until it ends, then 0; 2 when given
 * an argument. Answers are written as they are ready, so a slow registry holds up no other call.
 */
export async function runMcp(
  args: readonly string[],
  cwd: string,
  write: (text: string) => void,
  options: Options,
  input: AsyncIterable<string | Uint8Array> = process.stdin
): Promise<number> {
  const parsed = parseArgs("mcp", args, [])
  if (typeof parsed === "string" || parsed.rest.length > 0) {
    write(
      `${typeof parsed === "string" ? parsed : "kirana-style ui mcp takes no arguments"}\n`
    )
    return 2
  }
  const pending: Promise<void>[] = []
  const answer = (line: string) => {
    if (line.trim() === "") return
    let message: unknown
    try {
      message = JSON.parse(line)
    } catch {
      write(`${JSON.stringify(failure(null, PARSE_ERROR, "not JSON"))}\n`)
      return
    }
    pending.push(
      handle(message, cwd, options).then((result) => {
        if (result !== undefined) write(`${JSON.stringify(result)}\n`)
      })
    )
  }
  const decoder = new TextDecoder()
  let buffered = ""
  for await (const chunk of input) {
    buffered +=
      typeof chunk === "string"
        ? chunk
        : decoder.decode(chunk, { stream: true })
    const lines = buffered.split("\n")
    buffered = lines.pop()!
    for (const line of lines) answer(line)
  }
  answer(buffered + decoder.decode())
  await Promise.all(pending)
  return 0
}
