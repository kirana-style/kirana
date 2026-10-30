/**
 * Relations. Put the `anchor` on the element whose state is read, and read it
 * from a descendant (`within`) or a sibling (`after`, `before`):
 *
 *   <div data-state="open" sx={[cardMarker.anchor, styles.root]}>
 *   opacity: { base: 0.5, [cardMarker.within('[data-state="open"]')]: 1 }
 *
 * The compiler reports a read with no anchor (`relation-without-anchor`) and a
 * `within` read beside its anchor in one JSX tree (`relation-placement`).
 */

import { relation } from "@kirana-style/core"

/**
 * The unnamed relation, for a bare `peer` or `group`. Prefer a named relation
 * when two relationships could overlap.
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
