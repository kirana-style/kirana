import analog from "@analogjs/platform"
import { kiranaAngular } from "@kirana-style/angular/vite"
import { defineConfig } from "vite"

// Kirana after Analog: Angular compiles each file from disk, and Kirana compiles what it emitted.
export default defineConfig({
  build: { target: ["es2022"] },
  resolve: { mainFields: ["module"] },
  plugins: [
    analog({ ssr: false, static: true, prerender: { routes: [] } }),
    kiranaAngular(),
  ],
})
