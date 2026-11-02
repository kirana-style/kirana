import { css } from "@kirana-style/core"

import { Card, Inset, Loose, Panel } from "./card"

// KF-083: one logical axis keeps to its logical sides, so Card's paddingTop and paddingBottom still
// win over this paddingBlock: reported here.
export const Cleared = () => <Card sx={css({ paddingBlock: { "*": null, base: 0 } })} />
export const Set = () => <Panel sx={css({ paddingBlockStart: "4px" })} />
// The other way round: Inset's paddingInlineStart sets fewer longhands than this padding.
export const Reset = () => <Inset sx={css({ padding: 0 })} />

// Not reported: the physical sides themselves, a logical axis Card writes logically too, a value only
// known at runtime, and a component whose own styles are only known at runtime.
export const Physical = () => <Card sx={css({ paddingTop: 0, paddingBottom: 0 })} />
export const Inline = () => <Card sx={css({ paddingInline: 0 })} />
export const Runtime = ({ size }: { size: string }) => <Card sx={css({ paddingBlock: size })} />
export const Unknown = ({ tone }: { tone: never }) => <Loose tone={tone} sx={css({ paddingBlock: 0 })} />
export const Empty = () => <Card sx />
// The caller's own mixed sides are its own report, not Card's.
export const Own = () => <Card sx={css({ paddingTop: "1px", paddingBlockStart: "2px" })} />
