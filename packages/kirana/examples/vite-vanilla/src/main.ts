import "@kirana-style/core/stylesheet.css"
import { css, cx } from "@kirana-style/core"

/**
 * No framework: a handle is a class string, and `cx` merges handles into one (KRN-INT-004). Web
 * components and server templates use them the same way.
 */
const styles = {
  probe: css({
    color: "rgb(1, 2, 3)",
    paddingTop: "7px",
    backgroundColor: { base: "rgb(250, 250, 250)", ":hover": "rgb(4, 5, 6)" },
  }),
  quiet: css({ opacity: 1 }),
}

const probe = document.createElement("p")
probe.dataset.probe = ""
probe.className = String(cx(styles.probe, styles.quiet))
probe.textContent = "Styled by Kirana."
document.getElementById("root")!.append(probe)
