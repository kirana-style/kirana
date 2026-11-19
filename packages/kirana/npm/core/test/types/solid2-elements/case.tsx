// `@kirana-style/core/solid` types `sx` on Solid 2's elements, whose JSX is `@solidjs/web`'s (KF-127).
import { css, props } from "@kirana-style/core"
import { render } from "@solidjs/web"

const root = css({ color: "red" })
render(() => <p sx={[root, false]} />, document.body)
export const own: string | undefined = props(root).class
// @ts-expect-error `sx` takes style handles
export const wrong = <p sx={1} />
