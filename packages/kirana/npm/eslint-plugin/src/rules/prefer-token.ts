/**
 * `kirana/prefer-token`: a literal equal to a token's value names the token instead
 * (`color: "#0af"` → `color: color.brand`), so a theme or a design change reaches it. The tokens
 * come from the compiler: every token the project declares, inlined ones included.
 */
import { readFileSync } from "node:fs"
import path from "node:path"

import type { TokenInfo } from "@kirana-style/compiler"

import { eachStyleObject } from "../ast.ts"
import { inspect } from "../project.ts"
import { docs } from "../types.ts"
import type { Node, Rule } from "../types.ts"

const normalize = (value: string) =>
  value.trim().replace(/\s+/g, " ").toLowerCase()

/** `.brand`, `[500]` or `["x-y"]` for one path segment. */
const accessor = (segment: string) =>
  /^\d+$/.test(segment)
    ? `[${segment}]`
    : /^[A-Za-z_$][\w$]*$/.test(segment)
      ? `.${segment}`
      : `[${JSON.stringify(segment)}]`

/** The name a token group is exported under (`export const color = defineTokens("color", …)`). */
function exportName(file: string, namespace: string): string | undefined {
  const pattern = new RegExp(
    String.raw`export\s+const\s+([A-Za-z_$][\w$]*)\s*=\s*defineTokens\(\s*["'\x60]${namespace.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'\x60]`
  )
  return pattern.exec(readFileSync(file, "utf8"))?.[1]
}

const rule: Rule = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Use the token whose value a literal repeats.",
      url: docs("prefer-token"),
    },
    hasSuggestions: true,
    schema: [],
  },
  create(context) {
    return {
      Program(program) {
        const { driver, file } = inspect(context)
        const byValue = new Map<string, TokenInfo[]>()
        for (const token of driver.tokens()) {
          // A mode token's `value` joins both modes; only an exact value can be repeated.
          if (
            token.value === "" ||
            (token.light !== null && !token.value.startsWith("light-dark("))
          )
            continue
          if (path.resolve(driver.root, token.file) === file) continue
          const key = normalize(token.value)
          byValue.set(key, [...(byValue.get(key) ?? []), token])
        }
        const imports = (program.body as Node[]).filter(
          (node) => node.type === "ImportDeclaration"
        )
        eachStyleObject(program, (object) => {
          for (const property of object.properties as Node[]) {
            const value = property.value
            if (
              property.type !== "Property" ||
              value?.type !== "Literal" ||
              typeof value.value !== "string"
            )
              continue
            const tokens = byValue.get(normalize(value.value)) ?? []
            if (tokens.length === 0) continue
            context.report({
              node: value,
              message: `${value.raw} is the value of ${tokens.map((token) => token.identity).join(", ")}; use the token so a theme reaches it.`,
              suggest: tokens.slice(0, 3).flatMap((token) => {
                const tokenFile = path.resolve(driver.root, token.file)
                const [namespace, ...rest] = token.identity.split(".")
                const exported = exportName(tokenFile, namespace!)
                if (!exported) return []
                const local = imports
                  .filter(
                    (node) =>
                      driver.resolve(file, node.source.value) === tokenFile
                  )
                  .flatMap((node) => node.specifiers as Node[])
                  .find((specifier) => specifier.imported?.name === exported)
                  ?.local.name
                const expression = `${local ?? exported}${rest.map(accessor).join("")}`
                let specifier = path
                  .relative(path.dirname(file), tokenFile)
                  .replace(/\.[cm]?[jt]sx?$/, "")
                if (!specifier.startsWith(".")) specifier = `./${specifier}`
                return [
                  {
                    desc: `Use ${token.identity}`,
                    fix: (fixer) =>
                      local
                        ? fixer.replaceText(value, expression)
                        : [
                            fixer.insertTextBeforeRange(
                              [0, 0],
                              `import { ${exported} } from "${specifier.split(path.sep).join("/")}"\n`
                            ),
                            fixer.replaceText(value, expression),
                          ],
                  },
                ]
              }),
            })
          }
        })
      },
    }
  },
}

export default rule
