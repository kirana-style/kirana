/**
 * Components and elements take `sx`, never `className`. On an element the
 * compiler turns `sx` into `className` (and `style` for runtime values); a
 * third-party component (Base UI, cmdk) does not read it, so spread
 * `{...styleProps(styles.root, sx)}` into it instead. Put the caller's `sx`
 * last so it overrides the component's defaults.
 */

import type { Sx } from "@kirana-style/core"
import type {} from "@kirana-style/core/react"

/** A style value accepted by any component's `sx` prop: handles, arrays of them, or nothing. */
export type { Sx }

/** Adds `sx` to a component's props, replacing `className`. */
export type WithSx<P> = Omit<P, "className"> & { sx?: Sx }

/**
 * Props for a component that forwards to a DOM element, minus the escape
 * hatches the design system owns.
 */
export type StyleProps = { sx?: Sx }

/**
 * Combines several `sx` values into one, the same as the array `[...values]`;
 * for props built outside JSX, such as `cloneElement`'s.
 */
export function mergeSx(...values: Sx[]): Sx {
  return values
}
