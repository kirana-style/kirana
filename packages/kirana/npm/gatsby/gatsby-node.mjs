// Gatsby loads a plugin's `gatsby-node` from its package root. The published package compiles
// `src/index.ts` to `src/index.js`, which this re-exports.
export { onCreateWebpackConfig } from "./src/index.js"
