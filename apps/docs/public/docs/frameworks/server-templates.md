# Server templates
Source: https://kirana.style/docs/frameworks/server-templates

# Server templates

A server-rendered template cannot call `css()`. So a server app keeps its styles
in TypeScript modules, Kirana's CLI compiles them, and the templates name them.

- [Laravel](/docs/frameworks/laravel): The PHP framework for web artisans: @kirana in Blade.
- [Symfony](/docs/frameworks/symfony): The PHP framework for websites and apps: kirana() in Twig.
- [Ruby on Rails](/docs/frameworks/rails): The full-stack Ruby framework: a kirana helper in ERB views.
- [Phoenix](/docs/frameworks/phoenix): Rich, interactive Elixir apps: kirana/1 in HEEx templates.
- [AdonisJS](/docs/frameworks/adonisjs): The fully featured Node.js framework: kirana() in Edge.

## How it works

1. **You write styles in modules** listed under `classes.modules` in
   `kirana.config`. Each exported handle, and each handle inside an exported
   object, is a style a template can name:

   ```ts file="resources/styles/app.styles.ts"
   import { css } from "@kirana-style/core"

   export const card = css({ padding: "1rem", borderRadius: "0.5rem" })
   export const button = {
     base: css({ paddingInline: "1rem" }),
     primary: css({ backgroundColor: "black", color: "white" }),
   }
   ```

2. **The CLI writes two files**: the stylesheet, and a class map of every name
   with the classes it compiles to:

   ```ts file="kirana.config.ts"
   import { defineConfig } from "@kirana-style/core/config"

   export default defineConfig({
     classes: {
       modules: ["resources/styles"],
       out: "public/kirana/classes.json",
     },
   })
   ```

   ```bash
   npx kirana-style dev resources/styles --out public/kirana/kirana.css
   ```

   `kirana-style dev` rewrites both on every edit; `kirana-style build` with the
   same arguments and `--minify` writes them once, for production.

3. **A template names styles** through its language's helper, which reads the
   class map and merges the names, later ones winning, as an `sx` list does:

   ```html
   <button class="@kirana('button.base', 'button.primary')">Save</button>
   ```

## Merging without a runtime

Kirana's class names carry their own merge rules: everything before the final `_`
says which property, target and conditions a class sets, so the last class for a
key wins. The helpers in PHP, Ruby and Elixir implement those rules in a few dozen
lines, and each passes the same 400 merge cases as the JavaScript runtime, on every
change. Nothing about a style is decided in the template.

## Limits

- **Only styles known at build time.** A recipe, an array, or a value from a
  variable has no class string a template can use; the build reports it as
  `classes-not-static`. Pick between variants in the template instead:
  `kirana('button.base', $primary ? 'button.primary' : null)`.
- **An unknown name fails loudly**: at runtime in the helper, and in the editor,
  where the [language server](/docs/tooling/editor) underlines it
  (`unknown-class-name`) and hovers a known one with its styles.
- **The stylesheet holds every style the modules export**, used or not: no
  template is read at build time.
