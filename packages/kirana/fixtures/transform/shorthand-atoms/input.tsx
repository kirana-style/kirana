import { css } from "@kirana-style/core"

// One component: one shorthand atom per box family (D-045).
export const box = css({
  padding: "1rem",
  gap: { base: "0.5rem", ":hover": "1rem" },
  borderRadius: "var(--radius)",
  overflow: "hidden",
})

// A later longhand keeps the atom and wins at ladder step 5; several components expand as before.
export const override = css(box, { paddingTop: 0, margin: "1px 2px" })

// A removal unfolds the atom into the longhands it keeps; the stylesheet gets their rules.
export const removed = css({ paddingTop: null, gap: { ":hover": null } })

// Not a family: `border` stays one atom with explicit tombstones; `borderTop` is secondary.
export const border = css({ border: "var(--line)", borderTop: "var(--top)" })

// A family Lightning CSS does not split, and a runtime value.
export function Panel({ size, sx }: { size: string; sx?: string }) {
  return (
    <div
      sx={[
        box,
        css({ overscrollBehavior: "contain none", inset: `${size}px` }),
        css({ padding: { "*": null } }),
        sx,
      ]}
    />
  )
}
