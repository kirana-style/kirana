import { renderToString } from "react-dom/server"

import { Probe, styles } from "./probe.tsx"

// Kirana compiled the module before Jest ran it: handles are class strings, and `sx` became the
// class names the application ships.
test("styles compile to class names", () => {
  expect(typeof styles.probe).toBe("string")
  expect(renderToString(<Probe wide={false} />)).toMatch(
    /class="k\w+_\w+( k\S+)*"/
  )
  expect(renderToString(<Probe wide />)).toContain(" kaF_")
})
