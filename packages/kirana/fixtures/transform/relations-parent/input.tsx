import { css, relation } from "@kirana-style/core"

const group = relation("field-group")

// shadcn/ui's FieldGroup: a group directly inside another is tighter (`*:data-[slot=field-group]:gap-4`).
const styles = {
  group: css(group.anchor, { gap: { base: "1.75rem", [group.parent()]: "1rem" } }),
  // `*:w-full`: the group's children, not its grandchildren.
  child: css({ width: { [group.parent()]: "100%" }, opacity: { [group.parent(":hover")]: 0.9 } }),
}

export function Good() {
  return (
    <div sx={styles.group}>
      <label sx={styles.child} />
      <div sx={styles.group} />
    </div>
  )
}

export function Bad() {
  return (
    <div sx={group.anchor}>
      <span>
        <label sx={styles.child} />
      </span>
    </div>
  )
}
