import { defineConfig } from "@kirana-style/core/config"
import { uiConfig } from "@workspace/ui/kirana.ts"

export default defineConfig({
  ...uiConfig,
  // The hand-written reset and element styles in @workspace/ui/globals.css sit
  // below every Kirana rule, in development and production alike.
  layers: { before: ["reset", "base"] },
})
