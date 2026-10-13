import kirana from "@kirana-style/vite"

export default defineNuxtConfig({
  css: ["@kirana-style/core/stylesheet.css"],
  vite: { plugins: [kirana()] },
})
