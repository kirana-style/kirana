import kirana from "@kirana-style/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// Storybook's Vite builder reads this file, so stories compile as the app does.
export default defineConfig({ plugins: [kirana(), react()] })
