# Jest
Source: https://kirana.style/docs/integrations/jest

# Jest

Jest runs no bundler, so Kirana is a transformer: it compiles a module's styles,
then hands it to the transformer you already use. Tests see the class names your
app ships; no stylesheet is written. Tested by `examples/jest-react`. With
Vitest, [the Vite plugin](/docs/integrations/vite) does this already.

> [!NOTE] Not on npm yet
> The packages are packed and install-tested on every change, but not published.
> Until they are, install them from tarballs as
> [Installation](/docs/start/installation#install-from-tarballs) shows; the rest
> of this page is the same either way.

## 1. Install

```bash
npm install -D @kirana-style/jest
```

## 2. Add the transformer

```js file="jest.config.js"
export default {
  transform: {
    "\\.[jt]sx?$": ["@kirana-style/jest", { transformer: "babel-jest" }],
  },
}
```

## Caching

Jest caches a module by its own source. After changing tokens another module
reads, run Jest once with `--no-cache`.

## Next

- [Every bundler](/docs/integrations/bundlers).
