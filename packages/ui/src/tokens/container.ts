/**
 * Container query conditions, Tailwind's `@container` sizes.
 *
 * Each value is the full at-rule as a condition key, so the named containers
 * this design system uses get their own entries rather than a
 * `container.md("field-group")` helper.
 *
 * Layer 1 (primitives). Plain constants: the compiler inlines them, so they
 * emit no CSS and the full Tailwind vocabulary costs nothing to carry here.
 */

/** Unnamed container queries, matching the nearest container ancestor. */
export const container = {
  xs: "@container (min-width: 20rem)",
  sm: "@container (min-width: 24rem)",
  md: "@container (min-width: 28rem)",
  lg: "@container (min-width: 32rem)",
  xl: "@container (min-width: 36rem)",
  "2xl": "@container (min-width: 42rem)",
} as const

/** Named containers declared by `Field`/`FieldGroup` and `CardHeader`. */
export const containerName = {
  fieldGroup: "field-group",
  cardHeader: "card-header",
} as const

export const fieldGroupQuery = {
  md: "@container field-group (min-width: 28rem)",
} as const

export const cardHeaderQuery = {
  sm: "@container card-header (min-width: 24rem)",
} as const
