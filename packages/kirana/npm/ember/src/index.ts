/**
 * `sx` for Ember templates (D-072): `class={{sx styles.card (if this.active styles.on)}}` merges the
 * handles with Kirana's runtime, later ones winning. A handle's runtime custom properties cannot
 * travel in a class; set them from the component's code, as the
 * [Ember guide](https://kirana.style/docs/frameworks/ember) shows.
 */
import { runtime } from "@kirana-style/core/internal"
import type { Handle } from "@kirana-style/core/internal"

/** A merge helper for another class-name prefix (`names.prefix`). */
export function createSx(prefix: string): (...handles: Handle[]) => string {
  const kirana = runtime(prefix, "class")
  return (...handles) => kirana.sx(handles, [], []).class ?? ""
}

/** The merge helper for the default prefix, `k`. */
export const sx = createSx("k")
