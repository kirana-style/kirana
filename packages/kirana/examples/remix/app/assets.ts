import { kiranaLoader } from "@kirana-style/remix"
import { createAssetServer } from "remix/assets"

// Client entries reach the browser through the asset server, which compiles TypeScript and JSX;
// Kirana's loader compiles their styles after it. The compiled modules import Kirana's runtime
// merge, so `@kirana-style/core` is allowed beside `remix`.
export const assets = createAssetServer({
  basePath: "/assets",
  rootDir: process.cwd(),
  allowFiles: ["app/routes.ts", "app/**/public/**"],
  allowPackages: ["remix", "@kirana-style/core"],
  scripts: { loaders: [kiranaLoader] },
})

export const scriptEntry = await assets.getScriptEntry(
  "app/actions/public/entry.ts"
)
