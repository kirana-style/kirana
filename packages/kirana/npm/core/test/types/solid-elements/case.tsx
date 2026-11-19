// `@kirana-style/core/solid` types `sx` on Solid 1's elements, whose JSX is `solid-js`'s.
import { css } from "@kirana-style/core"
import { render } from "solid-js/web"

const root = css({ color: "red" })
render(() => <p sx={[root, false]} />, document.body)
// @ts-expect-error `sx` takes style handles
export const wrong = <p sx={1} />
