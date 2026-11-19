/**
 * JSX types for `sx` on Solid host elements, Solid 1's and Solid 2's. Reference once, for example
 * from a `.d.ts` in the app:
 *
 *   /// <reference types="@kirana-style/core/solid" />
 *
 * With `jsx: "solid"` (detected from `jsxImportSource`: `solid-js`, or `@solidjs/web` on Solid 2),
 * `sx` compiles to `class`, and `props()` returns `{ class, style }`.
 *
 * Solid 2 moved the JSX namespace to its DOM runtime, `@solidjs/web` (KF-127), so both are
 * augmented here. An app has one of the two: TypeScript skips an augmentation, in a declaration
 * file, of a module it cannot resolve, with or without `skipLibCheck`.
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

// The module `jsxImportSource: "@solidjs/web"` reads its JSX namespace from; `@solidjs/web`'s own
// entry re-exports it.
declare module "@solidjs/web/jsx-runtime" {
  namespace JSX {
    // oxlint-disable-next-line no-unused-vars -- `T` must match Solid's declaration.
    interface ElementAttributes<T> {
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
