// Objects whose key, or a spread in them, is decided at runtime, in a module of their own.
const side = Math.random() > 0.5 ? "left" : "right"
const extra = Math.random() > 0.5 ? { color: "red" } : {}

export const parts = { display: "grid", [side]: 0 }
export const spreadParts = { display: "grid", ...extra }
