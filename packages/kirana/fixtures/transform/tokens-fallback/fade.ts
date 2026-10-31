import { defineTokens } from "@kirana-style/core"

// A region's knobs: each edge's depth, else the depth of every edge, else a default (KF-081). Each
// starts unset, so a region sets only the ones it changes.
export const fade = defineTokens("fade", {
  size: { syntax: "*" },
  top: { syntax: "*" },
  bottom: { syntax: "*" },
  strength: { syntax: "*" },
  // The depth the mask reads: registered so it animates, and so it always has a value.
  depth: { value: "0px", syntax: "<length-percentage>", inherits: false },
})

export const plain = defineTokens("plain", { gap: "1rem" })
