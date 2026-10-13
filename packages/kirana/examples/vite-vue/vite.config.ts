import kirana from "@kirana-style/vite"
import vue from "@vitejs/plugin-vue"
import { defineConfig } from "vite"

export default defineConfig({ plugins: [kirana(), vue()] })
