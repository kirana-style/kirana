import kirana from "@kirana-style/vite"
import { defineConfig } from "vite"

// Electrobun's templates build the view from src/mainview into dist, which electrobun.config.ts
// copies into the app. They also alias Electrobun's view API from .hutch/devkit, which
// `hutch electrobun prepare` writes; this view imports none of it, so the alias is left out.
export default defineConfig({
  plugins: [kirana()],
  root: "src/mainview",
  build: { outDir: "../../dist", emptyOutDir: true },
  server: { port: 5173, strictPort: true },
})
