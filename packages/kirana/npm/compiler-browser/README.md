# @kirana-style/compiler-browser

The Kirana engine in a web page, for playgrounds and editors on the web
([D-113](../../../../spec/20-decisions.md)). It is the WebAssembly build of the engine, with an
in-memory project, and writes the same CSS as the native engine.

```ts
import { createProject } from "@kirana-style/compiler-browser"

// `config`: what kirana.config.ts's default export holds, already evaluated
const project = createProject({ config, files: { "src/Card.tsx": source } })
const { code, diagnostics } = project.transform("src/Card.tsx")
const css = project.stylesheet()
```

- **`createProject({ config, root, files, language })`** writes the files to the engine's in-memory
  file system (under `/app` by default), so imports, tokens and the configuration's scale modules
  resolve as they would on disk.
- **`write(file, code)`** writes a file and returns the files that read it, which need transforming
  again; `remove(file)` takes a file and its styles out.
- **`transform(file)`** compiles a file: its code, source map, diagnostics with line and column, and
  whether the stylesheet changed. `stylesheet(minify?)` is the CSS of every module transformed so
  far, and `diagnostics()` the project-wide checks.
- **`language`** is the language server on the project's files: `request` and `notify` take what an
  editor sends over LSP, as objects, so a web editor shows the summaries, code lenses and hovers the
  desktop editors show.
- **`@kirana-style/compiler-browser/runtime`** is the runtime compiled modules import, from the same
  release, for a page that runs what it compiled.

The page must be cross-origin isolated (`Cross-Origin-Opener-Policy: same-origin`,
`Cross-Origin-Embedder-Policy: require-corp`): the engine's memory is a `SharedArrayBuffer`. The
configuration arrives evaluated, since the page cannot run `kirana.config.ts`.

The guide: [kirana.style/docs/tooling/editor](https://kirana.style/docs/tooling/editor#an-editor-in-a-web-page).
