# @kirana-style/compiler

The Kirana Driver, the native engine loader and the `kirana` command
([11-integrations](../../../../spec/11-integrations.md)). Host adapters such as
`@kirana-style/vite` are thin wrappers over the Driver; the Rust engine does every styling decision.

## Command line

```bash
kirana build <paths…> --out dist/kirana.css [--minify]   # compile and write the stylesheet
kirana check <paths…> [--format human|json]             # diagnostics; exits 1 on errors
kirana trace <file>:<line> <property>                   # why a value wins at one site
```

`kirana.config.ts` (or `.mts`, `.js`, `.mjs`, `.json`) is read from the working directory.

```text
$ kirana trace src/components/drawer.tsx:88 justifyContent
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
```

A module the prefilter rejects returns no `code`: keep the original.

## Native engine

`kirana.<platform>-<arch>[-<libc>].node` sits next to this file, built from `packages/kirana/crates`:

```bash
bun run build        # release: scripts/build-native.ts → napi build --platform --release
bun run build:debug  # debug, faster to compile
```

From the repository root, `bun run kirana:build` does the same, and `bun dev` / `bun run build` run it
through Turbo before the apps. The script finds cargo in `~/.cargo/bin` when `PATH` lacks it and prints
the rustup install command when Rust is missing.

`KIRANA_NATIVE_PATH` points the loader at another build.
