import "@kirana-style/core/stylesheet.css"
import { createRoot } from "react-dom/client"

/**
 * The probe the example runner reads back from the browser, styled with utility strings only: the
 * probe's exact colours in brackets, and scale utilities from the preset around them.
 */
createRoot(document.getElementById("root")!).render(
  <p
    data-probe=""
    sx="text-[rgb(1, 2, 3)] pt-[7px] bg-[rgb(250,250,250)] hover:bg-[rgb(4,5,6)] px-4 rounded-lg font-semibold md:px-6"
  >
    Styled by Kirana.
  </p>
)
