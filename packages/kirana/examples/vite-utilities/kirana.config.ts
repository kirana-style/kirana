import { defineConfig } from "@kirana-style/core/config"
import scales from "@kirana-style/preset-scales/preset"

// The preset's utility grammar: Tailwind v4's names over its scales, for string `sx`.
export default defineConfig({ presets: [scales()] })
