/**
 * `kirana/use-logical-properties`: a property fixed to the left or the right names the inline side
 * instead (`marginLeft` → `marginInlineStart`), so a right-to-left page mirrors it. Only the sides
 * and corners of the inline axis: top, bottom and sizes change only in vertical writing, where a
 * page is laid out for it anyway.
 *
 * Off unless enabled, since a page that is only ever left-to-right loses nothing, and never fixed
 * automatically: the two properties agree only in left-to-right text, so the change is the author's
 * call, offered as a suggestion. The pairs follow the compiler's own (`physical_counterpart` in
 * `kirana_css_data`, which `mixed-logical-physical` reads); a test holds them together.
 */
import { eachStyleObject, keyName } from "../ast.ts"
import { docs } from "../types.ts"
import type { Node, Rule } from "../types.ts"

/** Each physical property of the inline axis, and its logical property. */
export const LOGICAL: Readonly<Record<string, string>> = {
  marginLeft: "marginInlineStart",
  marginRight: "marginInlineEnd",
  paddingLeft: "paddingInlineStart",
  paddingRight: "paddingInlineEnd",
  left: "insetInlineStart",
  right: "insetInlineEnd",
  borderLeft: "borderInlineStart",
  borderRight: "borderInlineEnd",
  borderLeftWidth: "borderInlineStartWidth",
  borderRightWidth: "borderInlineEndWidth",
  borderLeftColor: "borderInlineStartColor",
  borderRightColor: "borderInlineEndColor",
  borderLeftStyle: "borderInlineStartStyle",
  borderRightStyle: "borderInlineEndStyle",
  borderTopLeftRadius: "borderStartStartRadius",
  borderTopRightRadius: "borderStartEndRadius",
  borderBottomLeftRadius: "borderEndStartRadius",
  borderBottomRightRadius: "borderEndEndRadius",
  scrollMarginLeft: "scrollMarginInlineStart",
  scrollMarginRight: "scrollMarginInlineEnd",
  scrollPaddingLeft: "scrollPaddingInlineStart",
  scrollPaddingRight: "scrollPaddingInlineEnd",
}

/** The message for one physical property; the Biome rule writes the same words. */
export const message = (physical: string, logical: string) =>
  `${physical} stays on the same side in right-to-left text; ${logical} follows the writing direction.`

const rule: Rule = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Use the logical property for a side of the inline axis, so a right-to-left page mirrors it.",
      url: docs("use-logical-properties"),
    },
    hasSuggestions: true,
    schema: [],
  },
  create(context) {
    return {
      Program(program) {
        eachStyleObject(program, (object, conditional) => {
          if (conditional) return
          for (const property of object.properties as Node[]) {
            if (property.type !== "Property") continue
            const key = keyName(property)
            if (key === undefined || !Object.hasOwn(LOGICAL, key)) continue
            const logical = LOGICAL[key]!
            const quoted = property.key.type !== "Identifier"
            context.report({
              node: property.key,
              message: message(key, logical),
              suggest: [
                {
                  desc: `Rename ${key} to ${logical}.`,
                  fix: (fixer) =>
                    fixer.replaceText(
                      property.key,
                      quoted ? JSON.stringify(logical) : logical
                    ),
                },
              ],
            })
          }
        })
      },
    }
  },
}

export default rule
