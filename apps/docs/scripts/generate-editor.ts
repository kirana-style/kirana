/**
 * Asks the real language server what an editor shows for one file, and writes the answers.
 *
 * The homepage's editor scene and the editor guide draw a component as VS Code shows it with
 * Kirana's extension: the summary after each element, the code lens, the style card, the Style
 * Inspector, a token's colours, a diagnostic with its fix, Style Fold. None of that is drawn by
 * hand. This script opens `showcase/editor/plan.tsx` in `kirana-style lsp`, the same server an editor
 * starts, and records what it answers: the hints and lenses as data, the card and the token hover
 * as the HTML the hover's Markdown renders to, and the Inspector as the extension's own renderer
 * (`editors/vscode/src/inspector/render.ts`) draws it from `kirana/inspect`.
 *
 * Needs the native engine (`vp run engine`); the output is committed, so `dev` does not.
 */
import { spawn } from "node:child_process"
import { readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { pathToFileURL } from "node:url"

import { highlightSource } from "@workspace/docs-core/highlight.ts"

import { render } from "../../../packages/kirana/editors/vscode/src/inspector/render.ts"
import type { Inspected } from "../../../packages/kirana/editors/vscode/src/inspector/render.ts"

const root = new URL("..", import.meta.url).pathname
const sample = join(root, "showcase/editor/plan.tsx")
const out = join(root, "src/generated/editor.gen.ts")
const check = process.argv.includes("--check")
const server = join(root, "../../packages/kirana/npm/cli/bin/kirana-style.ts")

/** The line the Lint scene adds to the style object: a length without a unit. */
const LINT_LINE = "  width: 5,"

/** A minimal LSP client over the server's stdin and stdout. */
function connect() {
  const child = spawn("bun", [server, "lsp"], {
    cwd: root,
    stdio: ["pipe", "pipe", "inherit"],
  })
  let buffer = Buffer.alloc(0)
  let id = 0
  const waiting = new Map<number, (message: Message) => void>()
  const diagnostics = new Map<string, Diagnostic[]>()
  type Message = {
    id?: number
    method?: string
    params?: { uri: string; diagnostics: Diagnostic[] }
    result?: unknown
    error?: { message: string }
  }
  child.stdout.on("data", (chunk: Buffer) => {
    buffer = Buffer.concat([buffer, chunk])
    for (;;) {
      const head = buffer.indexOf("\r\n\r\n")
      if (head < 0) return
      const length = Number(
        /Content-Length: (\d+)/i.exec(buffer.subarray(0, head).toString())![1]
      )
      if (buffer.length < head + 4 + length) return
      const message = JSON.parse(
        buffer.subarray(head + 4, head + 4 + length).toString()
      ) as Message
      buffer = buffer.subarray(head + 4 + length)
      if (message.id !== undefined && waiting.has(message.id)) {
        waiting.get(message.id)!(message)
        waiting.delete(message.id)
      } else if (message.method === "textDocument/publishDiagnostics") {
        diagnostics.set(message.params!.uri, message.params!.diagnostics)
      }
    }
  })
  const send = (message: object) => {
    const text = JSON.stringify({ jsonrpc: "2.0", ...message })
    child.stdin.write(
      `Content-Length: ${Buffer.byteLength(text)}\r\n\r\n${text}`
    )
  }
  const request = <T>(method: string, params: object) =>
    new Promise<T>((resolve, reject) => {
      const n = ++id
      waiting.set(n, (message) =>
        message.error
          ? reject(new Error(`${method}: ${message.error.message}`))
          : resolve(message.result as T)
      )
      send({ id: n, method, params })
    })
  const notify = (method: string, params: object) => send({ method, params })
  return { child, request, notify, diagnostics }
}

type Position = { line: number; character: number }
type Diagnostic = {
  range: { start: Position; end: Position }
  message: string
  code?: string | number
  source?: string
  data?: unknown
}

/** Polls until `found` returns something, or gives up after 30 s. */
async function until<T>(what: string, found: () => T | undefined): Promise<T> {
  const deadline = Date.now() + 30_000
  for (;;) {
    const value = found()
    if (value !== undefined) return value
    if (Date.now() > deadline) throw new Error(`the server never sent ${what}`)
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
}

/** The position of `needle` in `text`, at `offset` characters into it. */
function at(text: string, needle: string, offset = 0): Position {
  const index = text.indexOf(needle)
  if (index < 0) throw new Error(`the sample has no ${JSON.stringify(needle)}`)
  const before = text.slice(0, index + offset).split("\n")
  return { line: before.length - 1, character: before.at(-1)!.length }
}

const escape = (text: string) =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")

/**
 * The hover's Markdown as HTML, the way VS Code renders the subset the server writes: images
 * (the icon, the box model, swatches), bold, inline code, links, tables, a fenced CSS block and
 * paragraphs. Links keep their text and lose their targets, which point into this machine.
 */
function markdown(source: string): string {
  const inline = (text: string): string =>
    escape(text)
      .replace(
        /!\[([^\]]*)\]\((data:[^)]+)\)/g,
        (_, alt, data) => `<img alt="${alt}" src="${data}">`
      )
      .replace(/\[([^\]]+)\]\([^)]+\)/g, (_, label) => `<a>${label}</a>`)
      .replace(/`([^`]+)`/g, (_, code) => `<code>${code}</code>`)
      .replace(/\*\*([^*]+)\*\*/g, (_, bold) => `<strong>${bold}</strong>`)
  const blocks: string[] = []
  const lines = source.split("\n")
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim() || "plaintext"
      const code: string[] = []
      while (!lines[++i]!.startsWith("```")) code.push(lines[i]!)
      blocks.push(
        `<pre><code>${highlightSource(code.join("\n"), lang)}</code></pre>`
      )
    } else if (line.startsWith("|")) {
      const rows: string[][] = []
      for (; i < lines.length && lines[i]!.startsWith("|"); i++) {
        rows.push(
          lines[i]!.slice(1, -1)
            .split("|")
            .map((cell) => cell.trim())
        )
      }
      i--
      const [headers, , ...body] = rows
      blocks.push(
        `<table><thead><tr>${headers!.map((cell) => `<th>${inline(cell)}</th>`).join("")}</tr></thead><tbody>${body
          .map(
            (row) =>
              `<tr>${row.map((cell) => `<td>${inline(cell)}</td>`).join("")}</tr>`
          )
          .join("")}</tbody></table>`
      )
    } else if (line === "---") {
      blocks.push("<hr>")
    } else if (line.trim()) {
      blocks.push(`<p>${inline(line)}</p>`)
    }
  }
  return blocks.join("\n")
}

const sourceText = await readFile(sample, "utf8")
const uri = pathToFileURL(sample).href
const lsp = connect()
await lsp.request("initialize", {
  processId: null,
  rootUri: pathToFileURL(root).href,
  capabilities: {},
  // What VS Code's extension sends: hovers may hold images, the scheme is dark.
  initializationOptions: { images: true, commandLinks: true, theme: "dark" },
})
lsp.notify("initialized", {})
lsp.notify("textDocument/didOpen", {
  textDocument: {
    uri,
    languageId: "typescriptreact",
    version: 1,
    text: sourceText,
  },
})
// The file is compiled once it is open: its (empty) diagnostics are the sign.
await until("the sample's diagnostics", () => lsp.diagnostics.get(uri))
const document = { textDocument: { uri } }
const lines = sourceText.trimEnd().split("\n")

type Hint = {
  position: Position
  data: { mark: string; parts: { text: string; group: string }[] }
}
const hints = (
  await lsp.request<Hint[]>("textDocument/inlayHint", {
    ...document,
    range: {
      start: { line: 0, character: 0 },
      end: { line: lines.length, character: 0 },
    },
  })
).map((hint) => ({
  line: hint.position.line,
  mark: hint.data.mark,
  parts: hint.data.parts.map(({ text, group }) => ({ text, group })),
}))

type Lens = { range: { start: Position }; command: { title: string } }
const lensList = await lsp.request<Lens[]>("textDocument/codeLens", document)
const lenses = [...new Set(lensList.map((lens) => lens.range.start.line))].map(
  (line) => ({
    line,
    titles: lensList
      .filter((lens) => lens.range.start.line === line)
      .map((lens) => lens.command.title),
  })
)

type Hover = { contents: { value: string } }
const hover = async (position: Position) =>
  markdown(
    (await lsp.request<Hover>("textDocument/hover", { ...document, position }))
      .contents.value
  )
const card = await hover(at(sourceText, "sx={card}", 5))
const token = await hover(at(sourceText, "color.brand", 7))

// The Inspector on the article with its breakpoint switched on, as a click on the chip asks for it.
const inspect = (active: string[]) =>
  lsp.request<Inspected>("kirana/inspect", {
    ...document,
    position: at(sourceText, "sx={card}", 5),
    active,
  })
const breakpoint = (await inspect([])).conditions.find((condition) =>
  condition.includes("48rem")
)
if (!breakpoint)
  throw new Error("the Inspector offers no breakpoint to switch on")
const inspector = render(
  await inspect([breakpoint]),
  new Set([breakpoint]),
  "dark"
)

type StyleRange = { range: { start: Position; end: Position }; summary: string }
const ranges = await lsp.request<StyleRange[]>("kirana/styleRanges", document)
// Style Fold folds one-line objects: here, `title`.
const titleLine = at(sourceText, "const title").line
const folded = ranges.find((range) => range.range.start.line === titleLine)
const titleText = lines[titleLine]!
const fold = folded && {
  line: titleLine,
  // The line around the object, which Style Fold hides and labels `{ summary }`.
  before: highlightSource(
    titleText.slice(0, folded.range.start.character),
    "tsx"
  ),
  after: highlightSource(titleText.slice(folded.range.end.character), "tsx"),
  summary: folded.summary,
}

// The Lint scene: the same file with a unitless width, and the fix the server offers.
const lintText = sourceText.replace(
  /^ {2}borderColor: color\.brand,$/m,
  (line) => `${line}\n${LINT_LINE}`
)
lsp.notify("textDocument/didChange", {
  textDocument: { uri, version: 2 },
  contentChanges: [{ text: lintText }],
})
const problem = await until("a diagnostic for `width: 5`", () =>
  (lsp.diagnostics.get(uri) ?? []).find((diagnostic) =>
    diagnostic.message.includes("width")
  )
)
type Action = { title: string; kind?: string }
const fixes = (
  await lsp.request<Action[]>("textDocument/codeAction", {
    ...document,
    range: problem.range,
    context: { diagnostics: [problem] },
  })
)
  .filter((action) => action.kind === "quickfix")
  .map((action) => action.title)
lsp.child.kill()

const editor = {
  file: "plan.tsx",
  lines: highlightSource(sourceText.trimEnd(), "tsx").split("\n"),
  lintLine: {
    line: problem.range.start.line,
    html: highlightSource(LINT_LINE, "tsx"),
  },
  hints,
  lenses,
  // Where each hover opens: the position the pointer rests on.
  anchors: {
    card: at(sourceText, "sx={card}", 5),
    token: at(sourceText, "color.brand", 7),
  },
  card,
  token,
  inspector,
  fold: fold ?? null,
  problem: {
    line: problem.range.start.line,
    message: problem.message,
    code: String(problem.code ?? ""),
    source: problem.source ?? "kirana",
    fixes,
  },
}

/**
 * What the server answers names files on this machine (the Inspector's links, a hover's
 * "From" link). The page needs none of it: links keep their text, and a local path that is
 * still there stops the script rather than reaching the repository.
 */
const json = JSON.stringify(editor, null, 2).replace(
  / href=\\"#\\" data-open=\\"[^"]*?\\"/g,
  ""
)
for (const local of [root, "file://"]) {
  if (json.includes(local)) throw new Error(`the output names ${local}`)
}

const generated = `/**
 * @generated by scripts/generate-editor.ts from what \`kirana-style lsp\` answers for
 * showcase/editor/plan.tsx. Do not edit; run \`bun run generate:editor\`.
 */
export const EDITOR_SAMPLE = ${json} as const
`

if (check) {
  const current = await readFile(out, "utf8").catch(() => "")
  if (current !== generated) {
    console.error(
      "editor: src/generated/editor.gen.ts is stale; run `bun run generate:editor`"
    )
    process.exit(1)
  }
  console.log("editor: up to date")
} else {
  await writeFile(out, generated)
  console.log(
    `editor: ${hints.length} hints, ${lenses.length} lenses, card, token, inspector, fold, ${fixes.length} fixes`
  )
}
