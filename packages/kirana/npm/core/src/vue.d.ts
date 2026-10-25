/**
 * Kirana in Vue: `:sx` typed on HTML and SVG elements for `vue-tsc` and Volar, and `useSx()`, for a
 * component that takes its caller's `:sx`. Reference the types once, for example from a `.d.ts` in the
 * app:
 *
 *   /// <reference types="@kirana-style/core/vue" />
 */
import type { ComputedRef } from "vue"

import type { StyleHandle, Sx } from "@kirana-style/core"

declare module "vue" {
  interface HTMLAttributes {
    sx?: Sx
  }
  interface SVGAttributes {
    sx?: Sx
  }
}

/**
 * A caller's `:sx` on a component, to merge with the component's own styles (KF-019). On a component,
 * `:sx` arrives as the `class` Vue falls through to its root, where Vue would add it beside the root's
 * own classes and leave the stylesheet's order to choose between two values of one property. Turn the
 * fallthrough off and put the caller's styles last in the root's own `:sx`, so Kirana's merge lets
 * them win, property by property:
 *
 *   <script setup lang="ts">
 *   import { useSx } from "@kirana-style/core/vue"
 *   defineOptions({ inheritAttrs: false })
 *   const { sx, attrs } = useSx()
 *   </script>
 *
 *   <template>
 *     <button v-bind="attrs" :sx="[styles.root, sx]"><slot /></button>
 *   </template>
 *
 * `sx` is the caller's classes, typed as the handle `:sx` takes (at runtime, the one class string a
 * compiled handle is, KF-029); `attrs` is every other fallthrough attribute (listeners, `aria-*`, the
 * caller's inline `style`), to bind on the same element.
 */
export declare function useSx(): {
  sx: ComputedRef<StyleHandle | undefined>
  attrs: ComputedRef<Record<string, unknown>>
}
