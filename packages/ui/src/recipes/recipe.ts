/**
 * Layer 4: recipes. The replacement for `class-variance-authority`.
 *
 * A recipe maps variant props onto styles the compiler already turned into
 * class strings. It selects from lookup tables — it never builds a style
 * object, so nothing is computed at render time.
 *
 *   const styles = {
 *     base: css({ ... }),
 *     primary: css({ ... }),
 *     sm: css({ ... }),
 *   }
 *
 *   export const button = recipe({
 *     base: styles.base,
 *     variants: {
 *       variant: { primary: styles.primary, ghost: styles.ghost },
 *       size: { sm: styles.sm, md: styles.md },
 *     },
 *     defaults: { variant: "primary", size: "md" },
 *   })
 *
 *   <button sx={[...button({ variant, size }), sx]} />
 *
 * Boolean variants work by keying on `"true"` / `"false"`. Compound variants
 * are intentionally absent: appending a conditional style
 * (`isActive && styles.active`) covers the cases cva needed
 * `compoundVariants` for.
 *
 * Kirana's own `recipe()` can express all of this. This helper predates the
 * port and stays because components read `button.variants` directly; moving
 * to `recipe()` is tracked with the StyleX-to-Kirana follow-up.
 */

import type { Sx } from "@kirana-style/core"

/**
 * Any `sx` value: a compiled handle, an array of them, or nothing.
 */
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
