import type { KiranaConfig } from "@kirana-style/core/config"

/**
 * What every app compiling `@workspace/ui` tells Kirana about the component
 * libraries underneath. Spread into each app's `kirana.config.ts`.
 */
export const uiConfig = {
  conditions: {
    // Attributes Base UI and react-day-picker never set together on one element.
    exclusive: [
      ["[data-starting-style]", "[data-ending-style]"],
      ["[data-open]", "[data-closed]"],
      // A drawer swipes along one axis: x means left or right, y means up or down.
      ['[data-swipe-axis="x"]', '[data-swipe-direction="up"]'],
      ['[data-swipe-axis="x"]', '[data-swipe-direction="down"]'],
      ['[data-swipe-axis="y"]', '[data-swipe-direction="left"]'],
      ['[data-swipe-axis="y"]', '[data-swipe-direction="right"]'],
      // A day is a single selection, or the start, middle or end of a range.
      ['[data-selected-single="true"]', '[data-range-middle="true"]'],
      ['[data-range-start="true"]', '[data-range-middle="true"]'],
      ['[data-range-end="true"]', '[data-range-middle="true"]'],
    ],
  },
} satisfies KiranaConfig
