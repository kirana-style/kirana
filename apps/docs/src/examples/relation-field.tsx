import { useState } from "react"
import { css, relation } from "@kirana-style/core"

// Named once; the anchor and every read refer to it.
const field = relation("field")

const styles = {
  root: css({ display: "grid", gap: "0.5rem", justifyItems: "start" }),
  label: css({
    fontSize: "0.875rem",
    fontWeight: 500,
    opacity: { base: 1, [field.within('[data-disabled="true"]')]: 0.45 },
  }),
  input: css({
    borderRadius: "0.5rem",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "light-dark(oklch(0.87 0 0), oklch(0.35 0 0))",
    paddingInline: "0.75rem",
    paddingBlock: "0.375rem",
  }),
  toggle: css({ fontSize: "0.8125rem", textDecorationLine: "underline" }),
}

export default function RelationField() {
  const [disabled, setDisabled] = useState(false)
  return (
    <div data-disabled={disabled} sx={[field.anchor, styles.root]}>
      <label sx={styles.label} htmlFor="relation-email">
        Email
      </label>
      <input id="relation-email" disabled={disabled} sx={styles.input} />
      <button sx={styles.toggle} onClick={() => setDisabled(!disabled)}>
        {disabled ? "Enable" : "Disable"} the field
      </button>
    </div>
  )
}
