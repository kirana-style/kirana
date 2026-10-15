# Consistency

A page that says Kirana has 41 diagnostics when it has 45, lists six frameworks when there are
sixteen, or shows a box icon where StyleX's logo belongs tells a reader the rest may be stale too.
Every one of those happened. This file is how the site keeps from saying two things.

## The rule: state a fact once, read it everywhere

| Fact                                            | Its source                                                                                             | How a page uses it                                                                                                          |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| Diagnostics: codes, names, count                | `crates/kirana_diagnostics` → `src/generated/diagnostics.gen.ts`                                       | `DIAGNOSTICS`, `COUNTS.diagnostics`; markdown `{{fact:diagnostics}}`                                                        |
| Lint rules: names, configs, Biome               | `npm/eslint-plugin`, `npm/biome-plugin` → `src/generated/lint.gen.ts`                                  | `LINT`, `COUNTS.lintRules`, `COUNTS.biomeRules`; `{{fact:lint-rules}}`, `{{fact:biome-rules-word}}`                         |
| Packages and versions                           | `npm/*/package.json` → `src/generated/packages.gen.ts`                                                 | `PACKAGES` (the home page's groups, `/ecosystem`)                                                                           |
| `kirana` commands, `@kirana-style/core` exports | `crates/kirana_cli`, `npm/compiler/src/cli.ts`, `npm/core/src/index.ts` → `src/generated/cli.gen.ts`   | `COMMANDS`, `API`; `{{fact:api}}`                                                                                           |
| Frameworks, server frameworks, bundlers         | the install guides, `src/data/frameworks.ts`                                                           | `LISTS.*` with `sentence()`; `{{fact:frameworks}}`, `{{fact:libraries}}`, `{{fact:server-frameworks}}`, `{{fact:bundlers}}` |
| Linters                                         | `src/data/tooling.ts` (`LINTERS`)                                                                      | `LISTS.linters`; `{{fact:linters}}`, `{{fact:linters-or}}`                                                                  |
| What agents get                                 | `src/data/facts.ts` (`LISTS.agents`)                                                                   | `{{fact:agents}}`                                                                                                           |
| Brand logos                                     | `scripts/generate-svgl.ts` → `SVGL`                                                                    | `BrandIcon`, `Tile brand=`, a tool's `logo`                                                                                 |
| Compare cells                                   | `src/data/compare.ts`, each with its source                                                            | the `/compare` table                                                                                                        |
| The runtime's size                              | KRN-DYN-005, asserted in `npm/core/test/internal.test.ts` → `RUNTIME_SIZE` in `src/data/benchmarks.ts` | `RUNTIME_SIZE`; `{{fact:runtime-size}}`                                                                                     |
| Whether the packages are on npm                 | `npm/*/package.json` (`private`) → `PUBLISHED` in `src/data/facts.ts`                                  | the `<!-- ::npm-status -->` embed (`kind="helpers"` on a server framework's guide), from `src/data/npm-status.ts`           |
| The mental model's ideas                        | its numbered headings (`## 1 · …`) in `content/docs/start/mental-model.md`                             | the number is checked wherever a page says "N ideas"                                                                        |

`src/data/facts.ts` gathers the counts and lists. Components import `COUNTS`, `LISTS` and
`sentence()`; markdown writes `{{fact:name}}`, which the content generator fills in from `FACTS` —
an unknown name fails the build, and a new diagnostic or rule changes every page on the next build.

## The check

`vp run check` and CI's `verify:generated` run `apps/docs/scripts/check-consistency.ts`. It fails
on:

- **a count written by hand** — "45 diagnostics", "45 checks with codes", "four rules", "20 packages";
- **a number of ideas** other than the mental model's own;
- **the runtime's size written by hand** ("under 1 kB") instead of `{{fact:runtime-size}}`;
- **"not on npm" anywhere** once `PUBLISHED` is true, so publishing cannot leave a stale notice
  behind (the note's own source, `npm-status.ts`, is exempt: no page shows it then);
- **an em dash** in a page, a blog post, the site's copy, a README or the contributor's guide (code
  is exempt): a comma, a colon, brackets or a full stop says it better;
- **a paragraph or list item with more than four inline code spans** in the docs: make it a list, a
  table or a code block;
- **a description written as metadata** ("X - y"): it is the page's lede, shown under its title;
- **the command under its old name** in pages, components, showcase snippets, READMEs, the agent
  skills and the examples' commands (their `package.json` scripts and `kirana-example` arrays, each
  array read as the command line it starts): a subcommand after a bare `kirana`, or `npx`, `bunx`, `pnpm dlx` or `yarn dlx` given a bare
  `kirana`. The command is `kirana-style` everywhere (D-082): npm does not give out `kirana`, so a
  runner would fetch whatever has that name;
- **a partial list that reads as complete** — half or more of the frameworks, component layers,
  server frameworks, bundlers, linters or `@kirana-style/core` exports, but not all of them;
- **agents offered llms.txt without the skills**;
- **a product's name beside a generic icon** in a heading, where its logo belongs;
- **a lint rule missing** from the lint page, the rule cards, spec 12 or a plugin README;
- **a command missing** from the CLI page, its description or spec 12.

A list that is deliberately partial (the frameworks with single-file components, the hosts with hot
updates) is marked on the line before it: `<!-- consistency: subset -->` in markdown,
`// consistency: subset` above a string in a component, or inline at the end of a table cell. A
passage about the past (a finished sprint) takes `<!-- consistency: history -->`; a count of
something else (CSS rules in a code lens) takes `consistency: ignore`. The changelog and the blog
are dated, so they are exempt.

## When you add something

1. Add it where it is owned (a guide in `frameworks.ts`, a rule in the plugin, a command in the CLI);
   the generated data and `FACTS` follow.
2. Write about it with `{{fact:…}}` or `LISTS`, never a typed count or list.
3. A product it names shows its logo; add the logo to `generate-svgl.ts` if the site lacks it.
4. Run `vp run check`. Fix what it reports rather than marking it, unless the list really is a
   subset.

## What was found, 2026-10-12

Every mismatch found in the review that led to this file, so the patterns are visible.

| #   | Where                                                                          | What it said                                                                           | What was true                                                       |
| --- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| 1   | Home, "Connect" — Lint card                                                    | Oxlint and ESLint, in the drawing and the text                                         | Biome too (`@kirana-style/biome-plugin`)                            |
| 2   | Home, "Connect" — Language models card                                         | llms.txt only                                                                          | the agent skills too                                                |
| 3   | Home, "Connect" — CLI card                                                     | build, check and trace                                                                 | export, and GitHub annotations                                      |
| 4   | 404 page, Lint link                                                            | "in Oxlint or ESLint"                                                                  | Biome too                                                           |
| 5   | Home, "Written well by agents"                                                 | llms.txt only; no `kirana-style export`                                                | skills and export                                                   |
| 6   | Home FAQ, "Can my AI tools read these docs?"                                   | llms.txt only                                                                          | the skills too                                                      |
| 7   | Header menu, footer                                                            | no Agent skills page; no Lint link                                                     | both exist                                                          |
| 8   | `/ecosystem` tooling, `integrations/ecosystem`                                 | no export, `doctor --report`, Biome or skills                                          | all built                                                           |
| 9   | Roadmap, `/changelog`                                                          | stopped before sprints 10 and 11                                                       | both done                                                           |
| 10  | `/migrate`, both migration guides                                              | no mention of the migrate skill                                                        | it exists                                                           |
| 11  | Status, Why Kirana, the brand wording                                          | 41 diagnostics                                                                         | 45                                                                  |
| 12  | Migrating from StyleX                                                          | 39 codes                                                                               | 45                                                                  |
| 13  | Home, Packages                                                                 | no lint packages; the adapters card missed Gatsby, Angular, Ember, Parcel and AdonisJS | 20 packages, all listed                                             |
| 14  | `/ecosystem` package count                                                     | 18 packages                                                                            | 20 (the generator skipped the lint plugins)                         |
| 15  | Spec 15, decision on lint                                                      | parity for Oxlint and ESLint; "nine rules"                                             | Biome parity; eleven rules                                          |
| 16  | `/migrate`, before and after                                                   | plain grey code boxes                                                                  | the homepage's editor scene                                         |
| 17  | `/migrate`, codemod commands                                                   | a plain BASH box without prompts                                                       | a terminal window (the snippet generator highlighted shell as code) |
| 18  | `/why`, `/compiler`, the benchmark chart                                       | raw `<code>`                                                                           | highlighted inline code                                             |
| 19  | `/compare` header                                                              | Kirana's tile with an accent border the others lack; StyleX's logo faint at 16 px      | one tile style; logos at 20 px                                      |
| 20  | `/migrate`, From StyleX                                                        | a generic package icon                                                                 | StyleX's logo, as Tailwind's beside it                              |
| 21  | Docs home                                                                      | frameworks without React Router and Gatsby; a partial bundler list                     | all of them, from the guides                                        |
| 22  | Why Kirana                                                                     | frameworks without Ember; bundlers without Parcel                                      | all                                                                 |
| 23  | Migrating from StyleX, "Hosts and frameworks"                                  | six frameworks, no Parcel                                                              | all                                                                 |
| 24  | Status                                                                         | the API without `firstThatWorks`, `positionTry`, `viewTransition`; `sx` without Ember  | every export, every layer                                           |
| 25  | API reference keywords                                                         | no `media`, `container`, `supports`                                                    | all exports                                                         |
| 26  | CLI page description                                                           | no `lsp`                                                                               | every command                                                       |
| 27  | Home FAQ, brand wording                                                        | frameworks without Ember; bundlers without Rsbuild and Parcel                          | all                                                                 |
| 28  | Lint docs, status, roadmap, `/compare`, `/ecosystem`, the ESLint plugin README | "four rules" typed in six places; "eight rules" for the skill                          | from `COUNTS` / `{{fact:…}}`, or no number                          |

The causes repeat: a list typed in prose when the feature landed and never revisited (11–14, 21–27);
a new capability added to its own page but not to the summaries that list capabilities (1–10); and a
page that drew its own version of a shared component (16–20).
