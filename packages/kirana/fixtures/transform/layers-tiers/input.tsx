import { css, relation } from "@kirana-style/core"

// `layers.tiers` (D-114): each tier of the ladder is a sub-layer of `kirana.atoms`, in ladder order,
// so a hover outranks the base by layer order wherever its rule sits. Rules that carry one
// declaration merge within a tier only; the contextual layer stays whole.
const group = relation("group")

export const button = css({
  padding: "8px",
  paddingTop: "4px",
  color: { base: "black", ":hover": "red", ":focus-visible": "blue" },
  backgroundColor: { base: "white", "@media (min-width: 40rem)": "gray", [group.within(":hover")]: "red" },
  "::before": { content: '""' },
  margin: { base: "0", '[data-size="lg"]': "0" },
})

export const card = css({ color: "black", borderColor: { ":hover": "red" } })
