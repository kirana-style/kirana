/**
 * `kirana/restricted-properties`: properties a project has ruled out, or limited to a few values,
 * reported where a style writes them (`float`, or a `display` other than `flex` and `grid`). The
 * list is the project's own, so the rule does nothing until it is configured:
 *
 *   "kirana/restricted-properties": ["error", {
 *     float: { reason: "Use flex or grid." },
 *     display: { values: ["flex", "grid", "none"] },
 *   }]
 *
 * A property is matched as written, so restricting `margin` leaves `marginTop` alone; list both to
 * rule out a family. A value is checked when it is a literal, alone or in a conditional value; a
 * token or an expression is the design system's own and passes.
 */
import { eachStyleObject, isConditionKey, kebab, keyName } from "../ast.ts"
import { docs } from "../types.ts"
import type { Node, Rule } from "../types.ts"

type Restriction = {
  reason?: string
  values?: readonly (string | number)[]
}

/** The literals a property sets: its value, or every value of a conditional value. */
function literals(value: Node): Node[] {
  if (
    value.type === "Literal" &&
    (typeof value.value === "string" || typeof value.value === "number")
  )
    return [value]
  if (value.type !== "ObjectExpression") return []
  return (value.properties as Node[]).flatMap((property) =>
    property.type === "Property" ? literals(property.value) : []
  )
}

const rule: Rule = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Report the properties, or the values of a property, the project rules out.",
      url: docs("restricted-properties"),
    },
    schema: [
      {
        type: "object",
        additionalProperties: {
          type: "object",
          properties: {
            reason: { type: "string" },
            values: {
              type: "array",
              items: { type: ["string", "number"] },
            },
          },
          additionalProperties: false,
        },
      },
    ],
  },
  create(context) {
    const options = (context.options[0] ?? {}) as Record<string, Restriction>
    const restrictions = new Map(
      Object.entries(options).map(([name, restriction]) => [
        kebab(name),
        restriction,
      ])
    )
    return {
      Program(program) {
        if (restrictions.size === 0) return
        eachStyleObject(program, (object, conditional) => {
          if (conditional) return
          for (const property of object.properties as Node[]) {
            if (property.type !== "Property") continue
            const key = keyName(property)
            if (
              key === undefined ||
              isConditionKey(key) ||
              key.startsWith("::")
            )
              continue
            const restriction = restrictions.get(kebab(key))
            if (!restriction) continue
            const because = restriction.reason ? ` ${restriction.reason}` : ""
            const allowed = restriction.values
            if (!allowed) {
              context.report({
                node: property.key,
                message: `${key} is ruled out in this project.${because}`,
              })
              continue
            }
            for (const literal of literals(property.value)) {
              if (
                allowed.some((value) => String(value) === String(literal.value))
              )
                continue
              context.report({
                node: literal,
                message: `${key} takes ${allowed.join(", ")} in this project, not ${literal.raw}.${because}`,
              })
            }
          }
        })
      },
    }
  },
}

export default rule
