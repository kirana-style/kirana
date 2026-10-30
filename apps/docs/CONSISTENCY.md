# Consistency

A page that says Kirana has 41 diagnostics when it has 45, lists six frameworks when there are
sixteen, or shows a box icon where StyleX's logo belongs tells a reader the rest may be stale too.
Every one of those happened. This file is how the site keeps from saying two things.

## The rule: state a fact once, read it everywhere

| Fact                                            | Its source                                                                                                     | How a page uses it                                                                                                          |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Diagnostics: codes, names, count                | `crates/kirana_diagnostics` → `src/generated/diagnostics.gen.ts`                                               | `DIAGNOSTICS`, `COUNTS.diagnostics`; markdown `{{fact:diagnostics}}`                                                        |
| Lint rules: names, configs, Biome               | `npm/eslint-plugin`, `npm/biome-plugin` → `src/generated/lint.gen.ts`                                          | `LINT`, `COUNTS.lintRules`, `COUNTS.biomeRules`; `{{fact:lint-rules}}`, `{{fact:biome-rules-word}}`                         |
| Packages and versions                           | `npm/*/package.json` → `src/generated/packages.gen.ts`                                                         | `PACKAGES` (the home page's groups, `/ecosystem`)                                                                           |
| `kirana` commands, `@kirana-style/core` exports | `crates/kirana_cli`, `npm/compiler/src/cli.ts`, `npm/core/src/index.ts` → `src/generated/cli.gen.ts`           | `COMMANDS`, `API`; `{{fact:api}}`                                                                                           |
| Frameworks, server frameworks, bundlers         | the install guides, `src/data/frameworks.ts`                                                                   | `LISTS.*` with `sentence()`; `{{fact:frameworks}}`, `{{fact:libraries}}`, `{{fact:server-frameworks}}`, `{{fact:bundlers}}` |
| Linters                                         | `src/data/tooling.ts` (`LINTERS`)                                                                              | `LISTS.linters`; `{{fact:linters}}`, `{{fact:linters-or}}`                                                                  |
| What agents get                                 | `src/data/facts.ts` (`LISTS.agents`)                                                                           | `{{fact:agents}}`                                                                                                           |
| Brand logos                                     | `scripts/generate-svgl.ts` → `SVGL`                                                                            | `BrandIcon`, `Tile brand=`, a tool's `logo`                                                                                 |
| Compare cells                                   | `src/data/compare.ts`, each with its source                                                                    | the `/compare` table                                                                                                        |
| Measured numbers and claims                     | kirana-lab's newest run → `src/data/benchmarks.json` (`scripts/take-benchmarks.ts`, the `benchmarks` workflow) | `METRICS`, `HEADLINES`, `CLAIMS`; `{{fact:bench-build-stylex}}` and the other `bench-` facts; `<!-- ::benchmarks -->`       |
| The runtime's size                              | KRN-DYN-005, asserted in `npm/core/test/internal.test.ts` → `RUNTIME_SIZE` in `src/data/benchmarks.ts`         | `RUNTIME_SIZE`; `{{fact:runtime-size}}`                                                                                     |
| Whether the packages are on npm                 | `npm/*/package.json` (`private`) → `PUBLISHED` in `src/data/release.ts`                                        | the `<!-- ::npm-status -->` embed (`kind="helpers"` on a server framework's guide), from `src/data/npm-status.ts`           |
| The mental model's ideas                        | its numbered headings (`## 1 · …`) in `content/docs/start/mental-model.md`                                     | the number is checked wherever a page says "N ideas"                                                                        |

`src/data/facts.ts` gathers the counts and lists. Components import `COUNTS`, `LISTS` and
`sentence()`; markdown writes `{{fact:name}}`, which the content generator fills in from `FACTS` —
an unknown name fails the build, and a new diagnostic or rule changes every page on the next build.

The links every page's header and footer carry (`GITHUB`, `NPM`) live in `src/data/links.ts`, and
the release (`VERSION`, `PUBLISHED`) in `src/data/release.ts`. `facts.ts` re-exports both, but a
component on every page imports them from there: `facts.ts` reads the diagnostics, the benchmark
runs and the framework guides, and whatever imports it puts them in that page's first download.

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
- **a menu item in another scene than its page**: the header's icons wear the hue of the page they
  lead to, so an item's `scene` in `nav.ts` must be the one its page's `<Page scene>` names, and a
  docs link's hue its tab's;
- **a product's name beside a generic icon** in a heading, where its logo belongs;
- **a lint rule missing** from the lint page, the rule cards, spec 12 or a plugin README;
- **a command missing** from the CLI page, its description or spec 12.
- **a `/docs/<page>#<heading>` link** to a page or a heading that does not exist;
- **a scales colour written flat** (`color.zinc500`) where the preset nests it by hue (`color.zinc[500]`).

A list that is deliberately partial (the frameworks with single-file components, the hosts with hot
updates) is marked on the line before it: `<!-- consistency: subset -->` in markdown,
`// consistency: subset` above a string in a component, or inline at the end of a table cell. A
passage about the past (a finished sprint) takes `<!-- consistency: history -->`; a count of
something else (CSS rules in a code lens) takes `consistency: ignore`. The changelog and the blog
are dated, so they are exempt.

In a component the check reads the string literals, with comments skipped in the same pass: a
backtick in a comment once opened a false template literal that hid the real strings after it.

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

## What was found, 2026-10-30: guides, hosts, tooling and summaries

| #   | Where                                                            | What it said                                                                                                         | What was true                                                                   |
| --- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 29  | Symfony guide, server templates                                  | `kirana-style build --minify`                                                                                        | `build` needs `--out` (and the paths), so that line fails                       |
| 30  | Next.js guide, the webpack README                                | CSS hot updates "not implemented" for webpack                                                                        | the adapter rewrites a live file and webpack sends the hot update (KRN-INT-009) |
| 31  | Next.js guide                                                    | a link to `bundlers#nextjs`                                                                                          | no such section                                                                 |
| 32  | Status, `/migrate`                                               | links to a Tailwind section under an old heading                                                                     | `#measured-the-tailwind-original-of-our-shadcn-ui-port`                         |
| 33  | The npm-status note's tarball link                               | `#install-from-tarballs`                                                                                             | `#from-tarballs`                                                                |
| 34  | `docs/project/ecosystem`, `/ecosystem`                           | frameworks without Next.js, Remix, Waku, Vike, Docusaurus, SolidStart, VitePress; no Storybook; no `kirana-style ui` | every guide, and the registry commands                                          |
| 35  | Status                                                           | the command line without `analyze` or `ui`                                                                           | both built                                                                      |
| 36  | `/compiler`, the CLI card                                        | build, check, export and trace                                                                                       | init, doctor, dev, analyze, migrate and ui too                                  |
| 37  | `/ecosystem`, package groups                                     | no `@kirana-style/remix`, `states` or `registry`; "the kirana command"                                               | 24 packages, all listed; the command is `kirana-style`                          |
| 38  | CLI page                                                         | `check` without `--stats`                                                                                            | the flag exists                                                                 |
| 39  | The compiler README                                              | `check --format human\|json`; `bun run kirana:build` "through Turbo"                                                 | `github` too; `vp run engine`, and there is no Turbo                            |
| 40  | The core README                                                  | no `own()`; "feasibility phase", TypeScript source                                                                   | `own()` is exported; the package ships JavaScript and declarations              |
| 41  | The Vite README, the registry README                             | no `names: "dense"`; `ui init` without `--preset`, `--overwrite`, `--no-check`                                       | all are options                                                                 |
| 42  | Root README                                                      | `node_modules/.bin/kirana`                                                                                           | the binary is `kirana-style`                                                    |
| 43  | The `kirana` skill's frameworks reference, the agent-skills page | bundlers without PostCSS; the linters typed as a list                                                                | PostCSS too; `{{fact:linters-or}}`                                              |

Again a summary written when a feature landed and not revisited (34–37, 43), a README left behind
by its package (39–41), and a link to a heading since renamed (31–33).

## What was found, 2026-10-30: start, styling, tokens, configuration and reference

| #   | Where                                                | What it said                                                                                  | What was true                                                                                   |
| --- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 44  | Semantic tokens, themes and modes, the scales preset | `color.zinc50`, `color.amber500`, `color.violet500`                                           | `color` is grouped by hue: `color.zinc[50]`                                                     |
| 45  | Utility strings, the object a string stands for      | `paddingInline: { default: … }`                                                               | the unconditional key is `base`; `default` is StyleX's                                          |
| 46  | Configuration reference, scale rule options          | `iconLibrary` and `design` among a scale rule's options                                       | both are `ui` keys, read by `kirana-style ui`                                                   |
| 47  | Configuration reference, `ui`                        | `ui: { preset: "k0" }`; `framework` as package names (`solid-js`, `@angular/core`)            | no `preset` key (`ui preset` writes `design`); the values are `solid`, `angular` …              |
| 48  | Configuration reference, `conditions.ownAttributes`  | a link to `api#ownattributes`                                                                 | `#own-attributes`                                                                               |
| 49  | API reference                                        | `defineTokens` options without `runtime`; no `CounterStyle`; four entry points                | `runtime: true` (D-086); `CounterStyle` is exported; the framework type entries and `class-map` |
| 50  | Layers, tiers                                        | `@layer t0, t1, t2;` for two tiers; "2.3 % gzipped on this site"                              | tiers are numbered by the ones used, so `t0, t1`; a measure with no source in the data          |
| 51  | Your first component                                 | "thirteen classes", typed                                                                     | fifteen rules; the Classes tab counts only the unconditional ones                               |
| 52  | Mental model, the editor window                      | the hint on `<article>` pushed to its own line by the formatter, after a `{" "}`              | `<!-- prettier-ignore -->` keeps a hint on its element's line                                   |
| 53  | Why Kirana                                           | editors: VS Code, Zed, Neovim and Helix; "published" as something StyleX has and Kirana lacks | its forks and any LSP editor too (`EDITORS`); every package is on npm                           |
| 54  | Component states                                     | Reka UI and Bits UI among the libraries without a vocabulary                                  | both have one                                                                                   |
| 55  | The scales preset                                    | exports without `textShadow`; "7,391 utilities", typed                                        | `textShadow` is exported; the test asserts no count                                             |
| 56  | Anchor positioning                                   | `--kp9KfV` for a block without `width`                                                        | the name is the fixture's, whose block sets `width: anchor-size(width)`                         |
| 57  | Tokens                                               | `el.style.gap = space.lg`, on a page whose `space` has no `lg` and is not variable            | a variable token of that page, `theme.text`                                                     |

The causes: an access path or key written from memory rather than from the package (44, 45, 57),
rows filed under the wrong key (46, 47), and numbers typed into prose (50, 51, 55).
