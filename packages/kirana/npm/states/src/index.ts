/**
 * `@kirana-style/states`: what holds across the library vocabularies (`./base-ui`, `./ark-ui`,
 * `./react-aria`, `./reka-ui`, `./bits-ui`, `./ng-primitives`, `./ui-sdk`, `./kirana-ui`).
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
 * Each vocabulary is every state selector its library's parts declare, sorted. A vocabulary is a
 * module of components (its capitalised exports) beside its `exclusive` groups, as this package's
 * vocabularies are, and as a library that publishes its own in that shape is
 * (`@kirana-ui/vocabulary/keys`, KF-119).
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
      if (/^[A-Z]/.test(name)) walk(value)
    return [...keys].sort()
  })
}

/**
 * Both conditions a set of vocabularies gives the compiler, so a configuration lists the
 * vocabularies its components are built on rather than their pairs (KF-121): each vocabulary's
 * `exclusive` groups once, and, from two vocabularies up, `exclusiveAcross`:
 *
 *   import * as baseUi from "@kirana-style/states/base-ui"
 *   import * as kiranaUi from "@kirana-style/states/kirana-ui"
 *   import { conditionsOf } from "@kirana-style/states"
 *
 *   export default defineConfig({ conditions: conditionsOf(baseUi, kiranaUi) })
 *
 * Two vocabularies that share attribute names (Kirana UI Primitives writes Base UI's, its
 * `sharesNamesWith`) stay two: each lists what its library writes, and a key both write is held
 * together by both, so nothing they share is taken as exclusive.
 */
export function conditionsOf(
  ...vocabularies: readonly Record<string, unknown>[]
): { exclusive: string[][]; exclusiveAcross?: string[][] } {
  const exclusive = new Map<string, string[]>()
  for (const vocabulary of vocabularies)
    for (const group of (vocabulary.exclusive ?? []) as string[][])
      exclusive.set(JSON.stringify(group), [...group])
  return {
    exclusive: [...exclusive.values()],
    ...(vocabularies.length > 1
      ? { exclusiveAcross: exclusiveAcross(...vocabularies) }
      : {}),
  }
}
