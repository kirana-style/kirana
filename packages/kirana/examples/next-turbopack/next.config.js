import { withKirana } from "@kirana-style/next"

// Next.js on Turbopack, its default bundler (`next dev`, `next build`): the loader compiles modules,
// and `@kirana-style/postcss` writes the stylesheet at `@kirana;` in app/globals.css.
export default withKirana({})
