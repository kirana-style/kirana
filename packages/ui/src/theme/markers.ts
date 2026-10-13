/**
 * Layer 3: relations.
 *
 * Each is the equivalent of one Tailwind named group — the `group/button` class
 * you put on a parent so descendants can react to its state. Apply the anchor
 * to the element whose state is read:
 *
 *   <div data-state="open" sx={[cardMarker.anchor, styles.root]}>
 *
 * and read it from a descendant or sibling:
 *
 *   opacity: {
 *     base: 0.5,
 *     [cardMarker.within('[data-state="open"]')]: 1,
 *   }
 *
 * The mapping from Tailwind: `within` covers `group-*` and `in-*`, `after`
 * covers `peer-*`, `before` reads a later sibling, and `group-has-*` is
 * `within(":has(…)")`. Plain `has-*` needs no relation: write a `":has(…)"`
 * key on the element itself. The relation scopes the relationship, so unrelated
 * components never collide — the job the `/name` suffix did.
 *
 * The anchor always sits on the element whose state is read. The compiler
 * checks it: a read with no anchor anywhere is `relation-without-anchor`, and a
 * `within` read with the anchor beside it in one JSX tree is
 * `relation-placement`.
 *
 * The `…Marker` names are kept from the StyleX port.
 */

import { relation } from "@kirana-style/core"

/**
 * The unnamed relation: the replacement for Tailwind's bare
 * `peer` / `group`. Prefer a named relation when two relationships could overlap.
 */
export const peer = relation("peer")

export const accordionItemMarker = relation("accordionItem")
export const alertDialogContentMarker = relation("alertDialogContent")
export const alertMarker = relation("alert")
export const avatarGroupMarker = relation("avatarGroup")
export const avatarMarker = relation("avatar")
export const bubbleMarker = relation("bubble")
export const calendarDayMarker = relation("calendarDay")
export const cardMarker = relation("card")
export const comboboxContentMarker = relation("comboboxContent")
export const commandItemMarker = relation("commandItem")
export const commandShortcutMarker = relation("commandShortcut")
export const dialogContentMarker = relation("dialogContent")
export const drawerPopupMarker = relation("drawerPopup")
export const dropdownMenuContentMarker = relation("dropdownMenuContent")
export const fieldLabelMarker = relation("fieldLabel")
export const fieldMarker = relation("field")
export const inputGroupMarker = relation("inputGroup")
export const itemMarker = relation("item")
export const markerRowMarker = relation("markerRow")
export const menuActionMarker = relation("menuAction")
export const menuButtonMarker = relation("menuButton")
export const menuItemMarker = relation("menuItem")
export const messageMarker = relation("message")
export const navigationMenuItemMarker = relation("navigationMenuItem")
export const popoverContentMarker = relation("popoverContent")
export const questionnaireOptionMarker = relation("questionnaireOption")
export const sidebarMarker = relation("sidebar")
export const switchMarker = relation("switch")
export const tabsListMarker = relation("tabsList")
export const tabsMarker = relation("tabs")
export const tooltipContentMarker = relation("tooltipContent")
