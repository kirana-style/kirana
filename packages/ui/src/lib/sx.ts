/**
 * Style-prop plumbing. Replaces the old `cn` re-export.
 *
 * Under Tailwind, every component took `className?: string` and merged it with
 * `cn`, which had to understand Tailwind's utility families to resolve
 * conflicts. Kirana merges by longhand and condition, so a caller's override is
 * unambiguous.
 *
 * Components therefore take `sx` instead of `className`, and so do elements:
 *
 * - On a lowercase element, the Kirana compiler turns `sx` into `className`
 *   (and `style` for runtime values), merged with any `className` or `style`
 *   the element also receives.
 * - On one of this package's components, `sx` is a plain prop the component
 *   passes on to its root element.
 * - A third-party component (Base UI, cmdk) does not read `sx`; spread
 *   `{...styleProps(styles.root, sx)}` into it instead. The compiler reports
 *   `sx-on-external-component` otherwise.
 *
 * Put the caller's `sx` last, so it overrides the component's defaults:
 *
 *   <div sx={[styles.base, variantStyles[variant], sx]} />
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
 * Combines several `sx` values into one.
 *
 * Equivalent to the array `[...values]`, which `sx` accepts directly on both
 * elements and components. Kept for call sites that read better as a call,
 * such as `cloneElement` props built outside JSX.
 */
export function mergeSx(...values: Sx[]): Sx {
  return values
}
