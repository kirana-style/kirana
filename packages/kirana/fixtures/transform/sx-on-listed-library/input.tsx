import { css } from "@kirana-style/core"
// `@acme/ds` is listed in `libraries`, so its components are the application's to compile and
// read `sx`; `@acme/ds-icons` only shares the start of its name, and `menu-lib` is not listed.
import { Button, Menu } from "@acme/ds"
import { Icon } from "@acme/ds-icons"
import { Popup } from "menu-lib"

const wide = css({ width: "100%" })
export function App() {
  return (
    <>
      <Button sx={wide} />
      <Menu sx={wide} />
      <Icon sx={wide} />
      <Popup sx={wide} />
    </>
  )
}
