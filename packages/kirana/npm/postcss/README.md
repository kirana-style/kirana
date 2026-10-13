# @kirana-style/postcss

A PostCSS plugin that writes a Kirana project's stylesheet where a stylesheet says `@kirana;`
(KRN-INT-010). It is how Next.js with Turbopack gets its stylesheet (`@kirana-style/next`), and works in any
PostCSS pipeline whose scripts another step compiles.

```js
// postcss.config.mjs
export default { plugins: { "@kirana-style/postcss": {} } }
```

```css
@kirana;
```

- **Incremental.** One compiler session per project lives for the process. A run transforms only the
  scripts whose modification time changed, and the modules that read a value from them.
- **Watching.** The plugin returns a `dir-dependency` on the project and on every library it compiles,
  and a `dependency` on the configuration file, so a dev server runs it again on a change.
- **Diagnostics.** Project-wide warnings become PostCSS warnings; an error fails the stylesheet.

Options: `root` (default: the working directory), `minify` (default: on when `NODE_ENV` is
`production`), `reportInfo`. `@kirana-style/core/stylesheet.css`'s placeholder rule is replaced the same way
as the directive.
