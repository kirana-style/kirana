// `sx` on React host elements, through the augmentation `@kirana-style/core/react` adds.
/// <reference types="@kirana-style/core/react" />
import { css } from "@kirana-style/core"

const row = css({ display: "flex", gap: "0.5rem" })
const label = css({ fontWeight: 600 })

export function Row({ open }: { open: boolean }) {
  return (
    <div sx={row}>
      <span sx={[label, open && row]}>Label</span>
      <svg sx={label} />
      {/* @ts-expect-error -- a number is not a style. */}
      <i sx={42} />
      <button type="button" sx={[row, null, undefined]}>
        Go
      </button>
    </div>
  )
}
