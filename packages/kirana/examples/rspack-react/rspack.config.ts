import { KiranaPlugin } from "@kirana-style/rspack"
import { defineConfig } from "@rspack/cli"
import { rspack } from "@rspack/core"

// Rspack runs webpack's plugins unchanged: Kirana's webpack plugin is its plugin too.
export default defineConfig({
  entry: { main: "./src/index.tsx" },
  output: { path: "dist", clean: true },
  resolve: { extensions: [".tsx", ".ts", ".js"] },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: "builtin:swc-loader",
        options: {
          jsc: {
            parser: { syntax: "typescript", tsx: true },
            transform: { react: { runtime: "automatic" } },
          },
        },
      },
      // Rsbuild does this for you: CSS needs a module type.
      { test: /\.css$/, type: "css" },
    ],
  },
  plugins: [
    new KiranaPlugin(),
    new rspack.HtmlRspackPlugin({ templateContent: '<div id="root"></div>' }),
  ],
})
