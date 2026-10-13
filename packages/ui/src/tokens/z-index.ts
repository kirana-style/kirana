/**
 * Stacking order.
 *
 * Layer 1 (primitives). Plain constants: the compiler inlines them, so they
 * emit no CSS and the full Tailwind vocabulary costs nothing to carry here.
 * Only tokens that need to change per theme belong in `theme/semantic.ts`.
 */

export const zIndex = {
  base: "0",
  raised: "10",
  sticky: "20",
  header: "30",
  /** Same layer as `popover`, as shadcn's `z-50`; DOM order stacks them. */
  overlay: "50",
  popover: "50",
  toast: "60",
} as const
