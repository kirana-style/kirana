# Next.js with Turbopack

## Summary

Turbopack runs webpack-style loaders but no plugins, so no single hook sees every module's atoms.
Kirana splits the work the way Tailwind CSS v4 and StyleX do: `@kirana-style/next` registers a loader that
rewrites styles into class names, and `@kirana-style/postcss` compiles the whole project inside the
stylesheet that holds the `@kirana;` directive. The two run in separate sessions and agree because a
class name is a hash of what it styles, never of build order (D-037).

## Context <!-- requirements and decisions implemented: KRN-INT-010, D-065, R-09 -->

Next.js 16 builds with Turbopack by default (`next build`, `next dev`). Until this change Kirana
supported Next.js only through `next build --webpack` (KRN-INT-003), and doc 11 listed Turbopack as
deferred (R-09) because the webpack adapter's stylesheet step — writing the finished stylesheet into
the emitted asset at `processAssets` — has no Turbopack equivalent.

## Design

- **`@kirana-style/next`'s `withKirana(config, options)`** keeps the webpack half (the `@kirana-style/webpack`
  plugin, for `next build --webpack`) and adds `turbopack.rules` for `*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}`:
  the loader `@kirana-style/next/loader`, under the condition `{ all: [{ not: "foreign" }, { content:
  STYLE_BEARING }] }`. Installed packages are skipped by Turbopack itself, and a module that cannot
  hold styles never reaches the loader. A project's own rules for the same glob are kept; Kirana's rule
  is appended.
- **The loader** opens one Driver per project root in its process, skips what `shouldCompile` skips,
  calls `driver.transform`, reports through `createReporter().module`, and calls `addDependency` for
  every module a style read a value from, where the host offers it.
- **`@kirana-style/postcss`** replaces `@kirana;` (or `@kirana-style/core/stylesheet.css`'s placeholder rule) with
  `driver.stylesheet(minify)`. One `Project` per root lives for the process; a run stats every script
  of the project and of its `libraries`, transforms the ones whose modification time changed plus what
  `driver.invalidate` names, and `driver.remove`s deleted ones. Project-wide diagnostics are reported
  as PostCSS warnings; an error fails the stylesheet.
- **Hot reload** uses PostCSS's `dir-dependency` message (glob `**/*.{js,jsx,ts,tsx,mjs,cjs,mts,cts}`)
  for the project and each library, and a `dependency` on the configuration file, so the dev server
  re-runs the plugin when a component changes — Tailwind CSS v4's mechanism.

## Evidence

Measured 2026-10-05 on an AMD Ryzen 9 9900X (12 cores), Node 24.21.0, three runs each, figures in ms
(`Project.stylesheet` on the shadcn/ui port's apps):

| Project     | Scripts | Open session | First stylesheet | Nothing changed | One file touched | Stylesheet |
| ----------- | ------: | -----------: | ---------------: | --------------: | ---------------: | ---------: |
| `apps/web`  |       8 |          3–4 |             8–10 |               0 |                2 |     4.8 kB |
| `apps/docs` |     104 |          1–2 |            51–56 |             2–3 |                5 |    53.0 kB |

`examples/next-turbopack` (Next.js 16.3.8, React 19.3), through `bun run kirana:example`:

- `next build` with npm and with pnpm: the stylesheet holds the probe atoms, computed style and hover
  match in Chromium (15.0 s and 19.4 s end to end, installs included).
- `next dev`: a style edit in `app/page.jsx` reached the page (24.2 s end to end).
- `compare-atoms.ts` over `vite-react`, `next-webpack` and `next-turbopack`: the same 4 atoms.

## Alternatives considered

- **Wait for Turbopack plugins.** Not available in Next.js 16; most Next.js users would stay blocked.
- **The loader writes the stylesheet.** A loader sees one module; the stylesheet would hold only the
  atoms of modules compiled so far in that worker, and Turbopack runs loaders in several processes.
- **A generated CSS file on disk** (the loader appends, the app imports it): order-dependent, races
  between workers, and leaves a file in the project.

## Consequences

- The PostCSS session reads every script of the project, not only those the app imports, so atoms of
  an unused component are emitted. The webpack and Vite adapters emit only imported modules' atoms.
- The project is compiled twice — once by the loader, module by module, and once by the plugin. The
  numbers above bound the cost of the second.
- `postcss.config.mjs` and `@kirana;` in a global stylesheet are part of setup; `kirana init` writes
  both.
