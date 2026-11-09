import react from "@astrojs/react"
import kirana from "@kirana-style/astro"
import { defineConfig } from "astro/config"

// Kirana ahead of React, so an island reaches React's compiler with `sx` already a class.
export default defineConfig({ integrations: [kirana(), react()] })
