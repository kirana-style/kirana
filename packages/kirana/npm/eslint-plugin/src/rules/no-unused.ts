/**
 * `kirana/no-unused`: a style nothing applies. In a module-local styles object
 * (`const styles = { root: css(…), unused: css(…) }`), a key no `styles.<key>` reads; in a
 * module-local recipe, a variant option no call selects and no default names. Exported objects and
 * recipes, and ones used whole (`Object.values(styles)`, a spread, an argument), are left alone:
 * their uses cannot be counted from one file. So are Vue, Svelte and Astro components: a linter
 * sees their script, and the styles are applied in the template it does not see.
 */
import { calls, keyName, kiranaImports, walk } from "../ast.ts"
import { docs } from "../types.ts"
import type { Node, Rule } from "../types.ts"

const exported = (declarator: Node) =>
  declarator.parent!.parent!.type === "ExportNamedDeclaration"

/** The range of an object entry with the comma after it, for a fix that removes it. */
function entryRange(text: string, entry: Node): [number, number] {
  const comma = /^\s*,\s*/.exec(text.slice(entry.range[1]))
  return [entry.range[0], entry.range[1] + (comma ? comma[0].length : 0)]
}

/** Property names read as `<name>.<property>`; `undefined` when the binding escapes whole. */
function memberReads(program: Node, declarator: Node): Set<string> | undefined {
  const name = declarator.id.name
  const reads = new Set<string>()
  let escapes = false
  walk(program, (node) => {
    if (
      node.type !== "Identifier" ||
      node.name !== name ||
      node === declarator.id
    )
      return
    const parent = node.parent!
    if (parent.type === "MemberExpression" && parent.object === node) {
      if (!parent.computed) reads.add(parent.property.name)
      else if (parent.property.type === "Literal")
        reads.add(String(parent.property.value))
      else escapes = true
    } else if (
      !(parent.type === "Property" && parent.key === node && !parent.computed)
    )
      escapes = true
  })
  return escapes ? undefined : reads
}

const rule: Rule = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Report style handles and recipe variants nothing applies.",
      url: docs("no-unused"),
    },
    hasSuggestions: true,
    schema: [],
  },
  create(context) {
    return {
      Program(program) {
        if (/\.(vue|svelte|astro)$/.test(context.filename)) return
        const imports = kiranaImports(program)
        walk(program, (declarator) => {
          if (
            declarator.type !== "VariableDeclarator" ||
            declarator.id.type !== "Identifier" ||
            exported(declarator)
          )
            return
          const init = declarator.init
          if (init?.type === "ObjectExpression") unusedHandles(declarator, init)
          if (init && calls(init, imports.get("recipe")))
            unusedVariants(declarator, init)
        })

        function unusedHandles(declarator: Node, object: Node) {
          const handles = (object.properties as Node[]).filter(
            (property) =>
              property.type === "Property" &&
              calls(property.value, imports.get("css"))
          )
          if (handles.length === 0) return
          const reads = memberReads(program, declarator)
          if (!reads) return
          for (const property of handles) {
            const key = keyName(property)!
            if (reads.has(key)) continue
            context.report({
              node: property.key,
              message: `${declarator.id.name}.${key} is never applied.`,
              suggest: [
                {
                  desc: `Remove ${key}`,
                  fix: (fixer) =>
                    fixer.replaceTextRange(
                      entryRange(context.sourceCode.text, property),
                      ""
                    ),
                },
              ],
            })
          }
        }

        function unusedVariants(declarator: Node, call: Node) {
          const config = call.arguments[0]
          if (config?.type !== "ObjectExpression") return
          const field = (name: string) =>
            (config.properties as Node[]).find(
              (property) => keyName(property) === name
            )?.value
          const variants = field("variants")
          if (variants?.type !== "ObjectExpression") return
          const selected = new Map<string, Set<string>>()
          const dynamic = new Set<string>()
          const select = (options: Node | undefined) => {
            if (options?.type !== "ObjectExpression") return false
            for (const option of options.properties as Node[]) {
              if (option.type !== "Property") return false
              const name = keyName(option)!
              if (option.value.type === "Literal")
                selected.set(
                  name,
                  (selected.get(name) ?? new Set()).add(
                    String(option.value.value)
                  )
                )
              else dynamic.add(name)
            }
            return true
          }
          select(field("defaultVariants"))
          const name = declarator.id.name
          let escapes = false
          walk(program, (node) => {
            if (
              node.type !== "Identifier" ||
              node.name !== name ||
              node === declarator.id
            )
              return
            const parent = node.parent!
            if (parent.type === "CallExpression" && parent.callee === node) {
              if (!select(parent.arguments[0]) && parent.arguments.length > 0)
                escapes = true
            } else escapes = true
          })
          if (escapes) return
          for (const variant of variants.properties as Node[]) {
            const variantName = keyName(variant)
            if (
              variant.type !== "Property" ||
              variant.value.type !== "ObjectExpression" ||
              dynamic.has(variantName!)
            )
              continue
            for (const option of variant.value.properties as Node[]) {
              const optionName = keyName(option)!
              if (selected.get(variantName!)?.has(optionName)) continue
              context.report({
                node: option.key,
                message: `${name}'s ${variantName} option ${JSON.stringify(optionName)} is never selected.`,
                suggest: [
                  {
                    desc: `Remove ${optionName}`,
                    fix: (fixer) =>
                      fixer.replaceTextRange(
                        entryRange(context.sourceCode.text, option),
                        ""
                      ),
                  },
                ],
              })
            }
          }
        }
      },
    }
  },
}

export default rule
