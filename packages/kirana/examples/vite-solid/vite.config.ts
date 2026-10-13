import kirana from "@kirana-style/vite"
import { defineConfig } from "vite"
import solid from "vite-plugin-solid"

export default defineConfig({ plugins: [kirana(), solid()] })
