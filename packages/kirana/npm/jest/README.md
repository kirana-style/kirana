# @kirana-style/jest

The Jest adapter for Kirana ([11-integrations](../../../../spec/11-integrations.md)): a
transformer that compiles a module's styles, then hands it to the transformer the project already
uses.

```js
// jest.config.js
export default {
  transform: {
    "\\.[jt]sx?$": ["@kirana-style/jest", { transformer: "babel-jest" }],
  },
}
```

Tests see the class names the application ships; no stylesheet is written. Options: `root`,
`config`, `transformer` (default `babel-jest`), `transformerConfig`. Jest caches a module by its own
source, so after changing tokens another module reads, run Jest once with `--no-cache`. With Vitest,
use `@kirana-style/vite` instead.
