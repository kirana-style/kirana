/**
 * Second pass of the StyleX migration prototype: `{...styleProps(a, b)}` (or an unaliased
 * `{...props(a, b)}`) on a JSX element becomes `sx={[a, b]}`, and the helper is dropped from the
 * Kirana import when nothing else uses it. The third pass turns `sx` on external components back.
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs"
import path from "node:path"
import { parseSync } from "oxc-parser"

type Node = { type: string; start: number; end: number; [key: string]: unknown }

function walk(node: unknown, visit: (node: Node) => void) {
  if (!node || typeof node !== "object") return
  if (Array.isArray(node)) return node.forEach((item) => walk(item, visit))
  const current = node as Node
  if (typeof current.type === "string") visit(current)
  for (const [key, value] of Object.entries(current))
    if (key !== "parent") walk(value, visit)
}

function pass(file: string, source: string): string {
  const { program } = parseSync(file, source)
  const edits: { start: number; end: number; text: string }[] = []
  walk(program, (node) => {
    if (node.type !== "JSXSpreadAttribute") return
    const call = node.argument as Node
    const callee = (call.callee as { name?: string } | undefined)?.name
    if (
      call.type !== "CallExpression" ||
      (callee !== "props" && callee !== "styleProps")
    )
      return
    const args = (call.arguments as Node[])
      .map((arg) => source.slice(arg.start, arg.end))
      .join(", ")
    edits.push({ start: node.start, end: node.end, text: `sx={[${args}]}` })
  })
  if (!edits.length) return source
  let out = source
  for (const edit of edits.sort((a, b) => b.start - a.start)) {
    out = out.slice(0, edit.start) + edit.text + out.slice(edit.end)
  }
  const body = out.replace(/import \{[^}]*\} from "@kirana-style\/core"/, "")
  for (const [helper, specifier] of [
    ["props", "props"],
    ["styleProps", "props as styleProps"],
  ]) {
    if (new RegExp(`(?<![\\w.])${helper}\\(`).test(body)) continue
    out = out.replace(
      /import \{([^}]*)\} from "@kirana-style\/core"/,
      (_, names: string) => {
        const kept = names
          .split(",")
          .map((name) => name.trim())
          .filter((name) => name && name !== specifier)
        return kept.length
          ? `import { ${kept.join(", ")} } from "@kirana-style/core"`
          : ""
      }
    )
  }
  return out
}

/** The source files under a directory, or the file itself when given one. */
function files(directory: string): string[] {
  if (!statSync(directory).isDirectory()) return [directory]
  return readdirSync(directory).flatMap((name) => {
    const full = path.join(directory, name)
    if (name === "node_modules") return []
    return statSync(full).isDirectory()
      ? files(full)
      : name.endsWith(".tsx")
        ? [full]
        : []
  })
}

let changed = 0
for (const directory of process.argv.slice(2)) {
  for (const file of files(directory)) {
    const source = readFileSync(file, "utf8")
    const next = pass(file, source)
    if (next !== source) {
      writeFileSync(file, next)
      changed++
    }
  }
}
console.log(`${changed} files rewritten`)
