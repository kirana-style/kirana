/**
 * How a card answers the pointer: it lifts on a soft shadow, its border unchanged. A coloured border
 * on hover read as cheap; the shadow is the one hover every card shares. Dark mode takes a deeper
 * shadow, since a light one vanishes on ink.
 */
export const LIFT =
  "0 1px 2px light-dark(rgb(0 0 0 / 0.04), rgb(0 0 0 / 0.4)), 0 12px 32px -12px light-dark(rgb(0 0 0 / 0.18), rgb(0 0 0 / 0.75))"

/** The card's own shadow at rest, so the change is a transition, not a jump. */
export const REST = "0 0 0 0 transparent"
