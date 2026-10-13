/**
 * Template types for `sx` on Svelte elements, for `svelte-check`. Reference once, for example from a
 * `.d.ts` in the app:
 *
 *   /// <reference types="@kirana-style/core/svelte" />
 */
import type { Sx } from "@kirana-style/core"

declare module "svelte/elements" {
  // oxlint-disable-next-line no-unused-vars -- `T` must match Svelte's declaration.
  interface HTMLAttributes<T extends EventTarget> {
    sx?: Sx
  }
  // oxlint-disable-next-line no-unused-vars -- `T` must match Svelte's declaration.
  interface SVGAttributes<T extends EventTarget> {
    sx?: Sx
  }
}
