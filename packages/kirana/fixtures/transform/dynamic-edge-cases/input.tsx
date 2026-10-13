import { css, cx, props as styleProps, relation, select } from "@kirana-style/core"

const group = relation("group")
const media = "@media (width >= 48rem)"
const handle = css({ color: "red" })

export function Edge({ on, value, list }: { on: boolean; value: string; list: string[] }) {
  return (
    <div sx={group.anchor}>
      <p sx={css({ color: { [media]: on ? "red" : value } })} />
      <p sx={css({ color: { [group.within()]: value } })} />
      <p sx={css({ [select.descendant("svg")]: { width: value } })} />
      <p sx={css({ color: on ? handle : "red" })} />
      <p sx={css({ color: { [on ? ":hover" : ":focus"]: "red" } })} />
      <p sx={css({ color: { ":hover": { [select.child("a")]: "red" } } })} />
      <p sx={css({ color: { [group.anchor as never]: "red" } })} />
      <p sx={cx(on ? [handle] : null)} />
      <p sx={cx(on ? list : handle)} />
      <p sx={styleProps(...list)} />
      <p sx={on && [handle, value]} />
      <p sx={css({ color: `${value}` })} />
      <p sx={[on ? handle : false, on || handle, value && handle]} />
    </div>
  )
}
export const conditionalValue = css({ color: true ? "red" : "blue", backgroundColor: false ? "red" : "blue" })
export const nestedCss = css({ color: cx(handle) as never })
