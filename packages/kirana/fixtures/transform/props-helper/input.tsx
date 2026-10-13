import { css, props as styleProps } from "@kirana-style/core"

const root = css({ display: "flex" })
const removed = css({ display: null })

export function Primitive({ sx, on }: { sx?: string; on: boolean }) {
  return [
    styleProps(root),
    styleProps(removed),
    styleProps(),
    styleProps(root, on && css({ width: `${Number(on)}px` }), sx, "foreign"),
  ]
}
