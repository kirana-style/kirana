import { KiranaPlugin } from "@kirana-style/webpack"
import HtmlWebpackPlugin from "html-webpack-plugin"

export default (_env, { mode }) => ({
  entry: "./src/main.tsx",
  // Content hashes in production only: a hot update asks for the stylesheet by its current name.
  output: {
    clean: true,
    filename: mode === "production" ? "[name].[contenthash].js" : "[name].js",
    cssFilename:
      mode === "production" ? "[name].[contenthash].css" : "[name].css",
  },
  resolve: { extensions: [".tsx", ".ts", ".js"] },
  // Webpack's own CSS support; `css-loader` with `mini-css-extract-plugin` works the same way.
  experiments: { css: true },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        use: {
          loader: "swc-loader",
          options: {
            jsc: {
              parser: { syntax: "typescript", tsx: true },
              transform: { react: { runtime: "automatic" } },
            },
          },
        },
      },
    ],
  },
  // Kirana's loader runs before swc-loader: it reads `sx` before JSX is compiled away.
  plugins: [
    new KiranaPlugin(),
    new HtmlWebpackPlugin({ templateContent: '<div id="root"></div>' }),
  ],
})
