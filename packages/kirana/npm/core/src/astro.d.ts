/**
 * Template types for `sx` on Astro elements, for `astro check`. Reference once, for example from
 * `src/env.d.ts`:
 *
 *   /// <reference types="@kirana-style/core/astro" />
 */
import type { Sx } from "@kirana-style/core"

declare global {
  namespace astroHTML.JSX {
    interface HTMLAttributes {
      sx?: Sx
    }
    interface SVGAttributes {
      sx?: Sx
    }
  }
}
