/**
 * A recipe maps variant props onto compiled styles. It selects from lookup
 * tables and never builds a style object, so nothing is computed at render time.
 *
 *   export const button = recipe({
 *     base: styles.base,
 *     variants: { size: { sm: styles.sm, md: styles.md } },
 *     defaults: { size: "md" },
 *   })
 *
 *   <button sx={[...button({ size }), sx]} />
 *
 * Boolean variants key on `"true"` / `"false"`. There are no compound
 * variants: append a conditional style (`isActive && styles.active`) instead.
 */

import type { Sx } from "@kirana-style/core"

type Style = Sx

/** A map of variant name → option name → style. */
export type VariantMap = {
  readonly [group: string]: { readonly [option: string]: Style }
}

/** The props a recipe accepts: one optional key per variant group. */
export type RecipeProps<V extends VariantMap> = {
  readonly [G in keyof V]?: keyof V[G]
}

export type RecipeConfig<V extends VariantMap> = {
  /** Always applied, before any variant. */
  readonly base?: Style
  readonly variants: V
  /** Used for any group the caller leaves undefined. */
  readonly defaults?: RecipeProps<V>
}

export type Recipe<V extends VariantMap> = {
  (props?: RecipeProps<V>): Style[]
  /** The underlying tables, for components that need one group in isolation. */
  readonly variants: V
  readonly defaults: RecipeProps<V>
}

export function recipe<const V extends VariantMap>(
  config: RecipeConfig<V>
): Recipe<V> {
  const { base, variants, defaults = {} as RecipeProps<V> } = config
  const groups = Object.keys(variants) as (keyof V)[]

  function resolve(props: RecipeProps<V> = {}): Style[] {
    const styles: Style[] = base ? [base] : []

    for (const group of groups) {
      const option = props[group] ?? defaults[group]
      if (option == null) continue
      const style = variants[group]![option as string]
      if (style) styles.push(style)
    }

    return styles
  }

  return Object.assign(resolve, { variants, defaults })
}

/** The variant props of a recipe, for composing into a component's props. */
export type VariantProps<R extends Recipe<VariantMap>> = RecipeProps<
  R["variants"]
>
