import { css } from "@kirana-style/core"
import { breakpoint, DARK } from "./conditions"
import { scrollFade } from "./handles"
import { space } from "./scales"

// A variant naming an export compiles to the atoms the export as a key compiles to (D-115).
export function Exported() {
  return (
    <>
      <p sx="p-1 lg:p-4 lg:hover:p-2 dark:p-2 @md/card:p-1" />
      <p sx={css({ padding: { base: space[1], [breakpoint.lg]: { base: space[4], ":hover": space[2] }, [DARK]: space[2] } })} />
      <p sx="scroll-fade p-1" />
      <p sx={[scrollFade, css({ padding: space[1] })]} />
    </>
  )
}

export function Mistakes() {
  return <p sx="mode-dark:p-1 md:scroll-fade not-a-handle p-2" />
}
