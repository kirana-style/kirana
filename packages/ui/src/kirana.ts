import type { KiranaConfig } from "@kirana-style/core/config"

/**
 * What every app compiling `@workspace/ui` tells Kirana about the component
 * libraries underneath. Spread into each app's `kirana.config.ts`.
 */
export const uiConfig = {
  conditions: {
    // Attributes Base UI never sets together on one element.
    exclusive: [
      ["[data-starting-style]", "[data-ending-style]"],
      ["[data-open]", "[data-closed]"],
    ],
  },
} satisfies KiranaConfig
