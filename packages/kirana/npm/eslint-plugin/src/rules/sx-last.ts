/**
 * `kirana/sx-last`: a component that forwards its caller's `sx` puts it last, so the caller's
 * styles override the component's own (`sx={[styles.root, sx]}`, `styleProps(styles.root, sx)`).
 * Kirana merges later entries over earlier ones per property and condition; an `sx` in the middle
 * is silently overridden by what follows it. Other values handed down (a `className` a parent's
 * `render` passed) may follow it.
 */
import { calls, kiranaImports, walk } from "../ast.ts"
import { docs } from "../types.ts"
import type { Node, Rule } from "../types.ts"

/** `sx` or `props.sx` (and, for `passThrough`, `className`): a value the caller handed down. */
const named = (node: Node | null, names: string[]): boolean =>
  node?.type === "Identifier"
    ? names.includes(node.name)
    : node?.type === "MemberExpression" &&
      !node.computed &&
      names.includes(node.property.name)
const isForwarded = (node: Node | null) => named(node, ["sx"])
/** What may follow a forwarded `sx`: other values the caller handed down, such as `className`. */
const passThrough = (node: Node | null) => named(node, ["sx", "className"])

const rule: Rule = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Put a forwarded sx last so callers can override.",
      url: docs("sx-last"),
    },
    fixable: "code",
    schema: [],
  },
  create(context) {
    const check = (items: Array<Node | null>) => {
      const at = items.findIndex(isForwarded)
      const last = items.length - 1
      if (
        at < 0 ||
        at === last ||
        items.some((item) => item?.type === "SpreadElement")
      )
        return
      if (items.slice(at + 1).every(passThrough)) return
      const source = context.sourceCode
      const forwarded = items[at]!
      context.report({
        node: forwarded,
        message: `${source.getText(forwarded)} is followed by styles that override it; forward it last so callers can override this component.`,
        fix: (fixer) => {
          const reordered = [
            ...items.slice(0, at),
            ...items.slice(at + 1),
            forwarded,
          ]
          return items.map((item, index) =>
            fixer.replaceText(item!, source.getText(reordered[index]!))
          )
        },
      })
    }
    return {
      Program(program) {
        const styleProps = kiranaImports(program).get("props")
        walk(program, (node) => {
          if (
            node.type === "JSXAttribute" &&
            node.name.name === "sx" &&
            node.value?.type === "JSXExpressionContainer" &&
            node.value.expression.type === "ArrayExpression"
          )
            check(node.value.expression.elements)
          if (calls(node, styleProps)) check(node.arguments)
        })
      },
    }
  },
}

export default rule
