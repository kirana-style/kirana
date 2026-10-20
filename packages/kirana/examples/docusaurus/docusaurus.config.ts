import type { Config, Plugin } from "@docusaurus/types"
import { KiranaPlugin } from "@kirana-style/webpack"

/**
 * Kirana's webpack plugin, added to every bundle Docusaurus builds: the browser's and the server
 * render's, which share one compiler session, so a class name is the same in the HTML and in the
 * browser. Its loader runs ahead of Docusaurus's own, so it reads `sx` before JSX is compiled.
 */
function kirana(): Plugin {
  return {
    name: "kirana",
    configureWebpack() {
      return { plugins: [new KiranaPlugin()] }
    },
  }
}

export default {
  title: "Kirana on Docusaurus",
  url: "https://example.com",
  baseUrl: "/",
  presets: [["classic", { docs: false, blog: false }]],
  plugins: [kirana],
} satisfies Config
