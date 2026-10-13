# The Kirana specification

What Kirana must do, written as numbered requirements (`KRN-…`), and why it is
built the way it is, as numbered decisions (`D-…`). The code and the design notes
cite both, so every reference resolves to a document here.

| Document                                                       | What it specifies                                                 |
| -------------------------------------------------------------- | ----------------------------------------------------------------- |
| [00 — Glossary](00-glossary.md)                                | The terms the other documents use                                 |
| [06 — Authoring API](06-authoring-api.md)                      | `css`, recipes, relations, `sx` and the types around them         |
| [07 — Tokens, themes and presets](07-tokens-themes-presets.md) | Tokens, `light-dark()` colours, themes and installable presets    |
| [08 — Conditions and cascade](08-conditions-and-cascade.md)    | Conditions, layers and the precedence ladder                      |
| [09 — Dynamic styles](09-dynamic-styles.md)                    | Runtime values and the private merge runtime                      |
| [10 — Compiler architecture](10-compiler-architecture.md)      | The engine's stages, hashing and class names                      |
| [11 — Integrations](11-integrations.md)                        | Frameworks, bundlers, server templates and the configuration file |
| [12 — Tooling and developer experience](12-tooling-and-dx.md)  | The CLI, the language server, lint rules and diagnostics          |
| [13 — Output and performance](13-output-and-performance.md)    | What the stylesheet contains and the budgets it is held to        |
| [14 — Benchmark methodology](14-benchmark-methodology.md)      | How performance claims are measured                               |
| [15 — Testing and conformance](15-testing-and-conformance.md)  | Golden fixtures, coverage and computed-style conformance          |
| [20 — Decision log](20-decisions.md)                           | Every design decision, with the alternatives and the evidence     |

A change to the compiler's behaviour updates the matching document in the same
pull request; a new design choice gets a decision in the log.
