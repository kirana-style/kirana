import { css, cx } from "@kirana-style/core"

const base = css({ color: "black" })
const active = css({ color: "red" })

export function Meter({ value, tone, on, props, key, extra }: { value: number; tone: "ok" | "warn"; on: boolean; props: { sx?: string }; key: string; extra: object }) {
  return (
    <div>
      <p sx={css({ inlineSize: `${value}%`, color: tone === "ok" ? "green" : "orange" })} />
      <p sx={css({ padding: value, "::after": { width: value, height: { ":hover": value } } })} />
      <p sx={css({ margin: on ? "1px" : `${value}px` })} />
      <p sx={[base, on && active, props.sx, on ? active : null]} />
      <p sx={cx(base, on && active, props.sx)} />
      <p sx={css({ color: on ? css({ color: "red" }) : "blue" })} />
      <p sx={css({ [key]: "red" })} />
      <p sx={css({ ...extra, color: "red" })} />
      <p sx={css(...[base, active])} />
      <p sx={cx(...(on ? [base] : [active]))} />
      <p sx={[...(on ? [base] : []), active]} />
      <p sx={on ? base : props.sx} />
    </div>
  )
}
