/**
 * JSX types for `sx` on Qwik host elements. Reference once, for example from a `.d.ts` in the app:
 *
 *   /// <reference types="@kirana-style/core/qwik" />
 *
 * With `jsx: "qwik"` (detected from `jsxImportSource`), `sx` compiles to `class`, and `props()`
 * returns `{ class, style }`. Qwik declares its element attributes in `@qwik.dev/core/internal` and
 * re-exports them, so that is the module the augmentation names.
 */
import type { Sx } from "@kirana-style/core"

declare module "@qwik.dev/core/internal" {
  // oxlint-disable-next-line no-unused-vars -- `EL` must match Qwik's declaration.
  interface DOMAttributes<EL extends Element> {
    sx?: Sx
  }
}

declare module "@kirana-style/core" {
  // `props()` returns `{ class, style }` here (KF-047).
  interface Register {
    classAttribute: "class"
  }
}
