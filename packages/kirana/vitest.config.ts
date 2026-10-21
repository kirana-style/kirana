import { fileURLToPath } from "node:url"

import kirana from "@kirana-style/vite"
import { defineConfig } from "vite-plus"

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      include: ["npm/*/src/**/*.ts", "editors/vscode/src/**/*.ts"],
      exclude: ["**/*.d.ts"],
      reporter: ["text", "lcov"],
      thresholds: {
        lines: 100,
        statements: 100,
        functions: 100,
        branches: 100,
      },
    },
    projects: [
      {
        test: {
          name: "packages",
          include: [
            "npm/{core,compiler,rolldown,vite,webpack,rspack,bun,astro,esbuild,jest,remix,eslint-plugin,biome-plugin,postcss,next,angular,adonis,ember,parcel-transformer,gatsby}/test/**/*.test.ts",
            "scripts/test/**/*.test.ts",
          ],
        },
      },
      // The VS Code extension, against a recorded `vscode` API; `test/e2e` runs it in VS Code.
      {
        resolve: {
          alias: {
            vscode: fileURLToPath(
              new URL("editors/vscode/test/unit/vscode.ts", import.meta.url)
            ),
          },
        },
        test: {
          name: "vscode",
          include: ["editors/vscode/test/unit/**/*.test.ts"],
        },
      },
      // Presets are compiled by Kirana itself, as in an application.
      {
        plugins: [kirana()],
        test: {
          name: "presets",
          include: ["npm/{preset-*,states}/test/**/*.test.ts"],
        },
      },
    ],
  },
})
