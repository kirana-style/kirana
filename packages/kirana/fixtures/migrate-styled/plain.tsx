import { css, cx } from "@emotion/css"

const row = css`
  display: flex;
  gap: 4px;
`
const strong = css({ fontWeight: 700 })

export function Row({ on }: { on: boolean }) {
  return (
    <div className={cx(row, on && strong)}>
      <span className={css`color: #71717a;`}>Label</span>
    </div>
  )
}
