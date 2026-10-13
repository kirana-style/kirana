/**
 * JSX types for `sx` on Solid host elements. Reference once, for example from a `.d.ts` in the app:
 *
 *   /// <reference types="@kirana-style/core/solid" />
 *
 * With `jsx: "solid"` (detected from `jsxImportSource`), `sx` compiles to `class`.
 */
import type { Sx } from "@kirana-style/core"

declare module "solid-js" {
  namespace JSX {
    // oxlint-disable-next-line no-unused-vars -- `T` must match Solid's declaration.
    interface DOMAttributes<T> {
      sx?: Sx
    }
  }
}
