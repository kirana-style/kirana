# The CLI
Source: https://kirana.style/docs/tooling/cli

# The CLI

The `kirana-style` command, by what it does:

| What it does                            | Commands                              |
| --------------------------------------- | ------------------------------------- |
| Sets a project up, and checks the setup | `init`, `doctor`                      |
| Compiles without a bundler              | `build`, `dev`                        |
| Reports                                 | `check`, `analyze`, `export`, `trace` |
| Rewrites other styling systems          | `migrate`                             |
| Serves your editor                      | `lsp`                                 |

In a project without Kirana, run it without installing anything: your package
manager's runner fetches it for one run, as `npx shadcn@latest` does.

```bash
# npm
npx kirana-style@latest init
# pnpm
pnpm dlx kirana-style@latest init
# yarn
yarn dlx kirana-style@latest init
# bun
bunx --bun kirana-style@latest init
# deno
deno run -A npm:kirana-style@latest init
```

Once it is installed, the package manager runs the project's own copy:

```bash
# npm
npx kirana-style check
# pnpm
pnpm exec kirana-style check
# yarn
yarn kirana-style check
# bun
bunx kirana-style check
# deno
deno run -A npm:kirana-style check
```

`init` adds `kirana-style` to the project's dev dependencies, so every later run
uses the version the project pins, and the editor's language server comes from the
same install.

### A shorter name

The command is `kirana-style` everywhere: npm does not give out the plain name
`kirana`, so a bare `npx kirana` cannot run Kirana. For a shorter
name in your own project, add a script:

```json file="package.json"
{
  "scripts": {
    "kirana": "kirana-style"
  }
}
```

Then `npm run kirana -- check src`; pnpm, Yarn and Bun run scripts the same way. In your shell,
`alias kirana="npx kirana-style"` does the same for every project.

In this repository the binary runs through its entry script:

```bash
node packages/kirana/npm/cli/bin/kirana-style.ts <command>
```

## `kirana-style init`

Set a project up: the configuration file, the adapter in your bundler's
configuration, the stylesheet, and the types for `sx`.

```bash
kirana-style init             # show the changes, ask, write them
kirana-style init --dry-run   # only show them
kirana-style init --yes       # write without asking
kirana-style init --install   # also run the install command
kirana-style init --preset    # with the scales preset (utilities)
```

It reads `package.json` and the lockfile to find the framework, the bundler and
the package manager (npm, pnpm, Yarn, Bun, or Deno from a `deno.lock`), then prints
every change as a diff before it writes anything:

```console
$ kirana-style init --dry-run
Next.js · turbopack · npm · TypeScript

+ config: create kirana.config.mts
+ adapter: add @kirana-style/next to next.config.ts, add @kirana-style/postcss to postcss.config.mjs
+ stylesheet: add @kirana; to app/globals.css
+ types: create kirana.d.ts

--- next.config.ts
  import type { NextConfig } from "next";
+ import { withKirana } from "@kirana-style/next";
  …
- export default nextConfig;
+ export default withKirana(nextConfig);
```


It knows Next.js (Turbopack and webpack), Nuxt, SvelteKit, Astro, TanStack Start,
Qwik, Angular (the CLI, whose `angular.json` builders it swaps, and Analog), React
Router, Gatsby, Ember, Meteor and Parcel; React, Preact, Solid, Vue, Svelte or
plain DOM on Vite, Rsbuild, Rspack, webpack and Rolldown; and the server frameworks
Laravel, Symfony, Rails, Phoenix and AdonisJS, which get a class map and a starter
style module. Edits follow the file's own quotes and semicolons. Where a
configuration is not in a shape it can edit safely (`module.exports`, a function,
a plugin list built elsewhere), it prints the step to do by hand instead of
guessing. The install command is your package manager's own (Deno's takes each
package as `npm:…`), printed, never run unless you pass `--install`, so your
lockfile stays yours.

Its last line names the next command the way your package manager runs it, such
as `pnpm exec kirana-style doctor`.

Its setups were checked the way the examples are: sixteen examples, stripped of
Kirana and set up again by `kirana-style init`, built from packed tarballs and styled
exactly like the hand-written ones in a browser.

## `kirana-style doctor`

Check a project's setup, and say what is missing.

```bash
kirana-style doctor
kirana-style doctor --json
kirana-style doctor --report
kirana-style doctor --report bug.md --trace src/card.tsx:12 minHeight
```

```console
$ kirana-style doctor
✓ engine       native (linux-x64)
✓ packages     @kirana-style/core@0.2.1, @kirana-style/next@0.2.1, kirana-style@0.2.1
✓ config       kirana.config.mts, prefix "k"
✓ project      Next.js · turbopack · npm · TypeScript
✓ adapter      next.config.ts, postcss.config.mjs
✓ stylesheet   app/globals.css
✓ types        kirana.d.ts
✓ cache        none on disk: every build compiles from source

All good.
```

It reports the engine in use (native, or the WebAssembly fallback), every
installed `@kirana-style/*` version and whether they match, whether the configuration
loads, and whether the adapter, stylesheet and types are in place, which it learns
by running `kirana-style init`'s plan without writing. The exit code is 1 when something fails.
There is no cache to clear: Kirana keeps nothing on disk between builds.

### A bug report

`--report` writes `kirana-report.md` (or the file after the flag): an issue body
with a place at the top for what happened and the smallest reproduction, then what
Kirana collected:

- the engine version, Node.js and OS, the framework and the bundler;
- every `@kirana-style/*` version, and the doctor's checks;
- each diagnostic code, how often it occurred and where first;
- the stylesheet's size and the resolved configuration.

`--trace <file>:<line> <property>` adds `kirana-style trace` output, and `--json` prints
the same data instead of writing the file.

```console
$ kirana-style doctor --report --trace src/card.tsx:12 minHeight
wrote kirana-report.md: describe what happened and add a reproduction at the top, read the rest, then paste it into an issue
```

The report is safe to paste. It contains no source code, the project directory
reads `<project>`, the home directory `~` and your user name `<user>`,
configuration values under keys that name a secret are masked, and no environment
variable is read. Read it before you post it anyway.

## `kirana-style dev`

Watch mode for projects without a bundler: plain HTML, web components, server
templates.

```bash
kirana-style dev src --out public/kirana.css
kirana-style dev --minify
```

It compiles every script under the paths (`src`, or the project when there is
none), writes the stylesheet (`kirana.css` unless `--out` says otherwise), and on
each change recompiles that file and the modules that read a value from it. The
stylesheet is rewritten only when it changed, and diagnostics print as they
appear:

```console
$ kirana-style dev src --out public/kirana.css
✓ public/kirana.css (4780 bytes, 8 file(s), 9 ms)
watching src
✓ public/kirana.css (4802 bytes, src/card.ts, 2 ms)
```

## `kirana-style check`

Report diagnostics without writing anything.

```bash
kirana-style check src
kirana-style check src --format json
kirana-style check src --format github --max-warnings 0
```

It walks the paths you give it, skipping `node_modules`, `dist`, dotfiles and
`.d.ts` files. Human output underlines the span and prints the help line:

```console
$ kirana-style check src
warning[KRN1703] sx-on-external-component: a component from "@base-ui/react"
receives `sx`, which it does not read (src/menu.tsx:14:7)
  help: spread the compiled props instead: {...props(styles.root, sx)}

1 diagnostic(s), 0 error(s)
```

`--format json` prints an array of `{ code, name, severity, file, span, message, help }`,
for an editor or a script. The exit code is 1 when anything is an error.

`--format github` prints one GitHub Actions workflow command per diagnostic, which
annotates the line in the pull request's diff: errors as errors, warnings as
warnings, infos as notices. Paths are relative to the project root, so run it from
the repository root or a project at the root.

`--max-warnings <n>` fails the run, exit code 1, when there are more than `n`
warnings; `0` makes every warning block a merge, without re-levelling them in the
configuration.

```yaml
# .github/workflows/ci.yml
- run: npx kirana-style check src --format github --max-warnings 0
```

## `kirana-style build`

Compile files and write the stylesheet.

```bash
kirana-style build src --out dist/kirana.css
kirana-style build src --out dist/kirana.css --minify
```

Useful when a bundler is not in the picture: a library build, a check in CI, or
looking at the CSS for yourself. Applications normally let the
[Vite plugin](/docs/integrations/vite) do this.

## `kirana-style analyze`

What the stylesheet holds, and why.

```bash
kirana-style analyze src
kirana-style analyze src --json
kirana-style analyze src --html report.html
```

```console
$ kirana-style analyze src
58 module(s), 1607 site(s), 851 atom(s), 39.2 kB stylesheet

Stylesheet by layer
  order                      91 B
  kirana.tokens            1.7 kB
  kirana.atoms            37.3 kB

Atoms by the number of sites applying them
  1          86 atom(s)
  2–4       518 atom(s)
  5–9       103 atom(s)
  10+       144 atom(s)

Most reused
   477 site(s) in  42 module(s)  k5O_fqMV  display: grid
   263 site(s) in  44 module(s)  k50_6mrG  color: var(--kviZP2)
```

That is this documentation site. The report goes on with the largest modules (the
bytes of their rules, and of the rules only they use, which is what deleting them
would save), then values bridged to runtime, recipes resolved at runtime,
themes and the tokens they override, relation reads no anchor proves, and tokens
your project declares that nothing reads. `--json` prints all of it;
`--html` writes one self-contained page, readable in light and dark. The exit
code is the same as `check`'s.

## `kirana-style export`

The design system, as JSON: every token with its value (and both halves of a
`light-dark()` pair), each theme and the tokens it overrides, each recipe with
its variant groups, options and defaults, every relation and where it is
anchored and read, and the keyframes, `positionTry` and `viewTransition` names.
Each comes with the file and line that declares it.

```bash
kirana-style export                       # print it
kirana-style export src --out design-system.json
```

```json file="design-system.json"
{
  "schema": 1,
  "engine": "0.2.1",
  "prefix": "k",
  "tokens": [
    {
      "identity": "color.brand",
      "value": "light-dark(#000, #fff)",
      "light": "#000",
      "dark": "#fff",
      "variable": true,
      "origin": "src/tokens.ts:2"
    }
  ],
  "themes": [
    {
      "name": "ocean",
      "origin": "src/design.ts:3",
      "class": "kt9fBs",
      "overrides": ["color.brand"]
    }
  ],
  "recipes": [
    {
      "name": "button",
      "origin": "src/design.ts:4",
      "variants": { "size": ["sm", "md"], "tone": ["quiet"] },
      "defaults": { "size": "md" },
      "compoundVariants": 1
    }
  ],
  "relations": [
    {
      "name": "field",
      "declaredIn": ["src/design.ts"],
      "anchoredIn": [],
      "readIn": []
    }
  ],
  "keyframes": [
    { "name": "spin", "origin": "src/design.ts:11", "css": "kfMMUp" }
  ],
  "positionTries": [
    { "name": "below", "origin": "src/design.ts:12", "css": "--kpd1Rq" }
  ],
  "viewTransitions": [
    { "name": "slide", "origin": "src/design.ts:13", "css": "kwTyjU" }
  ]
}
```

It is what a coding agent should read before writing a style (the tokens and
recipes that exist, by their real names), and what a design tool or a review needs
to see what a change did to the system. Names, values and project-relative
locations only, never source text; everything is sorted, so the file diffs cleanly
when it is committed. `schema` changes only when a field does. The exit code is
1 when the project has errors, as for `check`.

## `kirana-style trace`

Explain which declaration wins for a property, and why.

```bash
kirana-style trace src/components/card.tsx:24 padding-top
```

It prints one line per candidate: a marker for the winner, the value, the
conditions, the layer, and the ladder step that decided it.

```console
$ kirana-style trace src/components/card.tsx:24 padding-top
✓ 2px   base   kirana.atoms   step 5 (set 1 longhand < 4)
  1px   base   kirana.atoms
```

The property may be written the way you wrote it (`paddingTop`) or the way CSS
does (`padding-top`). Give it the line the style is on.

This is the tool for "why is this not applying". It answers from the compiled
result, not from reading the source.

## Exit codes

| Code | Meaning                                                       |
| ---- | ------------------------------------------------------------- |
| 0    | No errors                                                     |
| 1    | At least one error diagnostic, or a file could not be written |
| 1    | `doctor`: something failed; `init`: you said no               |
| 1    | `check --max-warnings n`: more than `n` warnings              |
| 2    | Bad configuration, or a malformed argument                    |

## `kirana-style migrate`

Rewrite another styling system's sources into Kirana, and report what it will
not decide for you.

```bash
kirana-style migrate tailwind src                    # print the diff and the report
kirana-style migrate tailwind src --write            # apply it
kirana-style migrate tailwind src --report todo.txt  # also save the report
kirana-style migrate stylex src --write
```

Nothing is written without `--write`. The report is printed either way: each
line is a file position and something a person has to do, and the utility it is
about is also left in a comment beside the style it belongs to.

`migrate tailwind` needs a [utility grammar](/docs/styling/utilities) (the preset
and your theme's scales), and reads `@custom-variant` and `@utility` from any CSS
file among its paths. See
[migrating from Tailwind](/docs/migration/from-tailwind#the-codemod).

## `kirana-style lsp`

Start the language server on stdin and stdout. Editors run it for you (see
[editor support](/docs/tooling/editor)), but any LSP client can:

```bash
kirana-style lsp
```

It loads `kirana.config.*` like every other command, indexes the project, and then
answers hover, colour, completion, inlay-hint, code-lens, definition, reference
and code-action requests from the same compiler session the build uses.
