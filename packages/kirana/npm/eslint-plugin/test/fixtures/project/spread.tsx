import type { Sx } from "@kirana-style/core"

export function Spread({ sx, ...props }: { sx?: Sx; title?: string }) {
  return <span sx={sx} {...props} />
}
