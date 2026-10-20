import kirana from "@kirana-style/vite"
import { solidStart } from "@solidjs/start/config"
import { nitro } from "nitro/vite"
import { defineConfig } from "vite"

// Kirana before SolidStart, so routes reach Solid's compiler with `sx` already a class.
export default defineConfig({
  plugins: [kirana(), solidStart(), nitro()],
})
