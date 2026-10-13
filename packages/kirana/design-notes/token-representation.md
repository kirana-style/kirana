# Token representation

## Summary

A token compiles to an inlined literal, an inlined `light-dark()` value, or a custom property, decided
by its definition alone.

## Context <!-- requirements and decisions implemented: KRN-TOK-003, KRN-TOK-005, KRN-TOK-006, KRN-TOK-010, D-035 -->

The specification first chose by usage: a token became a variable when a theme overrode it anywhere in
the project. Under incremental compilation that meant a module's output depended on whether the
theme's module had compiled yet, and a runtime value of the token had no fixed text.

## Design

- `kirana_evaluator::api` evaluates `defineTokens(namespace, values, options)` into `TokenDef`s. Each
  leaf is a plain value, a `{ light, dark }` mode object, or carries `variable: true`; the group option
  `{ variable: true }` marks every leaf.
- Representation, in `TokenRef`: plain → the literal (`css` is the value, `variable` is `None`);
  colour modes → `light-dark(light, dark)` inlined; `variable` or a non-colour mode →
  `var(--kv…)` with `variable` set. `kirana_cascade::is_color` decides "colour" by parsing with
  Lightning CSS.
- The variable name is `Names::token_variable([package, namespace, path])`: package-scoped,
  path-independent.
- `kirana_emit` writes variable tokens into `kirana.tokens` on `:root`; a non-colour mode token adds
  a `prefers-color-scheme: dark` override and `.km-light` / `.km-dark` overrides that the `mode`
  handles apply.
- A variable token used as a computed key (`Key::Token`) assigns its property like a `--custom`
  property; a non-variable one is `token-not-variable`. `defineTheme` accepts only variable tokens.
- Replication (`kirana_cascade::declare_with`) asks the project for a variable's declared values so a
  box shorthand written as one bare `var()` still splits when every value is a single component.

## Alternatives considered

- **Usage-based choice** (D-008): non-deterministic under incremental builds, rejected.
- **Everything a variable**: 290 palette colours as properties on every page.

## Consequences

- Authors mark the few tokens a theme or a parent must reassign. The StyleX port's `defineVars` groups
  mapped one-to-one to `variable: true` groups.
- Changing a token from constant to variable changes every atom that uses it; the registry picks that
  up through provenance hashes like any export change.

## Related

`spec/07-tokens-themes-presets.md#inlined-or-variable`.
