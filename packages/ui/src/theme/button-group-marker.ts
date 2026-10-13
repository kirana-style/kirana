/**
 * The button group's relation, in a module of its own.
 *
 * `Button` reads it (a grouped button loses its own radius), but only
 * `ButtonGroup` applies the anchor. A build checks a relation only when it
 * compiled the module that declares it (D-062), and the import disappears with
 * the styles that use it — so declared here, it enters an application's build
 * only when the application renders a `ButtonGroup`. Declared among the shared
 * markers, every application using `Button` alone failed its build.
 */
import { relation } from "@kirana-style/core"

export const buttonGroupMarker = relation("buttonGroup")
