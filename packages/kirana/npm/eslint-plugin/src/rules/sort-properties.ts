/**
 * `kirana/sort-properties`: one property order in every style object (KRN-DX-010). Properties go
 * layout, box, typography, visual, the rest, custom properties, then nested blocks; a conditional
 * value goes `base`, at-rules, relations, pseudo-classes, attributes, the order ladder step 3
 * applies them. Order never changes what Kirana compiles, so the fix is safe; an object with a
 * spread is left alone, since what the spread overrides depends on where it sits.
 */
import { eachStyleObject, isConditionKey, kebab, keyName } from "../ast.ts"
import { docs } from "../types.ts"
import type { Node, Rule } from "../types.ts"

/** The property groups, each in its own canonical order. */
const GROUPS: string[][] = [
  [
    "display",
    "position",
    "inset",
    "top",
    "right",
    "bottom",
    "left",
    "z-index",
    "float",
    "clear",
    "isolation",
    "visibility",
    "flex",
    "flex-direction",
    "flex-wrap",
    "flex-grow",
    "flex-shrink",
    "flex-basis",
    "order",
    "grid",
    "grid-template",
    "grid-template-columns",
    "grid-template-rows",
    "grid-template-areas",
    "grid-auto-flow",
    "grid-column",
    "grid-row",
    "grid-area",
    "place-items",
    "place-content",
    "place-self",
    "align-items",
    "align-content",
    "align-self",
    "justify-items",
    "justify-content",
    "justify-self",
    "gap",
    "row-gap",
    "column-gap",
  ],
  [
    "box-sizing",
    "width",
    "min-width",
    "max-width",
    "height",
    "min-height",
    "max-height",
    "inline-size",
    "block-size",
    "aspect-ratio",
    "margin",
    "padding",
    "overflow",
    "overflow-x",
    "overflow-y",
    "contain",
    "container",
  ],
  [
    "font",
    "font-family",
    "font-size",
    "font-weight",
    "font-style",
    "line-height",
    "letter-spacing",
    "text-align",
    "text-decoration",
    "text-transform",
    "text-overflow",
    "text-wrap",
    "white-space",
    "word-break",
    "overflow-wrap",
    "vertical-align",
    "list-style",
  ],
  [
    "color",
    "background",
    "background-color",
    "background-image",
    "border",
    "border-width",
    "border-style",
    "border-color",
    "border-radius",
    "outline",
    "box-shadow",
    "opacity",
    "filter",
    "backdrop-filter",
    "mix-blend-mode",
    "fill",
    "stroke",
    "cursor",
    "pointer-events",
    "user-select",
    "transform",
    "translate",
    "rotate",
    "scale",
    "transition",
    "animation",
    "will-change",
    "content",
  ],
]

/** Prefixes that place a property in a group when it is not listed (`margin-top` with `margin`). */
const FAMILIES: Array<[string, number]> = [
  ["inset-", 0],
  ["flex-", 0],
  ["grid-", 0],
  ["margin-", 1],
  ["padding-", 1],
  ["overflow-", 1],
  ["scroll-", 1],
  ["font-", 2],
  ["text-", 2],
  ["background-", 3],
  ["border-", 3],
  ["outline-", 3],
  ["transition-", 3],
  ["animation-", 3],
]

/** `[group, position in it]` of a style object's key, or the slot after every property. */
export function propertyRank(key: string | undefined): [number, number] {
  if (key === undefined) return [6, 0]
  if (key.startsWith("::")) return [6, 0]
  if (key.startsWith("--")) return [5, 0]
  const property = kebab(key)
  for (const [group, members] of GROUPS.entries()) {
    const at = members.indexOf(property)
    if (at >= 0) return [group, at]
  }
  const family = FAMILIES.find(([prefix]) => property.startsWith(prefix))
  if (family) {
    const base = GROUPS[family[1]]!.indexOf(family[0].slice(0, -1))
    return [family[1], base < 0 ? GROUPS[family[1]]!.length : base + 0.5]
  }
  return [4, 0]
}

/** The rank of a conditional value's key: `base`, then ladder step 3's classes, weakest first. */
export function conditionRank(key: string | undefined, computed: Node): number {
  if (key === "base" || key === "*") return 0
  if (key?.startsWith("@")) return 1
  if (key === undefined) return computed.type === "CallExpression" ? 2 : 5
  if (key.startsWith(":")) return 3
  if (key.startsWith("[")) return 4
  return 5
}

const rule: Rule = {
  meta: {
    type: "layout",
    docs: {
      description: "Order style properties and conditions canonically.",
      url: docs("sort-properties"),
    },
    fixable: "code",
    schema: [],
  },
  create(context) {
    return {
      Program(program) {
        eachStyleObject(program, (object, conditional) => {
          const properties = object.properties as Node[]
          if (
            properties.length < 2 ||
            properties.some((property) => property.type !== "Property")
          )
            return
          const rank = (property: Node): number[] => {
            const key = keyName(property)
            if (conditional) return [conditionRank(key, property.key)]
            // A condition key at the top of a style is an error the compiler reports; keep it last.
            if (key !== undefined && isConditionKey(key)) return [7, 0]
            return propertyRank(key)
          }
          const ranked = properties.map((property, position) => ({
            property,
            rank: rank(property),
            position,
          }))
          const sorted = [...ranked].sort(
            (a, b) =>
              a.rank[0]! - b.rank[0]! ||
              (a.rank[1] ?? 0) - (b.rank[1] ?? 0) ||
              a.position - b.position
          )
          const first = sorted.findIndex((entry, at) => entry !== ranked[at])
          if (first < 0) return
          const misplaced = sorted[first]!.property
          const source = context.sourceCode
          context.report({
            node: misplaced,
            message: `${source.getText(misplaced.key)} belongs before ${source.getText(ranked[first]!.property.key)} (${conditional ? "conditions go base, at-rules, relations, pseudo-classes, attributes" : "layout, box, typography, visual, other, custom properties, nested blocks"}).`,
            fix: (fixer) =>
              properties.map((property, at) =>
                fixer.replaceText(
                  property,
                  source.getText(sorted[at]!.property)
                )
              ),
          })
        })
      },
    }
  },
}

export default rule
