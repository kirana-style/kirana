/**
 * `kirana/diagnostics`: every compiler diagnostic, where the compiler puts it, so a lint-only CI
 * sees what the build would report. The compiler decides; the rule only relays.
 */
import { inspect } from "../project.ts"
import { docs } from "../types.ts"
import type { Rule } from "../types.ts"

const RANK = { info: 0, warning: 1, error: 2 } as const

type Options = { minimum?: keyof typeof RANK; ignore?: string[] }

const rule: Rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Report the Kirana compiler's diagnostics.",
      url: docs("diagnostics"),
    },
    schema: [
      {
        type: "object",
        properties: {
          minimum: { enum: ["info", "warning", "error"] },
          ignore: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const { minimum = "warning", ignore = [] } = (context.options[0] ??
      {}) as Options
    return {
      Program() {
        const { diagnostics, index } = inspect(context)
        for (const diagnostic of diagnostics) {
          if (
            RANK[diagnostic.severity] < RANK[minimum] ||
            ignore.includes(diagnostic.name)
          )
            continue
          const help = diagnostic.help.map((line) => ` Help: ${line}`).join("")
          context.report({
            message: `${diagnostic.message} (${diagnostic.name}).${help}`,
            loc: {
              start: context.sourceCode.getLocFromIndex(
                index(diagnostic.span.start)
              ),
              end: context.sourceCode.getLocFromIndex(
                index(diagnostic.span.end)
              ),
            },
          })
        }
      },
    }
  },
}

export default rule
