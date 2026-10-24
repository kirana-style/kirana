/**
 * `@kirana-style/states`: what holds across the library vocabularies (`./base-ui`, `./ark-ui`,
 * `./react-aria`, `./reka-ui`, `./bits-ui`, `./ng-primitives`).
 */

/** One attribute selector, or the negation of one (React Aria's `:not([aria-valuenow])`). */
const SIMPLE = /^(?:\[[^[\]]+\]|:not\(\[[^[\]]+\]\))$/

/**
 * One vocabulary per library, for `conditions.exclusiveAcross` (KF-015). A design system that writes
 * each component's look once for several libraries spreads every library's key for a state
 * (`[data-starting-style]` and `[data-entering]` for a popup's first frame); a component is built on
 * one library, so two keys no single library sets never meet on an element, and the compiler stops
 * reporting their pairs as `ambiguous-precedence`:
 *
 *   import * as baseUi from "@kirana-style/states/base-ui"
 *   import * as reactAria from "@kirana-style/states/react-aria"
 *   import { exclusiveAcross } from "@kirana-style/states"
 *
 *   export default defineConfig({
 *     conditions: {
 *       exclusive: [...baseUi.exclusive, ...reactAria.exclusive],
 *       exclusiveAcross: exclusiveAcross(baseUi, reactAria),
 *     },
 *   })
 *
 * Each vocabulary is every state selector its library's parts declare, sorted.
 */
export function exclusiveAcross(
  ...vocabularies: readonly Record<string, unknown>[]
): string[][] {
  return vocabularies.map((vocabulary) => {
    const keys = new Set<string>()
    const walk = (value: unknown) => {
      if (typeof value === "string") {
        if (SIMPLE.test(value)) keys.add(value)
      } else if (value !== null && typeof value === "object")
        Object.values(value).forEach(walk)
    }
    for (const [name, value] of Object.entries(vocabulary))
      if (name !== "exclusive") walk(value)
    return [...keys].sort()
  })
}
