import "@kirana-style/core/stylesheet.css"
import { css } from "@kirana-style/core"
import { Probe, space } from "acme-ui"
import { createRoot } from "react-dom/client"

// The same declaration as the library's `paddingTop`: the stylesheet holds it once.
const aside = css({ paddingTop: space.gap })

createRoot(document.getElementById("root")!).render(
  <>
    <Probe>Styled by a library, compiled by the app.</Probe>
    <aside sx={aside} />
  </>
)
