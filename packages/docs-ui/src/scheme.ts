import { relation } from "@kirana-style/core"

/**
 * The colour scheme the site shows, readable by anything under `<html>`: the app applies
 * `schemeMarker.anchor` to its root element with `data-mode="light" | "dark" | "system"`. It is for
 * what `light-dark()` cannot switch — an image per scheme, as a brand logo has.
 */
export const schemeMarker = relation("scheme")
