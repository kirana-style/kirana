import "@kirana-style/core/stylesheet.css"
import DefaultTheme from "vitepress/theme"
import type { Theme } from "vitepress"

import Probe from "./Probe.vue"

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component("Probe", Probe)
  },
} satisfies Theme
