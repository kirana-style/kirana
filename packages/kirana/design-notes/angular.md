# Angular

## Summary

`@kirana-style/angular` supports Angular built by Analog (Vite) and by the Angular CLI. Templates style an
element with the `[sx]` directive, which merges the handles in the browser with Kirana's private
runtime. The `css({...})` calls in a component's TypeScript are compiled as anywhere else, so the
stylesheet and the class names are the ones a JSX app gets. Analog is compiled after Angular, by the
Vite adapter with `enforce: "post"`; the CLI is given a compiled mirror of the sources through
`fileReplacements`, by two builders that wrap Angular's.

## Context <!-- requirements and decisions implemented: KRN-INT-004, D-028, D-068 -->

Doc 11 listed Angular as P2 with a "template adapter (later)". Three things set it apart from every
framework Kirana already supported:

- **Templates reach only component members.** An expression in a template is evaluated against the
  component instance, never against the module, so `sx` there names a member that holds handles, not
  a `css()` call the compiler can see. Rewriting it at build time would mean running Angular's
  template compiler, a framework engine D-028 rules out.
- **Angular compiles TypeScript from its own program on disk.** `@angular/build`'s compiler plugin
  and Analog's `fileEmitter` both read sources through Angular's TypeScript host, so a bundler plugin
  that transforms a source never reaches Angular's compiler.
- **Analog emits one JavaScript module per file**, with its imports intact, and Vite runs later
  plugins on it. The CLI's esbuild pipeline has no such hook.

## Design

- **The directive** (`src/fesm2022/directive.ts`): `SxDirective`, standalone, selector `[sx]`, input
  `sx: Sx | Handle` (the CLI type-checks the compiled copy, where a handle is a class string). On each
  change it calls `applySx` (`src/sx.ts`), which merges with `runtime(prefix, "class")` from
  `@kirana-style/core/internal` and diffs against what it applied last: `Renderer2.addClass`/`removeClass`
  for classes and `setStyle`/`removeStyle` with the dash-case flag for bridged custom properties. The
  element's own `class` and `style` are never touched. `KIRANA_PREFIX` (root-provided, `"k"`) and
  `provideKirana({ prefix })` carry `names.prefix`.
- **Partial declarations by hand.** A library ships `ɵɵngDeclareFactory`/`ɵɵngDeclareDirective` calls,
  which Angular's linker compiles in each app build. `ngc` normally writes them; this workspace's
  TypeScript 7 has no JavaScript API for it to run on, so they are written out, with the static types
  `ngc` would declare (`ɵɵDirectiveDeclaration<…, "[sx]", …, { sx: … }, …, true, …>`), which is what
  makes Angular type-check `[sx]` against `Sx`.
- **Analog**: `kiranaAngular()` (`@kirana-style/angular/vite`) takes `@kirana-style/vite`'s two plugins and sets
  `enforce: "post"` on the first, so it transforms the JavaScript Angular emitted.
- **The CLI** (`src/mirror.ts`, `src/builders.ts`): `@kirana-style/angular:application` and
  `:dev-server`.
  - `createMirror` walks the source root and writes `.kirana/<sourceRoot>/…`: a style-bearing script
    (`shouldCompile`) compiled by the Driver, every other file copied, so the compiled copy's relative
    imports and `templateUrl`s resolve inside the mirror. It writes `.kirana/kirana.css` only when its
    text changed.
  - `withMirror` adds a `fileReplacements` entry for every TypeScript file except `.d.ts` files and
    the entries (`browser`, `server`), and appends the stylesheet to `styles`.
  - `application` runs `buildApplication` with those options; with `watch`, `watchMirror` mirrors each
    change and the modules `invalidate` names, and Angular, which watches replacements, rebuilds.
  - `devServer` runs `executeDevServerBuilder` with a context whose `getTargetOptions` returns the
    build target's options through `withMirror`; Angular reads them that way itself.
  - Diagnostics print through the builder's logger; infos stay quiet.

## Findings

- **The linker runs only on package-format paths.** Analog's Vite plugin links a file only when its
  path matches `/fesm20/`. With the directive at `src/directive.js` the Analog build ran and the page
  failed with "JIT compiler unavailable"; under `src/fesm2022/` it links.
- **The linker reads literals.** A `version` taken from a constant failed with "Unsupported syntax,
  expected a string literal", so each declaration spells `"22.2.1"`.
- **The entries are not replaced.** Replacing `src/main.ts` made Angular warn "File
  '.kirana/src/main.ts' not found in TypeScript compilation", because an entry it reads from a
  replacement is bundled unchecked. An entry holds no styles; the components it imports are replaced.
- **The original and the copy must not both be in the program.** With `include: ["src/**/*.ts"]`
  Angular type-checked both, so the app's `tsconfig.app.json` lists only `src/main.ts` in `files` and
  includes `src/**/*.d.ts`.
- **Schemas are vendored.** A builder whose schema allows any property made `ng serve` reject
  `--port` and `--host` ("Unknown arguments"); a schema path into `@angular/build` was refused because
  Architect resolves a builder's schema only inside its package. `schemas/application.json` and
  `schemas/dev-server.json` are copies of `@angular/build`'s, and `test/builders.test.ts` fails when
  they differ from the installed ones.

## Verification

- `test/angular.test.ts` and `test/builders.test.ts`: the merge and its diffing, the directive in an
  injector, the Vite plugin's order, the mirror (compile, copy, delete, unchanged stylesheet,
  replacements), watching (hidden and skipped folders ignored), both builders with a mocked
  `@angular/build`, and the schema copies. 100 % statements, branches, functions and lines.
- `examples/analog-angular` and `examples/angular-cli`, from packed tarballs (`bun run
  kirana:example <name> --pm npm`, and `--dev`): the probe's computed colour, padding and hover in
  Chromium, and a style edit reaching the page on the dev server. Both run in the `compat` and `dev`
  jobs of `.github/workflows/packages.yml`.
- `kirana-style init --yes` on copies of both examples stripped of Kirana, then built as above.

## Costs

- **The merge runs in the browser**, in the private runtime (under 1 kB gzipped), where JSX and the
  component frameworks merge at build time.
- **The CLI compiles the source root twice**: once into the mirror, once by Angular from it.
- **The directive's declarations track Angular's partial-declaration format** by hand. Angular keeps
  that format stable across majors (it is what published libraries ship), and both examples link it
  on every CI run.
