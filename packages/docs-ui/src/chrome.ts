/**
 * The heights of the docs chrome, for everything that sits under it: the sticky sidebar and
 * table of contents, and the headings a link scrolls to.
 */

/** The bar: the logo, the search and the actions. */
export const BAR = "3.5rem"

/** The tab row under the bar, from lg up; below lg the tabs are in the menu sheet. */
export const TABS = "2.75rem"

/** Everything sticky at the top from lg up: the bar and the tab row. */
export const DOCS_CHROME = `calc(${BAR} + ${TABS})`
