/**
 * `kirana/no-class-helpers`: an import of a class-string helper — `clsx`, `classnames`,
 * `tailwind-merge`, `class-variance-authority` — into a Kirana codebase. Joined class strings do not
 * merge: two atoms for one property both apply, and which wins depends on the stylesheet, not on the
 * order written. `cx` and `sx={[a, b]}` merge per property and condition, and `recipe()` compiles
 * the variants `cva` would pick at runtime.
 */
import { docs } from "../types.ts"
import type { Rule } from "../types.ts"

/** Each helper and what replaces it. */
export const HELPERS: Record<string, string> = {
  clsx: "cx() or sx={[a, b]} from @kirana-style/core, which merge per property",
  classnames:
    "cx() or sx={[a, b]} from @kirana-style/core, which merge per property",
  "tailwind-merge":
    "cx() from @kirana-style/core, which already merges per property and condition",
  "class-variance-authority":
    "recipe() from @kirana-style/core, which compiles static variant calls to class strings",
}

const rule: Rule = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Use cx, sx arrays and recipe() instead of class-string helpers.",
      url: docs("no-class-helpers"),
    },
    schema: [],
  },
  create(context) {
    return {
      ImportDeclaration(node) {
        const source = node.source.value as string
        // The package's first segment (`clsx/lite` → `clsx`), cut without a regex.
        const instead = HELPERS[source.split("/", 1)[0]!]
        if (instead)
          context.report({
            node: node.source,
            message: `${source} joins class strings, which do not merge in Kirana; use ${instead}.`,
          })
      },
    }
  },
}

export default rule
