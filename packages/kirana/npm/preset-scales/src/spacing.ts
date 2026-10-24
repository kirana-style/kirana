/**
 * Any step of Tailwind CSS v4's spacing, `calc(var(--spacing) * n)`, as the preset's `space` writes it:
 * a quarter of a rem per unit (KF-013). `space` names the steps Tailwind lists; shadcn/ui also uses
 * steps between them (`pl-9.5`, `py-0.75`), which this gives without a literal:
 *
 *   css({ paddingInlineStart: spacing(9.5) }) // 2.375rem
 *
 * The compiler folds a call whose argument it knows into the value, so it costs nothing at runtime;
 * one with a runtime argument runs as a plain function.
 */
export function spacing(n: number): string {
  return n === 0 ? "0px" : `${n * 0.25}rem`
}
