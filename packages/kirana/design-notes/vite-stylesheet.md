# The Vite stylesheet entry

## Summary

`@kirana-style/core/stylesheet.css` is a real file holding one placeholder rule. `@kirana-style/vite` serves the
live stylesheet through it in development and writes the finished stylesheet into its asset at the
end of a build.

## Context <!-- requirements and decisions implemented: KRN-INT-001, KRN-INT-002, KRN-INT-009, KRN-OUT-007 -->

The specification had adapters intercept the specifier with `resolveId`/`load`. A virtual CSS module
breaks `?url` imports, which TanStack Start's root route uses to emit a `<link>`, and a build asset
that only exists late cannot be referenced from chunks emitted early.

## Design

- The package exports the file, so every resolver finds it. The plugin's `load` hook (filtered to
  that id; `?url`, `?raw` and `?inline` imports are left to Vite, which reads the file) returns `driver.stylesheet(false)` in development and the
  placeholder rule in builds.
- Every transform reports `cssChanged`; in development a debounced `scheduleCssUpdate` reloads the
  stylesheet module in the client environment and sends a CSS update, so no page reload happens.
  `hotUpdate` calls `driver.invalidate(file)` and invalidates the importers the engine returns.
- In a build, `generateBundle` with `order: "post"` finds the asset containing the placeholder rule,
  replaces the rule with `driver.stylesheet(true)`, re-emits it under a content-hashed name
  (`renameAsset`) and rewrites every chunk and asset that named the old file — `index.html` and
  server chunks included. One Driver session is shared by the client and SSR environments.
- `buildEnd` reports project-wide diagnostics (relations, collisions) that no single module owns.

## Alternatives considered

- **A virtual module**: breaks `?url` and plain CSS imports in some pipelines.
- **Injecting a `<link>`**: framework-specific, and wrong for SSR frameworks that own the head.

## Consequences

- An app without the adapter still resolves the import and gets the placeholder rule, which styles
  nothing.
- A server-only module that adds atoms after the client asset is renamed is not reflected in it;
  carried in the implementation tracker.

## Related

`spec/11-integrations.md#stylesheet-entry`, `npm/vite/test/vite.test.ts`.
