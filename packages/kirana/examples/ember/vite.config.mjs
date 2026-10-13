import { kiranaEmber } from "@kirana-style/ember/vite"
import { classicEmberSupport, ember, extensions } from "@embroider/vite"
import { babel } from "@rollup/plugin-babel"
import { defineConfig } from "vite"

// Kirana last: it compiles the JavaScript Embroider emits for each module, `.gjs` included.
export default defineConfig({
  plugins: [
    classicEmberSupport(),
    ember(),
    babel({ babelHelpers: "runtime", extensions }),
    kiranaEmber(),
  ],
})
