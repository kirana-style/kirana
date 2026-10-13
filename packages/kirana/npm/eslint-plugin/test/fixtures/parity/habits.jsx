import clsx from "clsx"
import { css, media } from "@kirana-style/core"

export const scheme = css({
  color: { base: "black", [media("(prefers-color-scheme: dark)")]: "white" },
})

export const Leftover = () => <div className={clsx("p-2 dark:bg-black")} />
export const Tailwind = () => <div className="p-2 dark:bg-black" />
