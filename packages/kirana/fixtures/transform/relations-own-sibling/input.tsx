import { css, relation } from "@kirana-style/core"

// A part its caller repeats reads the one beside it: shadcn/ui's `ItemContent` keeps its width
// when it follows another (KF-054).
const content = relation("item-content")
const step = relation("step")

const styles = {
  content: css(content.anchor, { flex: { base: "1 1 0%", [content.after()]: "none" } }),
  step: css(step.anchor, { marginInlineEnd: { base: "0.5rem", [step.before()]: "0" } }),
  hint: css({ color: { [step.after()]: "gray" } }),
}

export function ItemContent() {
  return <div sx={styles.content} />
}

export function Step() {
  return <li sx={styles.step} />
}

export function Hint() {
  return (
    <ol>
      {/* Still an error: the reader does not carry the anchor, and no earlier sibling does. */}
      <li sx={styles.hint} />
      <li sx={styles.step} />
    </ol>
  )
}
