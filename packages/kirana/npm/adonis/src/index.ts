/**
 * Kirana for AdonisJS (D-069): Edge templates name the handles a server app's style modules export,
 * `{{ kirana('card', active && 'card.active') }}`, and get their merged classes from the class map
 * `kirana-style build` and `kirana-style dev` write. Register the provider in `adonisrc.ts`:
 *
 *   providers: [() => import("@kirana-style/adonis/provider")]
 *
 * The class map is read from `config/kirana.ts`'s `classes`, by default `public/kirana/classes.json`.
 */
import type { Edge } from "edge.js"

import { classMap } from "@kirana-style/core/class-map"
import type { StyleName } from "@kirana-style/core/class-map"

/** Adds the `kirana(...names)` global to an Edge instance, reading the class map at `file`. */
export function registerKirana(edge: Edge, file: string): void {
  edge.global("kirana", (...names: StyleName[]) =>
    classMap(file).classes(...names)
  )
}
