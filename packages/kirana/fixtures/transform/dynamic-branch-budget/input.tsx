import { css } from "@kirana-style/core"

export function Many({ a, b }: { a: boolean; b: boolean }) {
  return <p sx={css({ color: a ? "red" : "blue", backgroundColor: b ? "red" : "blue" })} />
}
