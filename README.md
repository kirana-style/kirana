# Kirana

**Write objects. Read classes. Ship CSS.**

CSS-in-JS with a Rust engine of its own. Kirana compiles typed style objects into
one small, layered, atomic stylesheet at native speed. Start with plain objects and
no preset; add tokens, themes and ready-made scales when your design system grows.
A typo or a selector that can never match is a compile error, styles merge per
property instead of colliding, and your editor shows every element's CSS at the end
of its line — across the frameworks, bundlers and editors you already use. Nothing
runs in the browser but a class-name merge.

```tsx
import { css } from "@kirana-style/core"

const styles = {
  root: css({
    display: "inline-flex",
    borderRadius: "9999px",
    paddingInline: "0.5rem",
    fontSize: "0.75rem",
  }),
}

export function Badge(props: React.ComponentProps<"span">) {
  return <span {...props} sx={styles.root} />
}
```

> Kirana is in development and not released yet. Package names and APIs may still
> change before 0.1.0. Documentation: <https://kirana.style>.

## What is here

| Path                                            | What it is                                                                                                                                                |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/kirana/crates`                        | The Rust engine: parser front ends, evaluator, cascade, emitter, CLI and language server                                                                  |
| `packages/kirana/npm`                           | The npm packages: `@kirana-style/core`, `@kirana-style/compiler` and an adapter per framework and bundler                                                 |
| `packages/kirana/helpers`                       | Template helpers for server frameworks: PHP (Laravel, Symfony), Ruby (Rails), Elixir (Phoenix) <!-- consistency: subset; AdonisJS has its own package --> |
| `packages/kirana/editors`                       | The VS Code and Zed extensions                                                                                                                            |
| `packages/kirana/examples`                      | One example app per framework and bundler, built and checked in a browser in CI                                                                           |
| `packages/kirana/fixtures`                      | Golden fixtures: every transform, diagnostic and merge vector                                                                                             |
| `packages/kirana/design-notes`                  | Why each subsystem is built the way it is, with measurements                                                                                              |
| `spec/`                                         | The specification and the decision log (`D-…`, `KRN-…`) the code cites                                                                                    |
| `apps/docs`                                     | The documentation site, kirana.style, styled with Kirana                                                                                                  |
| `packages/docs-*`, `ui`, `shell`, `vite-config` | The docs site's components, tokens and shared Vite config                                                                                                 |

## Getting started

### 1. Install the prerequisites (once)

| Tool          | Why                                                       | Install                                                           |
| ------------- | --------------------------------------------------------- | ----------------------------------------------------------------- |
| Bun 1.4.2     | package manager and script runner                         | https://bun.com/docs/installation                                 |
| Rust (rustup) | the Kirana engine is Rust, built before anything else     | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| A C linker    | Rust links the native engine with it                      | Linux/WSL: `build-essential` · macOS: `xcode-select --install`    |
| Cargo tools   | only for `kirana:check`, `kirana:test`, `kirana:coverage` | `cargo install --locked cargo-nextest cargo-deny cargo-llvm-cov`  |
| Chromium      | only for `kirana:example`                                 | `cd packages/kirana && bunx playwright install chromium`          |

The Rust version is pinned in `packages/kirana/rust-toolchain.toml`; rustup
downloads it the first time a command needs it. The scripts find cargo in
`~/.cargo/bin` even when your terminal has not loaded `~/.cargo/env`.

### 2. Install, run and build

```bash
bun install      # again whenever bun.lock changes
bun dev          # builds the native engine, then serves the docs on :3000
bun run build    # native engine, then the docs site → apps/docs/dist
```

The first run compiles the Rust workspace and takes a few minutes; later runs
reuse Turbo's cache until a file in `packages/kirana/crates` changes. The build
prints every compiler diagnostic as `file:line:column`; it must report 0 errors.

## Scripts

Every command runs from the repository root. **Needs** is what must have run
first.

| Command                   | What it does                                                                      | Needs                                             |
| ------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------- |
| `bun install`             | installs every workspace                                                          | Bun                                               |
| `bun dev`                 | builds the native engine, then serves the docs with hot reload                    | `bun install`, Rust                               |
| `bun run build`           | builds the native engine, then the docs into `dist/`                              | `bun install`, Rust                               |
| `bun run check`           | oxlint, oxfmt check, TypeScript typecheck                                         | `bun install`                                     |
| `bun run format`          | rewrites files with oxfmt                                                         | `bun install`                                     |
| `bun run kirana:build`    | builds only the native engine (release)                                           | `bun install`, Rust                               |
| `bun run kirana:check`    | `cargo fmt`, Clippy, `cargo deny`, Rust tests, typecheck, Vitest                  | `bun run kirana:build`, cargo-nextest, cargo-deny |
| `bun run kirana:test`     | Rust tests and Vitest; `KIRANA_UPDATE_FIXTURES=1` rewrites golden fixtures        | `bun run kirana:build`, cargo-nextest             |
| `bun run kirana:coverage` | the same tests with coverage; fails below 100 % (Rust regions too)                | `bun install`, cargo-nextest, cargo-llvm-cov      |
| `bun run kirana:pack`     | packs every npm package and the native engine into `dist-packages/`               | `bun run kirana:build`                            |
| `bun run kirana:example`  | installs the packed tarballs into an example, builds it and checks it in Chromium | `bun run kirana:pack`, Chromium                   |

When a Rust tool is missing, the command stops and prints the line that installs
it.

## Troubleshooting

| Symptom                                                         | Fix                                                               |
| --------------------------------------------------------------- | ----------------------------------------------------------------- |
| `Kirana needs Rust, and cargo was not found`                    | install rustup (above), then open a new terminal                  |
| `Internal Error: cargo metadata failed to run`                  | cargo is not reachable: install rustup, or `. "$HOME/.cargo/env"` |
| `Cannot find module '…/kirana.<platform>.node'`                 | `bun run kirana:build`                                            |
| `This command needs cargo-nextest …`                            | run the `cargo install` line it prints                            |
| `bun dev` starts on :3001 or later                              | another server holds :3000; stop it (`lsof -i :3000` shows which) |
| `lockfile had changes, but lockfile is frozen` / missing module | `bun install`                                                     |
| Turbo keeps a stale engine                                      | `bun run clean`, then rebuild                                     |
| A `default_*.profraw` file appears                              | coverage output from an instrumented binary; ignored, delete it   |
| `Kirana has no engine` from `bun run lint`                      | `bun run kirana:build`                                            |

## Editor, lint and brand-logo tooling

### Lint

`bun run lint` (part of `bun run check`) runs oxlint with Kirana's own rules,
`@kirana-style/eslint-plugin`, loaded from source through `jsPlugins` in
`.oxlintrc.json`. The rules read the compiler, so **build the native engine
first** (`bun run kirana:build`, or any `bun run build`); without it every file
reports `Kirana has no engine`. The examples and the editor extensions are
excluded. How another project sets the plugin up under Oxlint, ESLint or Biome
(`@kirana-style/biome-plugin`) is on the docs page `/docs/tooling/lint`.

### Agent skills

`skills/` holds the skills people install with `npx skills add`: `kirana` and
`kirana-migrate`. Their `references/diagnostics.md` and `references/lint.md` are
generated from the compiler (`bun run --cwd apps/docs generate:skills`); a new
diagnostic needs a line in `apps/docs/scripts/generate-skills.ts` saying what to
do about it, or `verify:generated` fails.

### The language server in VS Code, Cursor, Windsurf or Antigravity

The extension lives in `packages/kirana/editors/vscode` and starts the project's
own `kirana lsp`. It is not on a marketplace yet, so build and install it by hand:

```bash
bun run kirana:build                                   # the engine the server runs
(cd packages/kirana/editors/vscode && bun run package) # writes kirana.vsix
```

Then, in the editor: **Extensions: Install from VSIX…** and pick
`packages/kirana/editors/vscode/kirana.vsix` — or from a terminal:

```bash
code --install-extension packages/kirana/editors/vscode/kirana.vsix --force
antigravity --install-extension packages/kirana/editors/vscode/kirana.vsix --force   # if its CLI is on PATH
```

This repository has no `node_modules/.bin/kirana`, so `.vscode/settings.json`
points the extension at the compiler entry instead:

```json
{
  "kirana.server.path": "packages/kirana/npm/compiler/bin/kirana.ts",
  "kirana.trace.server": "verbose"
}
```

- **After changing the extension:** package again, install with `--force` (or
  uninstall the old one first), then **Developer: Reload Window**.
- **After changing the compiler:** `bun run kirana:build`, then **Kirana: Restart
  Language Server**.
- **WSL, SSH or a container:** install the `.vsix` on the remote side (the
  Extensions view offers "Install in WSL"), where the project and Node.js live.
- **Without installing:** `bun run build` in the extension's folder, then
  `code --extensionDevelopmentPath="$PWD/packages/kirana/editors/vscode" .`
- **What it says:** the **Kirana** output channel, with `kirana.trace.server` set
  to `verbose`.

The extension's end-to-end test downloads VS Code and runs it headless against a
fixture project: `(cd packages/kirana/editors/vscode && bun run test:e2e)`.

### Zed, Neovim and Helix

Zed: **zed: install dev extension** and pick `packages/kirana/editors/zed`
(it builds the WebAssembly itself; `rustup target add wasm32-wasip2` once).
Neovim and Helix need only configuration, on the docs page `/docs/tooling/editor`.

### Brand logos (SVGL, then LogoForge)

The docs show product logos from [SVGL](https://svgl.app), and from
[LogoForge](https://logoforge.terravidhal.me) for a brand SVGL has no logo for
(LogoForge's artwork is CC0, from Simple Icons and gilbarbara/logos). They are
kept in the repository, so nothing is fetched at runtime, in dev, in builds or
in CI:

- `packages/docs-ui/src/brands/*.svg` — the files, and `manifest.json`, what was
  fetched and from which source;
- `apps/docs/src/generated/svgl-icons.gen.ts` — the `SVGL` map, each logo a Vite
  asset import (`?url`).

To add a logo, add its slug and SVGL title to `NEEDED` in
`apps/docs/scripts/generate-svgl.ts` (search the title at
`https://api.svgl.app?search=<name>`). If SVGL has none, add it to `LOGOFORGE`
instead, with the logo's slug from `https://logoforge.terravidhal.me/api/logos.json`
and a `dark` variant when the light one disappears on a dark background. Then:

```bash
(cd apps/docs && bun run generate:svgl)   # downloads the files and rewrites the map
```

Use it as `<BrandIcon icon={SVGL.name} />` (`@workspace/docs-ui/brand-icon.tsx`).
A logo with light and dark files follows the site's theme switch, not the
operating system's. `bun run verify:generated` (in `apps/docs`) checks the map
against the manifest offline. A brand in neither source shows a monogram.

## Contributing, security and licence

- How to report a bug and get a pull request merged: [CONTRIBUTING.md](CONTRIBUTING.md).
- Report a vulnerability privately: [SECURITY.md](https://github.com/kirana-style/.github/blob/main/SECURITY.md).
- Kirana is [MIT licensed](LICENSE).
