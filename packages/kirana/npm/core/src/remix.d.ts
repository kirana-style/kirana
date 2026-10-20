/**
 * JSX types for `sx` on Remix 3's host elements. Reference once, for example from a `.d.ts` in the
 * app:
 *
 *   /// <reference types="@kirana-style/core/remix" />
 */
import type { Sx } from "@kirana-style/core"

declare module "@remix-run/component" {
  // oxlint-disable-next-line no-unused-vars -- `eventTarget` must match Remix's declaration.
  interface HostProps<eventTarget extends EventTarget> {
    sx?: Sx
  }
}
