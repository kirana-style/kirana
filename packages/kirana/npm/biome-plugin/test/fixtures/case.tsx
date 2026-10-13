import clsx from "clsx"
import { cva } from "class-variance-authority"
import { twMerge } from "tailwind-merge"
import cn from "classnames/bind"
import { css, media, recipe, props as styleProps } from "@kirana-style/core"

const styles = { a: css({ color: "red" }) }
// A theme toggle reads the system's preference itself: not a style.
export const system = matchMedia("(prefers-color-scheme: dark)")
export const plain = { "@media (prefers-color-scheme: dark)": 1 }
export const a = css({
  color: { base: "black", "@media (prefers-color-scheme: dark)": "white" },
})
export const b = css({
  color: { [media(`(prefers-color-scheme: dark)`)]: "white" },
})
export const r = recipe({
  base: { color: { "@media (prefers-color-scheme: dark)": "white" } },
})
export const wide = media("(min-width: 40rem)")

export const Wrong = ({ sx }) => (
  <div sx={[sx, styles.a]} className="p-2 dark:bg-black" />
)
export const Middle = (props) => <div sx={[styles.a, props.sx, styles.a]} />
export const Spread = ({ sx }) => <Menu {...styleProps(styles.a, sx, more)} />
export const Conflict = () => (
  <Card className="x" {...styleProps(styles.a)} style={s} />
)
export const Nested = () => (
  <div>
    <Menu {...styleProps(styles.a)} className="y">
      x
    </Menu>
  </div>
)

export const Last = ({ sx }) => <div sx={[styles.a, sx]} />
export const Handed = ({ sx, className }) => (
  <div sx={[styles.a, sx, className]} />
)
export const Spreads = ({ sx }) => <div sx={[sx, ...more]} />
export const Merged = () => (
  <div className="dark" sx={styles.a} title="dark:x" />
)
export const Other = () => <div className="x" {...other(styles.a)} />
export const helpers = [clsx, cva, twMerge, cn]
