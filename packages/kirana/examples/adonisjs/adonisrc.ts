import { defineConfig } from "@adonisjs/core/app"

export default defineConfig({
  commands: [() => import("@adonisjs/core/commands")],
  providers: [
    () => import("@adonisjs/core/providers/app_provider"),
    () => import("@adonisjs/core/providers/edge_provider"),
    () => import("@adonisjs/static/static_provider"),
    // `kirana()` in every Edge template, from the class map `kirana build` writes.
    () => import("@kirana-style/adonis/provider"),
  ],
  preloads: [() => import("#start/routes"), () => import("#start/kernel")],
  metaFiles: [{ pattern: "resources/views/**/*.edge", reloadServer: false }],
})
