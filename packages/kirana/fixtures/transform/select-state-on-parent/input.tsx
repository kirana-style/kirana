import { css, relation, select } from "@kirana-style/core"

const card = relation("card")

// Reported: the state is the parent's, which the port rarely means.
export const links = css({ [select.child("a")]: { color: { ":hover": "red" } } })
export const icons = css({ [select.descendant("svg")]: { opacity: { ":focus-visible:hover": 1 } } })

// Not reported: the target's own state, an attribute of the parent, a relation read.
export const own = css({ [select.child("a:hover")]: { color: "red" } })
export const open = css({ [select.descendant("svg")]: { rotate: { "[data-open]": "180deg" } } })
export const read = css({ [select.child("a")]: { color: { [card.within(":hover")]: "red" } } })
export const self = css({ color: { ":hover": "red" } })
export const Card = () => <article sx={card.anchor} />
