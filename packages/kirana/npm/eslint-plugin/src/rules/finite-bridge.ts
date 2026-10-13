/**
 * `kirana/finite-bridge`: a style factory whose value is bridged at runtime
 * (`(size) => css({ width: size })`) but is only ever called with a few literals in its file is a
 * variant in disguise. A recipe variant, or one handle per value, compiles to static classes; the
 * bridge costs a custom property and a `style` attribute on every element. The compiler says which
 * values are bridged (`dynamic-bridged`); the rule counts the calls.
 */
import { walk } from "../ast.ts"
import { inspect } from "../project.ts"
import { docs } from "../types.ts"
import type { Node, Rule } from "../types.ts"

type Options = { max?: number }

/** How a factory is called: `name(…)` or `object.name(…)`. */
function calleeOf(fn: Node): { object?: string; name: string } | undefined {
  const parent = fn.parent!
  if (parent.type === "VariableDeclarator" && parent.id.type === "Identifier")
    return { name: parent.id.name }
  if (parent.type === "Property" && parent.key.type === "Identifier") {
    const holder = parent.parent!.parent!
    if (holder.type === "VariableDeclarator" && holder.id.type === "Identifier")
      return { object: holder.id.name, name: parent.key.name }
  }
  return undefined
}

const matches = (callee: Node, target: { object?: string; name: string }) =>
  target.object === undefined
    ? callee.type === "Identifier" && callee.name === target.name
    : callee.type === "MemberExpression" &&
      callee.object.type === "Identifier" &&
      callee.object.name === target.object &&
      callee.property.name === target.name

const rule: Rule = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Turn a bridged value that only takes a few literals into variants.",
      url: docs("finite-bridge"),
    },
    schema: [
      {
        type: "object",
        properties: { max: { type: "integer", minimum: 1 } },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const { max = 3 } = (context.options[0] ?? {}) as Options
    return {
      Program(program) {
        const { diagnostics, index } = inspect(context)
        const bridged = diagnostics
          .filter((diagnostic) => diagnostic.name === "dynamic-bridged")
          .map((diagnostic) => index(diagnostic.span.start))
        const factories: Node[] = []
        walk(program, (node) => {
          if (
            (node.type === "ArrowFunctionExpression" ||
              node.type === "FunctionExpression") &&
            bridged.some(
              (start) => start >= node.range[0] && start < node.range[1]
            )
          )
            factories.push(node)
        })
        for (const fn of factories) {
          const target = calleeOf(fn)
          if (!target) continue
          const values = new Set<string>()
          let calls = 0
          let open = false
          walk(program, (node) => {
            if (node.type !== "CallExpression" || !matches(node.callee, target))
              return
            calls += 1
            const literal = (node.arguments as Node[]).every(
              (argument) => argument.type === "Literal"
            )
            if (!literal) open = true
            values.add(
              node.arguments.map((argument: Node) => argument.raw).join(", ")
            )
          })
          if (open || calls === 0 || values.size > max) continue
          const name = target.object
            ? `${target.object}.${target.name}`
            : target.name
          context.report({
            node: fn,
            message: `${name} is only called with ${[...values].join(" | ")}, so its value is bridged at runtime for nothing: make each value a recipe variant or its own handle, which compile to static classes.`,
          })
        }
      },
    }
  },
}

export default rule
