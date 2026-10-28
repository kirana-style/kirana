/**
 * JSX types for `sx` on Preact host elements. Reference once, for example from a `.d.ts` in the app:
 *
 *   /// <reference types="@kirana-style/core/preact" />
 *
 * With `jsx: "preact"` (detected from `jsxImportSource`), `sx` compiles to `class`, and
 * `props()` returns `{ class, style }`.
 */
import type { Sx } from "@kirana-style/core"

declare module "preact" {
  namespace JSX {
    // oxlint-disable-next-line no-unused-vars -- `RefType` must match Preact's declaration.
    interface HTMLAttributes<RefType extends EventTarget = EventTarget> {
      sx?: Sx
    }
    // oxlint-disable-next-line no-unused-vars -- `Target` must match Preact's declaration.
    interface SVGAttributes<Target extends EventTarget = SVGElement> {
      sx?: Sx
    }
  }
}

declare module "@kirana-style/core" {
  // `props()` returns `{ class, style }` here (KF-047).
  interface Register {
    classAttribute: "class"
  }
}
