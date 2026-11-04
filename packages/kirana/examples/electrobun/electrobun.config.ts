import type { ElectrobunConfig } from "electrobun"

export default {
  app: {
    name: "kirana-example-electrobun",
    identifier: "style.kirana.example.electrobun",
    version: "0.0.1",
  },
  build: {
    mainProcess: "bun",
    bun: { entrypoint: "src/bun/index.ts" },
    // Vite builds the view into dist; Electrobun copies it into the app.
    copy: {
      "dist/index.html": "views/mainview/index.html",
      "dist/assets": "views/mainview/assets",
    },
    watchIgnore: ["dist/**"],
  },
} satisfies ElectrobunConfig
