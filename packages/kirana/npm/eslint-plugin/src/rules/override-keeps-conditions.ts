/**
 * `kirana/override-keeps-conditions`: a plain value passed through `sx` to a component that sets the
 * same property under a structural condition (`[data-orientation="vertical"]`, `[aria-*]`) does not
 * override it there. Kirana merges per property *and* condition, so the component's conditional
 * entry still wins when its attribute matches — the StyleX habit of replacing a whole property
 * fails silently. Interaction states (`:hover`) are not reported: keeping a component's hover over
 * a caller's plain value is usually intended.
 *
 * The component's entries come from the compiler (`sites` of the file that defines it).
 */
import { calls, kebab, keyName, kiranaImports, walk } from "../ast.ts"
import { inspect } from "../project.ts"
import { docs } from "../types.ts"
import type { Node, Rule } from "../types.ts"

/** Whether every condition of an entry is an attribute (structural, not an interaction state). */
const structural = (conditions: string[]) =>
  conditions.length > 0 &&
  conditions.every((condition) => condition.startsWith("["))

const rule: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Override a component's conditional entries under their condition.",
      url: docs("override-keeps-conditions"),
    },
    hasSuggestions: true,
    schema: [],
  },
  create(context) {
    return {
      Program(program) {
        const { driver, file } = inspect(context)
        const imports = kiranaImports(program)
        const css = imports.get("css")
        /** Where each imported (or local) component is defined. */
        const origin = new Map<string, string>()
        for (const statement of program.body as Node[]) {
          if (statement.type !== "ImportDeclaration") continue
          const resolved = driver.resolve(file, statement.source.value)
          if (resolved)
            for (const specifier of statement.specifiers as Node[])
              origin.set(specifier.local.name, resolved)
        }
        /** Local `const x = css({…})` handles, so `sx={x}` is read too. */
        const handles = new Map<string, Node>()
        walk(program, (node) => {
          if (
            node.type === "VariableDeclarator" &&
            node.id.type === "Identifier" &&
            node.init &&
            calls(node.init, css)
          )
            handles.set(node.id.name, node.init)
        })
        walk(program, (element) => {
          if (
            element.type !== "JSXOpeningElement" ||
            element.name.type !== "JSXIdentifier"
          )
            return
          const name = element.name.name as string
          if (!/^[A-Z]/.test(name)) return
          const sx = (element.attributes as Node[]).find(
            (attribute) =>
              attribute.type === "JSXAttribute" && attribute.name.name === "sx"
          )
          if (sx?.value?.type !== "JSXExpressionContainer") return
          // The same atom appears in each site that applies it (the `css()` and the `sx` using it).
          const conditional = new Map<string, Set<string>>()
          for (const site of driver.sites(origin.get(name) ?? file))
            for (const atom of site.atoms)
              if (atom.target === "" && structural(atom.conditions))
                conditional.set(
                  atom.property,
                  (conditional.get(atom.property) ?? new Set()).add(
                    atom.conditions.join("")
                  )
                )
          const expression = sx.value.expression
          const items: Node[] =
            expression.type === "ArrayExpression"
              ? expression.elements
              : [expression]
          for (const item of items) {
            const call =
              item.type === "Identifier" ? handles.get(item.name) : item
            if (!call || !calls(call, css)) continue
            for (const argument of call.arguments as Node[]) {
              if (argument.type !== "ObjectExpression") continue
              for (const property of argument.properties as Node[]) {
                const key = keyName(property)
                const entries =
                  key === undefined ? undefined : conditional.get(kebab(key))
                if (!entries || property.value.type === "ObjectExpression")
                  continue
                const value = context.sourceCode.getText(property.value)
                const conditions = [...entries]
                const under = conditions
                  .map((condition) => `${JSON.stringify(condition)}: ${value}`)
                  .join(", ")
                context.report({
                  node: property,
                  message: `${name} sets ${key} under ${conditions.join(", ")}; this plain value does not override it there (Kirana merges per condition).`,
                  suggest: [
                    {
                      desc: `Set ${key} under the component's conditions too`,
                      fix: (fixer) =>
                        fixer.replaceText(
                          property.value,
                          `{ base: ${value}, ${under} }`
                        ),
                    },
                    {
                      desc: `Drop the component's ${key} entries and set this value`,
                      fix: (fixer) =>
                        fixer.replaceText(
                          property.value,
                          `{ "*": null, base: ${value} }`
                        ),
                    },
                  ],
                })
              }
            }
          }
        })
      },
    }
  },
}

export default rule
