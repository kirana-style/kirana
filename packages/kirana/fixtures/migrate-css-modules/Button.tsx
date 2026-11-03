import clsx from "clsx"
import styles from "./Button.module.css"
import { Icon } from "./Icon"

export function Button({ primary, busy, className }: { primary?: boolean; busy?: boolean; className?: string }) {
  return (
    <button className={clsx(styles.primary, styles.button, className)} data-busy={busy || undefined}>
      <Icon className={styles["icon-only"]} />
      <span className={`label ${primary ? styles.primary : ""}`}>Save</span>
    </button>
  )
}

export const iconOnly = styles["icon-only"]
