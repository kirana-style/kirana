import { css, relation } from "@kirana-style/core"

// A registry item's shared module: Field anchors this relation and a select reads it, and either may
// be installed without the other. With no Field, the read never matches (KF-037).
const fieldScope = relation("field", { optional: true })
export const fillInField = css({
  width: { [fieldScope.parent('[data-orientation="vertical"]')]: "100%" },
})

// Tooltip anchors this one for a Kbd to read, and is installed without it: no reader, and no
// `relation-unused` (KF-067). One declared required and never read is still reported.
const tooltipScope = relation("tooltip", { optional: true })
const lonely = relation("lonely")
export const Tooltip = () => <div sx={[tooltipScope.anchor, lonely.anchor]} />

// Declared required, or with nothing said: read without an anchor, still an error.
const required = relation("required", { optional: false })
const plain = relation("plain", {})
export const strict = css({ color: { [required.within()]: "red" }, backgroundColor: { [plain.after()]: "blue" } })

// Options a relation does not take.
export const wrong = relation("wrong", { optional: "yes" })
export const unknown = relation("unknown", { lazy: true })
export const extra = relation("extra", { optional: true }, 1)
