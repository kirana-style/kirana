/**
 * `kirana/no-conflicting-props`: a `className` or `style` written next to `{...styleProps(…)}` on
 * the same element. JSX keeps the last one written, so either the compiled styles replace the
 * attribute or the attribute replaces the compiled styles — one of them never reaches the DOM.
 * `sx` itself is fine: the compiler merges it with the element's own `className`.
 */
import { calls, kiranaImports, walk } from "../ast.ts"
import { docs } from "../types.ts"
import type { Node, Rule } from "../types.ts"

const rule: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Do not combine className or style with a styleProps() spread.",
      url: docs("no-conflicting-props"),
    },
    schema: [],
  },
  create(context) {
    return {
      Program(program) {
        const styleProps = kiranaImports(program).get("props")
        walk(program, (element) => {
          if (element.type !== "JSXOpeningElement") return
          const attributes = element.attributes as Node[]
          const spread = attributes.findIndex(
            (attribute) =>
              attribute.type === "JSXSpreadAttribute" &&
              calls(attribute.argument, styleProps)
          )
          if (spread < 0) return
          attributes.forEach((attribute, at) => {
            if (
              attribute.type !== "JSXAttribute" ||
              !["className", "style"].includes(attribute.name.name)
            )
              return
            const name = attribute.name.name
            context.report({
              node: attribute,
              message:
                at < spread
                  ? `The styleProps() spread after this ${name} replaces it; move these styles into a css() handle passed to styleProps().`
                  : `This ${name} replaces the one styleProps() returned, dropping the compiled styles; move these styles into a css() handle passed to styleProps().`,
            })
          })
        })
      },
    }
  },
}

export default rule
