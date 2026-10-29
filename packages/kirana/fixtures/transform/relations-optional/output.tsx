

// A registry item's shared module: Field anchors this relation and a select reads it, and either may
// be installed without the other. With no Field, the read never matches (KF-037).
const fieldScope = {"name": "field", "anchor": "krMLjf"}
export const fillInField = "kaF-izCk_yp7g"

// Tooltip anchors this one for a Kbd to read, and is installed without it: no reader, and no
// `relation-unused` (KF-067). One declared required and never read is still reported.
const tooltipScope = {"name": "tooltip", "anchor": "krBwfW"}
const lonely = {"name": "lonely", "anchor": "krPbxo"}
export const Tooltip = () => <div className="krBwfW krPbxo" />

// Declared required, or with nothing said: read without an anchor, still an error.
const required = {"name": "required", "anchor": "krXKDV"}
const plain = {"name": "plain", "anchor": "krKoKJ"}
export const strict = "k50-CfE0_D9ur k44-DUh8_LB88"

// Options a relation does not take.
export const wrong = undefined
export const unknown = undefined
export const extra = undefined
