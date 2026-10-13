import { pluginKirana } from "@kirana-style/rspack"
import { defineConfig } from "@rsbuild/core"
import { pluginReact } from "@rsbuild/plugin-react"

export default defineConfig({
  plugins: [pluginReact(), pluginKirana()],
})
