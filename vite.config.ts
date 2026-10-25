import { defineConfig } from "vite-plus"

/** The Rust engine's sources, for tasks that compile or check it. */
const RUST = [
  "packages/kirana/crates/**",
  "!packages/kirana/crates/**/*.profraw",
  "!packages/kirana/crates/**/*.profdata",
  "packages/kirana/Cargo.toml",
  "packages/kirana/Cargo.lock",
  "packages/kirana/rust-toolchain.toml",
  "packages/kirana/rustfmt.toml",
  "packages/kirana/deny.toml",
  "packages/kirana/scripts/rust.ts",
]

/**
 * The workspace's sources, named rather than traced. Tracing a task's file access makes starting
 * a native binary fail with EBUSY (tsgolint under `vp check`, esbuild in the adapter tests), and it
 * missed the docs build's reads of workspace packages (an edit in packages/ui still hit the cache).
 */
const SOURCES = [
  "**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs,json,jsonc,md,mdx,css,yml,yaml,toml,vue,svelte,astro,html}",
  "!**/node_modules/**",
  "!**/dist/**",
  "!**/coverage/**",
  "!packages/kirana/target/**",
  "!**/.tanstack/**",
  "!**/.wrangler/**",
  "packages/kirana/npm/compiler/*.node",
]

export default defineConfig({
  // The workspace's tasks: `vp run <name>`. Each is cached (node_modules/.vite/task-cache) unless
  // it says otherwise; a hit replays its output and restores its files. `vp run prepush` is what
  // the pre-push hook runs, and CI runs the same tasks.
  run: {
    tasks: {
      // The native engine (`kirana.<platform>.node`), which the docs build, the lint rules and
      // the adapters' tests all load. Rebuilt only when the Rust workspace or its build script
      // changes.
      engine: {
        command: "bun run build",
        cwd: "packages/kirana/npm/compiler",
        cache: {
          input: [
            ...RUST,
            "packages/kirana/npm/compiler/scripts/**",
            "packages/kirana/npm/compiler/package.json",
          ],
          output: [
            "packages/kirana/npm/compiler/*.node",
            "packages/kirana/npm/compiler/native.generated.d.ts",
          ],
        },
      },
      // The site: generated data, then the Worker and its static files in apps/docs/dist.
      build: {
        command: "bun run build",
        cwd: "apps/docs",
        dependsOn: ["engine"],
        cache: {
          input: SOURCES,
          output: ["apps/docs/dist/**"],
        },
      },
      dev: {
        command: "bun run dev",
        cwd: "apps/docs",
        dependsOn: ["engine"],
        cache: false,
      },
      // Format, lint (the Kirana rules load the engine) and types, then the site's consistency. A
      // lint warning fails it, as in CI, so warnings cannot pile up.
      check: {
        command:
          "vp check --deny-warnings && bun run --cwd apps/docs check:consistency",
        dependsOn: ["engine"],
        cache: { input: SOURCES, output: [] },
      },
      // The docs' generated files match their sources, and no page contradicts them.
      verify: {
        command: "bun run verify:generated",
        cwd: "apps/docs",
        dependsOn: ["engine"],
        cache: { input: SOURCES, output: [] },
      },
      // rustfmt, Clippy and cargo-deny (`rust:lint`), then the Rust tests (golden fixtures included).
      rust: {
        command: "bun run test:rust",
        cwd: "packages/kirana",
        dependsOn: ["rust:lint"],
        cache: {
          input: [...RUST, "packages/kirana/fixtures/**"],
          output: [],
        },
      },
      "rust:lint": {
        command: "bun run check:rust",
        cwd: "packages/kirana",
        cache: { input: RUST, output: [] },
      },
      // The Zed extension, a Cargo project of its own outside the engine's workspace, so `cargo fmt
      // --all` there does not reach it: the checks CI's editors job runs, without its wasm build.
      zed: {
        command: "bun run check:zed",
        cwd: "packages/kirana",
        cache: {
          input: [
            "packages/kirana/editors/zed/**",
            "!packages/kirana/editors/zed/target/**",
            // rustfmt reads its settings from the nearest parent that has them.
            "packages/kirana/rustfmt.toml",
          ],
          output: [],
        },
      },
      // Vitest: the Kirana packages against the engine, and the docs content engine. Each runs in
      // its package, which some tests take as the working directory.
      "test:kirana": {
        command: "vp test run",
        cwd: "packages/kirana",
        dependsOn: ["engine"],
        cache: { input: SOURCES, output: [] },
      },
      "test:docs": {
        command: "vp test run",
        cwd: "packages/docs-core",
        cache: { input: SOURCES, output: [] },
      },
      test: {
        command: "echo Tests passed.",
        dependsOn: ["test:kirana", "test:docs"],
        cache: false,
      },
      // Rust and TypeScript coverage for the compiler: 100 % or it fails. It runs every Rust test
      // and the Kirana Vitest suite, with an instrumented engine swapped in for the duration, so it
      // waits for the tasks that load the engine instead of running beside them.
      coverage: {
        command: "bun run coverage",
        cwd: "packages/kirana",
        dependsOn: ["check", "verify", "rust:lint"],
        cache: {
          input: [...SOURCES, ...RUST, "packages/kirana/fixtures/**"],
          output: [],
        },
      },
      // What the compiler's output weighs and what its types cost, against budgets/budgets.json:
      // deterministic measures, so a pull request that changes them shows it in its diff.
      budgets: {
        command: "bun run budgets --check",
        cwd: "packages/kirana",
        dependsOn: ["engine"],
        cache: { input: SOURCES, output: [] },
      },
      // Every installed JavaScript dependency's licence against the policy in the script, as
      // cargo-deny holds the Rust ones; it changes only with the lockfile.
      licenses: {
        command: "bun scripts/check-licenses.ts",
        cache: { input: ["bun.lock", "scripts/check-licenses.ts"], output: [] },
      },
      // Everything CI requires of a pull request that runs on this machine; the pre-push hook.
      // Coverage holds the Rust and Kirana tests to 100 %, docs-core to its own floor.
      prepush: {
        command: "echo All checks passed.",
        dependsOn: ["coverage", "test:docs", "zed", "licenses", "budgets"],
        cache: false,
      },
    },
  },
  staged: {
    "*": "vp check --fix",
  },
  fmt: {
    endOfLine: "lf",
    semi: false,
    singleQuote: false,
    tabWidth: 2,
    trailingComma: "es5",
    printWidth: 80,
    sortPackageJson: false,
    ignorePatterns: [
      "**/dist/**",
      "**/build/**",
      "**/coverage/**",
      "**/.output/**",
      "**/.nitro/**",
      "**/.tanstack/**",
      "**/.vinxi/**",
      "**/routeTree.gen.ts",
      "bun.lock",
      "CHANGELOG.md",
      ".agents/**",
      ".claude/**",
      "packages/kirana/fixtures/**",
      "packages/kirana/budgets/budgets.json",
      "packages/kirana/target/**",
      "packages/kirana/npm/compiler/native.generated.d.ts",
      "packages/kirana/crates/**",
      "apps/docs/src/generated/**",
      "apps/docs/public/docs/**",
      "apps/docs/public/llms*.txt",
      "skills/kirana/references/diagnostics.md",
      "skills/kirana/references/lint.md",
    ],
  },
  lint: {
    plugins: ["import", "typescript", "unicorn", "react", "oxc"],
    jsPlugins: [
      {
        name: "kirana",
        specifier: "./packages/kirana/npm/eslint-plugin/src/index.ts",
      },
      {
        name: "vite-plus",
        specifier: "vite-plus/oxlint-plugin",
      },
    ],
    categories: {
      correctness: "error",
    },
    env: {
      builtin: true,
      es2020: true,
      browser: true,
    },
    ignorePatterns: [
      "**/dist/**",
      "**/build/**",
      "**/coverage/**",
      "**/.output/**",
      "**/.nitro/**",
      "**/.tanstack/**",
      "**/.vinxi/**",
      "**/routeTree.gen.ts",
      "**/vite.config.*.timestamp-*.*",
      "packages/kirana/fixtures/**",
      // Type-cost cases, measured by tsc; the `sx` ones pass a wrong value on purpose.
      "packages/kirana/budgets/types/**",
      // Templates installed from packed tarballs in a temporary directory, never in place, so
      // their imports cannot be type checked here; packages.yml builds every one for real.
      "packages/kirana/examples/**",
      // The bundler tests' sample apps, outside every tsconfig on purpose (packages/kirana/tsconfig.json).
      "packages/kirana/npm/*/test/app/**",
      "packages/kirana/npm/*/test/.app-*/**",
      "packages/kirana/npm/eslint-plugin/test/fixtures/**",
      "packages/kirana/npm/biome-plugin/test/fixtures/**",
      "packages/kirana/editors/vscode/test/fixture/**",
      "packages/kirana/editors/vscode/dist/**",
      "packages/kirana/editors/zed/target/**",
      "packages/kirana/target/**",
      "packages/kirana/npm/compiler/native.generated.d.ts",
      "packages/kirana/crates/**",
      "apps/docs/src/generated/**",
      "apps/docs/public/docs/**",
      "apps/docs/public/llms*.txt",
    ],
    rules: {
      // Type-aware rules that only find deliberate patterns here (reviewed 2026-10-13):
      // `useSyncExternalStore(store.subscribe, store.read)` with arrow-function members,
      // `String(value)` on bridged values and on `cx()`, which the compiler replaces with a class
      // string, and the one `new Function` that hides a runtime `import()` from bundlers.
      "typescript/unbound-method": "off",
      "typescript/no-base-to-string": "off",
      "typescript/restrict-template-expressions": "off",
      "typescript/no-implied-eval": "off",
      "kirana/diagnostics": "error",
      "kirana/sx-last": "error",
      "kirana/no-conflicting-props": "error",
      "kirana/override-keeps-conditions": "error",
      "kirana/no-classname-on-sx": "error",
      "kirana/no-unused": "error",
      "for-direction": "error",
      "no-async-promise-executor": "error",
      "no-case-declarations": "error",
      "no-class-assign": "error",
      "no-compare-neg-zero": "error",
      "no-cond-assign": "error",
      "no-constant-binary-expression": "error",
      "no-constant-condition": "error",
      "no-control-regex": "error",
      "no-debugger": "error",
      "no-delete-var": "error",
      "no-dupe-else-if": "error",
      "no-duplicate-case": "error",
      "no-empty-character-class": "error",
      "no-empty-pattern": "error",
      "no-empty-static-block": "error",
      "no-ex-assign": "error",
      "no-extra-boolean-cast": "error",
      "no-fallthrough": "error",
      "no-global-assign": "error",
      "no-invalid-regexp": "error",
      "no-irregular-whitespace": "error",
      "no-loss-of-precision": "error",
      "no-misleading-character-class": "error",
      "no-nonoctal-decimal-escape": "error",
      "no-regex-spaces": "error",
      "no-self-assign": "error",
      "no-shadow": "error",
      "no-shadow-restricted-names": "error",
      "no-sparse-arrays": "error",
      "no-unsafe-finally": "error",
      "no-unsafe-optional-chaining": "error",
      "no-unused-labels": "error",
      "no-unused-private-class-members": "error",
      "no-useless-backreference": "error",
      "no-useless-catch": "error",
      "no-useless-escape": "error",
      "no-var": "error",
      "no-with": "error",
      "prefer-const": "error",
      "require-yield": "error",
      "use-isnan": "error",
      "valid-typeof": "error",
      "import/consistent-type-specifier-style": ["error", "prefer-top-level"],
      "import/first": "error",
      "import/newline-after-import": "error",
      "import/no-commonjs": "error",
      "import/no-duplicates": "error",
      "unicorn/prefer-node-protocol": "error",
      "typescript/ban-ts-comment": [
        "error",
        {
          "ts-expect-error": false,
          "ts-ignore": "allow-with-description",
        },
      ],
      "typescript/consistent-type-imports": [
        "error",
        {
          prefer: "type-imports",
        },
      ],
      "typescript/method-signature-style": ["error", "property"],
      "typescript/no-duplicate-enum-values": "error",
      "typescript/no-extra-non-null-assertion": "error",
      "typescript/no-inferrable-types": [
        "error",
        {
          ignoreParameters: true,
        },
      ],
      "typescript/no-misused-new": "error",
      "typescript/no-namespace": "error",
      "typescript/no-non-null-asserted-optional-chain": "error",
      "typescript/no-unsafe-function-type": "error",
      "typescript/no-wrapper-object-types": "error",
      "typescript/prefer-as-const": "error",
      "typescript/prefer-for-of": "error",
      "typescript/triple-slash-reference": "error",
      "vite-plus/prefer-vite-plus-imports": "error",
    },
    overrides: [
      {
        files: ["packages/kirana/editors/**"],
        rules: {
          "kirana/diagnostics": "off",
          "kirana/no-unused": "off",
        },
      },
      {
        files: ["packages/kirana/editors/vscode/test/e2e/*.cjs"],
        rules: {
          "import/no-commonjs": "off",
        },
      },
    ],
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
})
