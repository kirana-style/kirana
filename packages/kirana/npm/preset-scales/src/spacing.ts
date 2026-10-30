/**
 * Any step of Tailwind CSS v4's spacing, a quarter of a rem per unit, including the steps `space`
 * does not name (`pl-9.5`, KF-013). The compiler folds a call with a known argument.
 *
 *   css({ paddingInlineStart: spacing(9.5) }) // 2.375rem
 */
export function spacing(n: number): string {
  return n === 0 ? "0px" : `${n * 0.25}rem`
}
