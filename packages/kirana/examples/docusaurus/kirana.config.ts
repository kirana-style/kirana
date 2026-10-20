import { defineConfig } from "@kirana-style/core/config"

// Docusaurus's webpack aliases, which Node.js resolution cannot follow: imports from them are
// runtime values (a theme component, a client API), without an `unresolved-import` warning.
export default defineConfig({
  externals: [
    "@theme/",
    "@theme-original/",
    "@theme-init/",
    "@site/",
    "@generated/",
    "@docusaurus/",
  ],
})
