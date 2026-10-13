import type { Sx } from "@kirana-style/core"

export const Button = ({ sx, label }: { sx?: Sx; label: string }) => (
  <button sx={sx}>{label}</button>
)
