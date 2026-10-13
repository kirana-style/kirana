/**
 * `kirana/no-dark-variant`: dark mode written the way other systems write it, which Kirana compiles
 * without complaint and the page then ignores.
 *
 * - A `prefers-color-scheme` condition in a style (a condition key or a `media()` query) follows the
 *   operating system, not the mode the page chose: a toggle that sets `color-scheme` on `<html>`
 *   never reaches it. A colour token holds both values as a `light-dark()` pair, which follows
 *   `color-scheme`, and so the toggle too.
 * - A Tailwind `dark:` class in a `className`, `class` or `sx` string names a class no stylesheet
 *   defines.
 */
import { calls, eachStyleObject, keyName, kiranaImports, walk } from "../ast.ts"
import { docs } from "../types.ts"
import type { Node, Rule } from "../types.ts"

const SCHEME = /prefers-color-scheme/
const VARIANT = /(^|\s)dark:\S/

/** The text of a string literal or a template literal without expressions. */
const text = (node: Node | undefined): string | undefined =>
  node?.type === "Literal" && typeof node.value === "string"
    ? node.value
    : node?.type === "TemplateLiteral" && node.expressions.length === 0
      ? node.quasis[0].value.cooked
      : undefined

const rule: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Write dark mode as light-dark() tokens, not prefers-color-scheme conditions or dark: classes.",
      url: docs("no-dark-variant"),
    },
    schema: [],
  },
  create(context) {
    const scheme = (node: Node) =>
      context.report({
        node,
        message:
          "prefers-color-scheme follows the system, not the mode the page chose; put both values in a light-dark() token, which follows color-scheme.",
      })
    return {
      Program(program) {
        const media = kiranaImports(program).get("media")
        eachStyleObject(program, (object) => {
          for (const property of object.properties as Node[])
            if (
              property.type === "Property" &&
              SCHEME.test(keyName(property) ?? "")
            )
              scheme(property.key)
        })
        walk(program, (node) => {
          if (calls(node, media) && SCHEME.test(text(node.arguments[0]) ?? ""))
            scheme(node)
          if (
            node.type === "JSXAttribute" &&
            ["className", "class", "sx"].includes(node.name.name) &&
            VARIANT.test(text(node.value) ?? "")
          )
            context.report({
              node: node.value,
              message:
                "dark: is a Tailwind variant and names no class here; put both values in a light-dark() token.",
            })
        })
      },
    }
  },
}

export default rule
