/**
 * Third pass of the StyleX migration prototype: an `sx` attribute on a component imported from an
 * external package (Base UI, cmdk, react-day-picker…) becomes `{...styleProps(…)}`, because such
 * components never read `sx`. Kirana reports the pattern as `sx-on-external-component`.
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

const external = (source: string) =>
  !source.startsWith(".") &&
  !source.startsWith("@workspace/") &&
  !source.startsWith("@/")

function pass(file: string, source: string): string {
  const { program } = parseSync(file, source)
  const externals = new Set<string>()
  walk(program, (node) => {
    if (
      node.type !== "ImportDeclaration" ||
      !external((node.source as { value: string }).value)
    )
      return
    for (const specifier of node.specifiers as Node[])
      externals.add((specifier.local as { name: string }).name)
  })
  const edits: { start: number; end: number; text: string }[] = []
  walk(program, (node) => {
    if (node.type !== "JSXOpeningElement") return
    let name = node.name as Node
    while (name.type === "JSXMemberExpression") name = name.object as Node
    if (
      name.type !== "JSXIdentifier" ||
      !externals.has((name as unknown as { name: string }).name)
    )
      return
    for (const attribute of node.attributes as Node[]) {
      if (
        attribute.type !== "JSXAttribute" ||
        (attribute.name as { name: string }).name !== "sx"
      )
        continue
      const container = attribute.value as Node
      const expression = container.expression as Node
      const args =
        expression.type === "ArrayExpression"
          ? (expression.elements as Node[])
              .map((element) => source.slice(element.start, element.end))
              .join(", ")
          : source.slice(expression.start, expression.end)
      edits.push({
        start: attribute.start,
        end: attribute.end,
        text: `{...styleProps(${args})}`,
      })
    }
  })
  if (!edits.length) return source
  let out = source
  for (const edit of edits.sort((a, b) => b.start - a.start))
    out = out.slice(0, edit.start) + edit.text + out.slice(edit.end)
  if (!/props as styleProps/.test(out)) {
    if (/import \{[^}]*\} from "@kirana-style\/core"/.test(out)) {
      out = out.replace(
        /import \{([^}]*)\} from "@kirana-style\/core"/,
        (_, names: string) =>
          `import { ${[
            ...names
              .split(",")
              .map((n) => n.trim())
              .filter(Boolean),
            "props as styleProps",
          ].join(", ")} } from "@kirana-style/core"`
      )
    } else {
      out = `import { props as styleProps } from "@kirana-style/core"\n` + out
    }
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
