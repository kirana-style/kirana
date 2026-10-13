# Published libraries: ship styles uncompiled, compile them in the app (2026-09-23)

KRN-INT-008 required a published library to be built with `kirana build --library`, shipping compiled
JavaScript plus a versioned `kirana.manifest.json` of its atoms, tokens and relations, which the
application's Driver merges into its registry. This note replaces that with something simpler and
more correct, recorded as D-054. It is M4 phase 7.

## What a library's styles need in the application

1. Its atoms in the application's one stylesheet, **deduplicated** with the application's own.
2. Its classes **mergeable** with the application's: `sx={[libraryStyle, override]}` must let the
   override replace the library's value per property, which the runtime does by recognising
   `{prefix}{key}_{value}` class names.
3. Its **tokens and relations** usable from the application's own styles at compile time.
4. The application's **configuration** — prefix, targets, layers — applied to them.

## Why a precompiled library fails 2 and 4

A precompiled library has its compiler version and its configuration baked into its class names. Run
through the real runtime (`npm/core/src/internal.ts`), `cx(libraryStyle, appOverride)` gives:

| The library was built…                     | Result                 | What goes wrong                                                                                                   |
| ------------------------------------------ | ---------------------- | ----------------------------------------------------------------------------------------------------------------- |
| with the application's config and compiler | `"k50_bbbb"`           | nothing: the override replaced the library's colour                                                               |
| with prefix `ds`, the application uses `k` | `"ds50_aaaa k50_bbbb"` | both classes stay; which colour shows depends on stylesheet order, not on the order the author wrote              |
| by an older compiler (3-character hash)    | `"k50_bbbb"`           | the merge still works, but the same declaration ships twice (`.k50_aaa` and `.k50_aaaa`), defeating deduplication |

The last row is not hypothetical: the value hash widened from three characters to four in this
repository (commit `b527766`). Every such change would make every published library's manifest a
source of duplicate CSS until all of them republished. A manifest format also has to serialise the
IR — atoms, token definitions, relation markers, keyframes — and version it, and a library built for
Chrome 120 would ship atoms the application's lowering for older targets never sees.

## What compiling in the application costs

The engine compiles the shadcn/ui port's whole component library and demo — 106 files — in **63 ms**
(native) and 136 ms (WASI), and its share of a production build is 0.05 s of 16.2 s (E-02). A
library's modules are a fraction of that. There is nothing to save by precompiling.

## The decision

- A published Kirana library ships **its `css()` calls uncompiled** — built with `tsc` or any
  bundler, without Kirana's plugin — and no CSS of its own.
- The application lists it in **`libraries`** in `kirana.config.ts`. Every adapter then compiles
  that package's modules from `node_modules` as it compiles the application's own: one registry, so
  atoms are deduplicated exactly and the application's prefix, targets and layers apply; tokens and
  relations resolve through the same evaluator as for a workspace package.
- The Vite adapter keeps listed libraries out of dependency pre-bundling and out of SSR externals,
  where they would otherwise bypass the plugin.
- A library that is not listed fails loudly: its first `css()` throws, and the message names
  `libraries`.
- Styles in a published library are applied with `props()` (or `cx` into `className`), which the
  compiler understands in plain JavaScript; `sx` needs JSX, which a library's build usually compiles
  away. A library that ships `.jsx` or `.tsx` may use `sx`.

`kirana build --library` and the manifest are withdrawn. The cost is one condition on library
authors — build without Kirana's plugin — and one line for application authors.

## Not covered

- An application **without** Kirana cannot use such a library, because nothing compiles its styles.
  A library that must also serve those applications would need to ship CSS; that is out of scope
  until someone asks for it.
- Next.js bundles server code with its own rules: a listed library also belongs in Next's
  `transpilePackages`, so it is bundled and reaches the loader.

## Verification

`examples/vite-library`: a library packed as a tarball and installed into `node_modules`, exporting a
component styled with `props()` and a token the application's own style reads; the example checks the
computed style and hover in a browser and that the shared declaration is in the stylesheet once.
Without `libraries`, the same build throws the message above at runtime.
