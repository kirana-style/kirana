/**
 * Prototype of `kirana migrate stylex` (KRN-API-013), used to port this repository's StyleX
 * packages. It rewrites the mechanical parts and prints a report of what it could not decide;
 * the report items are the codemod's "never guess" list. Productizing it (in Rust, with fixtures)
 * is carried to a later milestone.
 *
 *   bun scripts/migrate-stylex.ts <directory or file>...
 */
import {
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs"
import path from "node:path"
import { parseSync } from "oxc-parser"

type Node = { type: string; start: number; end: number; [key: string]: unknown }
type Edit = { start: number; end: number; text: string }

const report: string[] = []

function walk(
  node: unknown,
  visit: (node: Node, parent: Node | undefined) => void,
  parent?: Node
) {
  if (!node || typeof node !== "object") return
  if (Array.isArray(node)) {
    for (const item of node) walk(item, visit, parent)
    return
  }
  const current = node as Node
  if (typeof current.type === "string") visit(current, parent)
  for (const [key, value] of Object.entries(current)) {
    if (key !== "parent" && value && typeof value === "object")
      walk(value, visit, current)
  }
}

const isMember = (node: unknown, object: string, property: string) => {
  const n = node as Node
  return (
    n?.type === "MemberExpression" &&
    (n.object as Node).type === "Identifier" &&
    (n.object as { name: string }).name === object &&
    (n.property as { name?: string }).name === property
  )
}

const whenMember = (node: unknown): string | undefined => {
  const n = node as Node
  if (n?.type !== "MemberExpression") return undefined
  if (!isMember(n.object, "stylex", "when")) return undefined
  return (n.property as { name: string }).name
}

function migrate(file: string, source: string): string {
  const { program, errors } = parseSync(file, source)
  if (errors.length) {
    report.push(`${file}: parse errors, skipped`)
    return source
  }
  const edits: Edit[] = []
  const used = new Set<string>()
  const text = (node: Node) => source.slice(node.start, node.end)
  const exportNames = new Map<number, string>()
  // `stylex.props` calls already rewritten as part of a spread, so the call itself is left alone.
  const spreadCalls = new Set<number>()

  walk(program, (node) => {
    if (
      node.type === "VariableDeclarator" &&
      (node.id as Node).type === "Identifier" &&
      node.init
    ) {
      exportNames.set(
        (node.init as Node).start,
        (node.id as { name: string }).name
      )
    }
  })

  walk(program, (node, parent) => {
    if (
      node.type === "ImportDeclaration" &&
      (node.source as { value: string }).value === "@stylexjs/stylex"
    ) {
      edits.push({
        start: node.start,
        end: node.end,
        text: "/*__KIRANA_IMPORT__*/",
      })
      return
    }
    if (
      node.type === "TSQualifiedName" &&
      (node.left as { name?: string }).name === "stylex"
    ) {
      const name = (node.right as { name: string }).name
      if (
        [
          "StyleXStyles",
          "CompiledStyles",
          "StyleXArray",
          "StaticStyles",
        ].includes(name)
      ) {
        let end = node.end
        if (parent?.type === "TSTypeReference" && parent.typeArguments)
          end = (parent.typeArguments as Node).end
        edits.push({ start: node.start, end, text: "Sx" })
        used.add("type Sx")
      }
      return
    }
    if (node.type === "JSXSpreadAttribute") {
      const argument = node.argument as Node
      if (
        argument.type === "CallExpression" &&
        isMember(argument.callee, "stylex", "props")
      ) {
        const args = (argument.arguments as Node[])
          .map((arg) => {
            // A StyleX marker is applied by spreading it; a Kirana relation applies its anchor.
            if (arg.type === "Identifier" && text(arg).endsWith("Marker"))
              return `${text(arg)}.anchor`
            if (
              arg.type === "CallExpression" &&
              isMember(arg.callee, "stylex", "defaultMarker")
            ) {
              used.add("peer")
              return "peer.anchor"
            }
            return text(arg)
          })
          .join(", ")
        edits.push({ start: node.start, end: node.end, text: `sx={[${args}]}` })
        spreadCalls.add(argument.start)
      }
      return
    }
    if (node.type !== "CallExpression") return
    const callee = node.callee as Node
    const args = node.arguments as Node[]
    const exportName = exportNames.get(node.start) ?? "unnamed"
    if (isMember(callee, "stylex", "create")) {
      const object = args[0]!
      edits.push({ start: node.start, end: object.start, text: "" })
      edits.push({ start: object.end, end: node.end, text: "" })
      used.add("css")
      for (const property of object.properties as Node[]) {
        if (property.type !== "Property") continue
        const value = property.value as Node
        if (value.type === "ObjectExpression") {
          edits.push({ start: value.start, end: value.start, text: "css(" })
          edits.push({ start: value.end, end: value.end, text: ")" })
        } else if (value.type === "ArrowFunctionExpression") {
          const body = value.body as Node
          let start = body.start
          while (
            start > value.start &&
            source[start - 1] !== "(" &&
            /\s/.test(source[start - 1]!)
          )
            start--
          if (source[start - 1] === "(") start--
          edits.push({ start, end: start, text: "css" })
        } else {
          report.push(
            `${file}:${property.start}: stylex.create entry is not an object`
          )
        }
        walk(value, (inner) => {
          if (
            inner.type === "Property" &&
            (inner.key as { name?: string }).name === "default" &&
            !inner.computed
          ) {
            const entry = inner.value as Node & { value?: unknown }
            if (entry.type === "Literal" && entry.value === null) {
              // StyleX's `default: null` only says "nothing at rest". Kirana's `base: null` is a
              // merge instruction that removes an earlier handle's value, so the entry is dropped.
              let start = inner.start
              let end = inner.end
              while (/\s/.test(source[end] ?? "")) end++
              if (source[end] === ",") {
                end++
                const lineStart = source.lastIndexOf("\n", start - 1)
                if (/^\s*$/.test(source.slice(lineStart + 1, start))) {
                  // On a line of its own: remove the whole line.
                  start = lineStart
                  while (/[ \t]/.test(source[end] ?? "")) end++
                } else {
                  while (/\s/.test(source[end] ?? "")) end++
                }
              } else {
                // The last entry: take the separator before it instead.
                while (/[\s,]/.test(source[start - 1] ?? "")) start--
                end = inner.end
              }
              edits.push({ start, end, text: "" })
              return
            }
            const key = inner.key as Node
            edits.push({ start: key.start, end: key.end, text: "base" })
          }
        })
      }
      return
    }
    if (isMember(callee, "stylex", "props")) {
      if (spreadCalls.has(node.start)) return
      // Aliased: components routinely name their rest parameter `props`.
      edits.push({ start: callee.start, end: callee.end, text: "styleProps" })
      used.add("props as styleProps")
      return
    }
    if (isMember(callee, "stylex", "defineVars")) {
      edits.push({ start: callee.start, end: callee.end, text: "defineTokens" })
      edits.push({
        start: args[0]!.start,
        end: args[0]!.start,
        text: `${JSON.stringify(exportName)}, `,
      })
      edits.push({
        start: args[0]!.end,
        end: args[0]!.end,
        text: ", { variable: true }",
      })
      used.add("defineTokens")
      return
    }
    if (isMember(callee, "stylex", "defineConsts")) {
      edits.push({ start: node.start, end: args[0]!.start, text: "" })
      edits.push({ start: args[0]!.end, end: node.end, text: " as const" })
      return
    }
    if (isMember(callee, "stylex", "defineMarker")) {
      edits.push({
        start: node.start,
        end: node.end,
        text: `relation(${JSON.stringify(exportName.replace(/Marker$/, ""))})`,
      })
      used.add("relation")
      return
    }
    if (isMember(callee, "stylex", "defaultMarker")) {
      edits.push({ start: node.start, end: node.end, text: "peer.anchor" })
      used.add("peer")
      return
    }
    if (isMember(callee, "stylex", "keyframes")) {
      edits.push({ start: callee.start, end: callee.end, text: "keyframes" })
      used.add("keyframes")
      return
    }
    if (isMember(callee, "stylex", "createTheme")) {
      edits.push({ start: callee.start, end: callee.end, text: "defineTheme" })
      used.add("defineTheme")
      return
    }
    for (const [from, to] of [
      ["firstThatWorks", "firstThatWorks"],
      ["positionTry", "positionTry"],
      ["viewTransitionClass", "viewTransition"],
    ] as const) {
      if (isMember(callee, "stylex", from)) {
        edits.push({ start: callee.start, end: callee.end, text: to })
        used.add(to)
        return
      }
    }
    const when = whenMember(callee)
    if (when) {
      const method = {
        ancestor: "within",
        siblingBefore: "after",
        siblingAfter: "before",
      }[when]
      if (!method) {
        report.push(
          `${file}:${node.start}: stylex.when.${when} has no mapping; use a :has() condition`
        )
        return
      }
      const marker = args[1] ? text(args[1]) : "peer"
      if (!args[1]) used.add("peer")
      edits.push({
        start: node.start,
        end: node.end,
        text: `${marker}.${method}(${args[0] ? text(args[0]) : ""})`,
      })
      return
    }
    if (
      isMember(callee.object, "stylex", "when") === false &&
      (callee as Node).type === "MemberExpression" &&
      (callee.object as Node as { name?: string }).name === "stylex"
    ) {
      report.push(`${file}:${node.start}: unmapped ${text(callee)}`)
    }
  })

  edits.sort((a, b) => b.start - a.start || b.end - a.end)
  let out = source
  let lastStart = Number.POSITIVE_INFINITY
  for (const edit of edits) {
    if (edit.end > lastStart) {
      report.push(
        `${file}:${edit.start}: overlapping edit skipped (${JSON.stringify(edit.text)})`
      )
      continue
    }
    out = out.slice(0, edit.start) + edit.text + out.slice(edit.end)
    lastStart = edit.start
  }
  const names = [...used].filter((name) => name !== "peer").sort()
  const importLine = names.length
    ? `import { ${names.join(", ")} } from "@kirana-style/core"`
    : ""
  out = out.replace("/*__KIRANA_IMPORT__*/", importLine)
  if (used.has("peer") && !/export const peer\b/.test(out)) {
    report.push(
      `${file}: uses the default marker; import { peer } from the markers module`
    )
  }
  out = out.replace(/(from\s+["'][^"']*?)\.stylex(["'])/g, "$1$2")
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
      : /\.(ts|tsx)$/.test(name)
        ? [full]
        : []
  })
}

for (const directory of process.argv.slice(2)) {
  for (const file of files(directory)) {
    const source = readFileSync(file, "utf8")
    const next = migrate(file, source)
    if (next !== source) writeFileSync(file, next)
    if (file.endsWith(".stylex.ts"))
      renameSync(file, file.replace(/\.stylex\.ts$/, ".ts"))
  }
}
console.log(report.length ? report.join("\n") : "no report items")
