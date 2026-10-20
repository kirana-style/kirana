import type { Config } from "vike/types"
import vikeReact from "vike-react/config"

// Prerendered: the build writes `dist/client/index.html`, which the example runner serves.
export default {
  extends: [vikeReact],
  title: "Kirana on Vike",
  prerender: true,
} satisfies Config
