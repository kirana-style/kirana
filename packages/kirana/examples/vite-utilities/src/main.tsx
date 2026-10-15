import "@kirana-style/core/stylesheet.css"
import { space } from "@kirana-style/preset-scales"
import { createRoot } from "react-dom/client"

/**
 * The probe the example runner reads back from the browser, styled with utility strings only: the
 * probe's exact colours in brackets, and scale utilities from the preset around them. It also
 * reads one of the preset's tokens at runtime, so the preset's own module runs in the browser:
 * installed from npm, it must be compiled, or its `defineTokens()` throws and the page is empty.
 */
createRoot(document.getElementById("root")!).render(
  <p
    data-probe=""
    data-space={String(space[4])}
    sx="text-[rgb(1, 2, 3)] pt-[7px] bg-[rgb(250,250,250)] hover:bg-[rgb(4,5,6)] px-4 rounded-lg font-semibold md:px-6"
  >
    Styled by Kirana.
  </p>
)
