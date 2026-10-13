/**
 * `kirana/no-classname-on-sx`: a `className` given to a project component that takes `sx` and not
 * `className`. The class never reaches the DOM — the silent style loss the Tailwind migration
 * guide describes, reported where it happens. A component that spreads the rest of its props
 * (`{ sx, ...props }`) may pass the class on, so it is not reported.
 */
import { readFileSync } from "node:fs"

import { walk } from "../ast.ts"
import { inspect } from "../project.ts"
import { docs } from "../types.ts"
import type { Node, Rule } from "../types.ts"

/** The parameter text of `function Name(…)` or `const Name = (…) =>` in `source`. */
export function parameters(source: string, name: string): string | undefined {
  const pattern = new RegExp(
    String.raw`(?:function\s+${name}\s*\(|const\s+${name}\s*=\s*(?:function\s*\w*\s*)?\()([^)]*)\)`
  )
  return pattern.exec(source)?.[1]
}

const rule: Rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Do not pass className to a component that reads sx.",
      url: docs("no-classname-on-sx"),
    },
    schema: [],
  },
  create(context) {
    return {
      Program(program) {
        const { driver, file, text } = inspect(context)
        const origin = new Map<string, string>()
        for (const statement of program.body as Node[]) {
          if (statement.type !== "ImportDeclaration") continue
          const resolved = driver.resolve(file, statement.source.value)
          if (resolved)
            for (const specifier of statement.specifiers as Node[])
              origin.set(specifier.local.name, resolved)
        }
        const readsSx = new Map<string, boolean>()
        const takesSx = (name: string) => {
          if (!readsSx.has(name)) {
            const from = origin.get(name)
            const params =
              parameters(from ? readFileSync(from, "utf8") : text, name) ?? ""
            readsSx.set(
              name,
              /\bsx\b/.test(params) &&
                !/\bclassName\b/.test(params) &&
                !params.includes("...")
            )
          }
          return readsSx.get(name)!
        }
        const visit = (node: Node) => {
          if (
            node.type === "JSXOpeningElement" &&
            node.name.type === "JSXIdentifier" &&
            /^[A-Z]/.test(node.name.name)
          ) {
            const className = (node.attributes as Node[]).find(
              (attribute) =>
                attribute.type === "JSXAttribute" &&
                attribute.name.name === "className"
            )
            if (className && takesSx(node.name.name))
              context.report({
                node: className,
                message: `${node.name.name} reads sx, not className: this class never reaches the DOM. Pass a css() handle through sx.`,
              })
          }
        }
        walk(program, visit)
      },
    }
  },
}

export default rule
