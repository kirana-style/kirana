# Kirana

[![npm](https://img.shields.io/npm/v/%40kirana-style%2Fcore?label=npm&color=3f7d4f)](https://www.npmjs.com/package/@kirana-style/core)
[![Downloads](https://img.shields.io/npm/dm/%40kirana-style%2Fcore?color=3f7d4f)](https://www.npmjs.com/package/@kirana-style/core)
[![CI](https://img.shields.io/github/actions/workflow/status/kirana-style/kirana/ci.yml?branch=main&label=ci)](https://github.com/kirana-style/kirana/actions/workflows/ci.yml)
[![Editor extension](https://img.shields.io/open-vsx/v/kirana-style/kirana?label=extension&color=3f7d4f)](https://marketplace.visualstudio.com/items?itemName=kirana-style.kirana)
[![License: MIT](https://img.shields.io/github/license/kirana-style/kirana?color=3f7d4f)](LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/kirana-style/kirana?style=flat&color=3f7d4f)](https://github.com/kirana-style/kirana/stargazers)

**Write objects. Read classes. Ship CSS.**

CSS-in-JS with a Rust engine of its own. Kirana compiles typed style objects into
one small, layered, atomic stylesheet at native speed. Start with plain objects and
no preset; add tokens, themes and ready-made scales when your design system grows.
A typo or a selector that can never match is a compile error, styles merge per
property instead of colliding, and your editor shows every element's CSS at the end
of its line, across the frameworks, bundlers and editors you already use. Nothing
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

> Start a project with `npx kirana-style@latest init`. Kirana follows semantic versioning:
> before 1.0, a minor version may change the API, and its release notes say how to move.
> Documentation: <https://kirana.style>. Changes: [CHANGELOG.md](CHANGELOG.md).

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

| Tool          | Why                                                                                    | Install                                                           |
| ------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Vite+ (`vp`)  | the toolchain: install, check, test, tasks, git hooks; brings Node.js 24 and Bun 1.4.3 | `curl -fsSL https://vite.plus \| bash`, then open a new terminal  |
| Rust (rustup) | the Kirana engine is Rust, built before anything else                                  | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| A C linker    | Rust links the native engine with it                                                   | Linux/WSL: `build-essential` · macOS: `xcode-select --install`    |
| Cargo tools   | only for `vp run rust`, `vp run coverage`, the pre-push hook                           | `cargo install --locked cargo-nextest cargo-deny cargo-llvm-cov`  |
| Chromium      | only for `kirana:example`                                                              | `cd packages/kirana && bunx playwright install chromium`          |

The Rust version is pinned in `packages/kirana/rust-toolchain.toml`; rustup
downloads it the first time a command needs it. The scripts find cargo in
`~/.cargo/bin` even when your terminal has not loaded `~/.cargo/env`.

### 2. Install, run and build

```bash
vp install       # again whenever bun.lock changes; also installs the git hooks
vp run dev       # builds the native engine, then serves the docs on :3000
vp run build     # native engine, then the docs site → apps/docs/dist
```

The first run compiles the Rust workspace and takes a few minutes; later runs
replay it from the task cache (`node_modules/.vite/task-cache`) until a file in
`packages/kirana/crates` changes. The build prints every compiler diagnostic as
`file:line:column`; it must report 0 errors.

## Scripts

Every command runs from the repository root. `vp <command>` is a Vite+ built-in;
`vp run <task>` runs a task from the root `vite.config.ts`, cached unless noted:
a task whose inputs did not change replays its output in a second. **Needs** is
what must be installed.

| Command                  | What it does                                                                                                                                   | Needs                           |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| `vp install`             | installs every workspace (Bun) and the git hooks                                                                                               | Vite+                           |
| `vp run dev`             | builds the native engine, then serves the docs with hot reload (not cached)                                                                    | Rust                            |
| `vp run build`           | builds the native engine, then the docs into `apps/docs/dist`                                                                                  | Rust                            |
| `vp run engine`          | builds only the native engine (release)                                                                                                        | Rust                            |
| `vp check`               | Oxfmt check, Oxlint with the Kirana rules, TypeScript type check, in one pass                                                                  | `vp run engine`                 |
| `vp check --fix`         | the same, rewriting what the formatter and the fixable rules can                                                                               | `vp run engine`                 |
| `vp run check`           | `vp check --deny-warnings` plus the docs' consistency check, after building the engine                                                         | Rust                            |
| `vp run verify`          | the docs' generated files match their sources                                                                                                  | Rust                            |
| `vp run rust`            | `cargo fmt`, Clippy, `cargo deny` (`vp run rust:lint` alone), then the Rust tests                                                              | cargo-nextest, cargo-deny       |
| `vp run test`            | Vitest: the Kirana packages against the engine, and docs-core                                                                                  | Rust                            |
| `vp run coverage`        | Rust and TypeScript tests with coverage; fails below 100 % (Rust regions too)                                                                  | cargo-nextest, cargo-llvm-cov   |
| `vp run licenses`        | every installed JavaScript dependency's licence against `scripts/check-licenses.ts`                                                            | `vp install`                    |
| `vp run budgets`         | output size and type cost against `packages/kirana/budgets/budgets.json` (`bun run budgets --update` there rewrites it)                        | `vp run engine`                 |
| `vp run prepush`         | `check`, `verify`, `rust:lint`, `coverage`, docs-core tests, the Zed extension, `licenses`, `budgets`: the pre-push hook                       | the cargo tools                 |
| `bun run kirana:pack`    | compiles every npm package with `vite-plus/pack`, packs it and the engine into `dist-packages/`                                                | `vp run engine`                 |
| `bun run kirana:example` | installs the packed tarballs into an example, builds it and checks it in Chromium; `--registry` runs `kirana-style ui init` and `ui add` first | `bun run kirana:pack`, Chromium |
| `vp cache clean`         | empties the task cache                                                                                                                         | Vite+                           |

`KIRANA_UPDATE_FIXTURES=1 bun run --cwd packages/kirana test:rust` rewrites the
golden fixtures.

### Git hooks

`vp install` installs two hooks (`.vite-hooks/`): **pre-commit** formats and
lints the staged files (`vp staged`, the `staged` block of `vite.config.ts`),
and **pre-push** runs `vp run prepush`, the checks CI requires, 100 % coverage
included (coverage runs every Rust and Kirana test, so the plain test runs are
not repeated). Pushing again
without changes replays them from the cache. `VP_GIT_HOOKS=0 git push` skips
them once; `vp hooks status` shows their state.

When a Rust tool is missing, the command stops and prints the line that installs
it.

## Troubleshooting

| Symptom                                                         | Fix                                                               |
| --------------------------------------------------------------- | ----------------------------------------------------------------- |
| `Kirana needs Rust, and cargo was not found`                    | install rustup (above), then open a new terminal                  |
| `Internal Error: cargo metadata failed to run`                  | cargo is not reachable: install rustup, or `. "$HOME/.cargo/env"` |
| `Cannot find module '…/kirana.<platform>.node'`                 | `vp run engine`                                                   |
| `This command needs cargo-nextest …`                            | run the `cargo install` line it prints                            |
| `vp run dev` starts on :3001 or later                           | another server holds :3000; stop it (`lsof -i :3000` shows which) |
| `lockfile had changes, but lockfile is frozen` / missing module | `vp install`                                                      |
| A task replays a stale result                                   | `vp cache clean`, then run it again                               |
| A `default_*.profraw` file appears                              | coverage output from an instrumented binary; ignored, delete it   |
| `Kirana has no engine` from `vp check`                          | `vp run engine`                                                   |

## Editor, lint and brand-logo tooling

### Lint

`vp check` (or `vp lint`) runs Oxlint with Kirana's own rules,
`@kirana-style/eslint-plugin`, loaded from source through `jsPlugins` in the
`lint` block of `vite.config.ts`. The rules read the compiler, so **build the
native engine first** (`vp run engine`, or any task that depends on it); without
it every file reports `Kirana has no engine`. The editor extensions are
excluded from the Kirana rules, and the examples from linting altogether: they
are installed from packed tarballs elsewhere, so their imports cannot resolve
here, and CI builds every one of them. How another project sets the plugin up under Oxlint, ESLint or Biome
(`@kirana-style/biome-plugin`) is on the docs page `/docs/tooling/lint`.

### Agent skills

`skills/` holds the skills people install with `npx skills add`: `kirana` and
`kirana-migrate`. Their `references/diagnostics.md` and `references/lint.md` are
generated from the compiler (`bun run --cwd apps/docs generate:skills`); a new
diagnostic needs a line in `apps/docs/scripts/generate-skills.ts` saying what to
do about it, or `verify:generated` fails.

### The language server in VS Code, Cursor, Windsurf or Antigravity

The extension lives in `packages/kirana/editors/vscode` and starts the project's
own `kirana-style lsp`. Users install it from the
[VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=kirana-style.kirana)
or [Open VSX](https://open-vsx.org/extension/kirana-style/kirana). To work on it, build
and install it by hand:

```bash
vp run engine                                          # the engine the server runs
(cd packages/kirana/editors/vscode && bun run package) # writes kirana.vsix
```

Then, in the editor: **Extensions: Install from VSIX…** and pick
`packages/kirana/editors/vscode/kirana.vsix`, or install it from a terminal:

```bash
code --install-extension packages/kirana/editors/vscode/kirana.vsix --force
antigravity --install-extension packages/kirana/editors/vscode/kirana.vsix --force   # if its CLI is on PATH
```

This repository has no `node_modules/.bin/kirana-style`, so `.vscode/settings.json`
points the extension at the compiler entry instead:

```json
{
  "kirana.server.path": "packages/kirana/npm/cli/bin/kirana-style.ts",
  "kirana.trace.server": "verbose"
}
```

- **After changing the extension:** package again, install with `--force` (or
  uninstall the old one first), then **Developer: Reload Window**.
- **After changing the compiler:** `vp run engine`, then **Kirana: Restart
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

### Brand logos (SVGL, then LogoForge, then the brand's own)

The docs show product logos from [SVGL](https://svgl.app), and from
[LogoForge](https://logoforge.terravidhal.me) for a brand SVGL has no logo for
(LogoForge's artwork is CC0, from Simple Icons and gilbarbara/logos), and from
the brand's own website for one neither has (Vike's). They are
kept in the repository, so nothing is fetched at runtime, in dev, in builds or
in CI:

- `packages/docs-ui/src/brands/*.svg`: the files, and `manifest.json`, what was
  fetched and from which source;
- `apps/docs/src/generated/svgl-icons.gen.ts`: the `SVGL` map, each logo a Vite
  asset import (`?url`).

To add a logo, add its slug and SVGL title to `NEEDED` in
`apps/docs/scripts/generate-svgl.ts` (search the title at
`https://api.svgl.app?search=<name>`). If SVGL has none, add it to `LOGOFORGE`
instead, with the logo's slug from `https://logoforge.terravidhal.me/api/logos.json`
and a `dark` variant when the light one disappears on a dark background. If neither
has it, add it to `OFFICIAL` with the light and dark files the brand publishes on
its website; a file holding a script or an event handler is refused. Then:

```bash
(cd apps/docs && bun run generate:svgl)   # downloads the files and rewrites the map
```

Use it as `<BrandIcon icon={SVGL.name} />` (`@workspace/docs-ui/brand-icon.tsx`).
A logo with light and dark files follows the site's theme switch, not the
operating system's. `bun run verify:generated` (in `apps/docs`) checks the map
against the manifest offline. A brand with no logo in any source shows a monogram.

## Contributing, security and licence

- How to report a bug and get a pull request merged: [CONTRIBUTING.md](CONTRIBUTING.md).
- Report a vulnerability privately: [SECURITY.md](https://github.com/kirana-style/.github/blob/main/SECURITY.md).
- Kirana is [MIT licensed](LICENSE).
