# @kirana-style/gatsby

Kirana for Gatsby (D-071): adds Kirana's webpack plugin to every stage of Gatsby's build, so the
server render and the browser bundle name the same classes.

```js
// gatsby-config.js
module.exports = { jsxRuntime: "automatic", plugins: ["@kirana-style/gatsby"] }
```

```js
// gatsby-browser.js
import "@kirana-style/core/stylesheet.css"
```

Plugin options are `@kirana-style/webpack`'s (`config`, `reportInfo`).
