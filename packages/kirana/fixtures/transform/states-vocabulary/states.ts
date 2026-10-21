// A vocabulary of the project's own: the same shape, for a library that marks state with one
// attribute's values (`data-state="open"`).
export const Dialog = {
  Content: {
    open: '[data-state="open"]',
    closed: '[data-state="closed"]',
  },
} as const
