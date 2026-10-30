# @kirana-style/compiler

The Kirana Driver, the native engine loader and the subcommands of `kirana-style` (the command
itself is the `kirana-style` package)
([11-integrations](../../../../spec/11-integrations.md)). Host adapters such as
`@kirana-style/vite` are thin wrappers over the Driver; the Rust engine does every styling decision.

## Command line

```bash
kirana-style build <paths…> --out dist/kirana.css [--minify]   # compile and write the stylesheet
kirana-style check <paths…> [--format human|json|github]      # diagnostics; exits 1 on errors
kirana-style trace <file>:<line> <property>… [--format json] # why a value wins at one site
```

Each path reads the nearest `kirana.config.ts` (or `.mts`, `.js`, `.mjs`, `.json`) above it, or the
working directory's; `--config <file>` forces one for every path.

```text
$ kirana-style trace src/components/drawer.tsx:88 justifyContent
justifyContent at src/components/drawer.tsx:88
  ✓ center                   @media (width >= 48rem)          kirana.atoms       step 2 (1 condition > 0)
    start                    base                             kirana.atoms
```

## Driver

```ts
import { Driver, formatDiagnostic } from "@kirana-style/compiler"

const driver = await Driver.create({ root: process.cwd() })
const result = driver.transform("/abs/path/button.tsx", source) // { code?, map?, diagnostics, cssChanged, dependencies }
const css = driver.stylesheet(true)
const affected = driver.invalidate("/abs/path/tokens.ts") // importers to recompile

// For tools, from the same session: each file compiled once.
const answers = driver.trace([
  { file: "src/button.ts", line: 3, property: "height" },
]) // trace --format json
const system = driver.export(["src"], { definitions: true }) // export --definitions
const lowered = driver.lowerTailwind("gap-1 px-2.5", "src/report.tsx") // { style, module, anchors, left, notes }
```

A module the prefilter rejects returns no `code`: keep the original.

## Native engine

`kirana.<platform>-<arch>[-<libc>].node` sits next to this file, built from `packages/kirana/crates`:

```bash
bun run build        # release: scripts/build-native.ts → napi build --platform --release
bun run build:debug  # debug, faster to compile
```

From the repository root, `vp run engine` does the same, and `vp run dev` / `vp run build` run it
before the apps. The script finds cargo in `~/.cargo/bin` when `PATH` lacks it and prints
the rustup install command when Rust is missing.

`KIRANA_NATIVE_PATH` points the loader at another build.
