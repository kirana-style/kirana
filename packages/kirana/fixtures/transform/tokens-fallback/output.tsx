


import { fade, plain } from "./fade"

// The top edge's depth, else every edge's, else a default: one chain, read on the element.
const TOP = "var(--kveHnr, var(--kvieC4, min(12%, 2.5rem)))"

const reveal = "kfNgVx"

export const region = "k3O_Uxgl k7D_wVRU kT_tkQA k87_yu62 kQ_Tnhh"

// A region sets only the knobs it changes, typed and checked like any token.
export const deep = "k2sckC_ALZU"
export const shallowTop = "kAar3e_KEPB"

// A chain may end in a token, or in another chain.
export const ends = "kZ_9lIr k10_AmXa"

// Through a namespace import as well.
export const inline = "kV_AYXV"

// A token's default may read a chain too; a variable token's default is read on the root.
export const edges = {"top": "var(--kvCDGB)"}

// Outside a style the chain is its text.
export const TOP_TEXT = TOP

// Rejected: a token with a value is never unset, nor is one written in place; the first value is
// not a token; nothing to fall back to; a last value known only at runtime, or not one CSS value;
// an end the property does not take; a chain as a key.
export const always = ""
export const inlined = ""
export const notToken = ""
export const alone = ""
export const runtime = ""
export const several = ""
export const colour = ""
export const assigned = ""
