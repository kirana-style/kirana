/**
 * JSX types for `sx` on host elements. Reference once, for example from a `.d.ts` in the app:
 *
 *   /// <reference types="@kirana-style/core/react" />
 */
import type { Sx } from "@kirana-style/core"

declare module "react" {
  // oxlint-disable-next-line no-unused-vars -- `T` must match React's declaration.
  interface HTMLAttributes<T> {
    sx?: Sx
  }
  // oxlint-disable-next-line no-unused-vars -- `T` must match React's declaration.
  interface SVGAttributes<T> {
    sx?: Sx
  }
}
