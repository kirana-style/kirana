import kirana from "@kirana-style/vite"
import solid from "@solidjs/vite-plugin"
import { defineConfig } from "vite"

export default defineConfig({ plugins: [kirana(), solid()] })
