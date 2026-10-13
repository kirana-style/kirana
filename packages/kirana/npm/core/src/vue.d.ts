/**
 * Template types for `:sx` on Vue elements, for `vue-tsc` and Volar. Reference once, for example from
 * a `.d.ts` in the app:
 *
 *   /// <reference types="@kirana-style/core/vue" />
 */
import type { Sx } from "@kirana-style/core"

declare module "vue" {
  interface HTMLAttributes {
    sx?: Sx
  }
  interface SVGAttributes {
    sx?: Sx
  }
}
