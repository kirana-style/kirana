# Angular
Source: https://kirana.style/docs/frameworks/angular

# Angular

Kirana works with both ways of building Angular: the **Angular CLI** (`ng build`,
`ng serve`), through two builders that replace Angular's own, and **Analog** on
Vite, through a Vite plugin. Templates style elements with an `[sx]` directive.
Tested on every change by `examples/angular-cli` and `examples/analog-angular`,
with npm and pnpm, in a production build and on the dev server.

> [!NOTE] Not on npm yet
> The packages are packed and install-tested on every change, but not published.
> Until they are, install them from tarballs as
> [Installation](/docs/start/installation#install-from-tarballs) shows; the rest
> of this page is the same either way.

## How Angular differs

Everywhere else, `sx` is compiled away: the build writes the class names into the
element. An Angular template reaches only its component's members, so there the
build compiles your `css({...})` calls into class strings, and the `[sx]`
directive merges them in the browser with Kirana's runtime, which is under 1 kB gzipped.
The stylesheet is still built ahead of time, and the classes are the same ones a
JSX app would get. What moves to the browser is only the merge: which entry wins
when two handles set the same property.

## The fast way

In the project's root:

```bash
npx kirana init
```

It detects Angular and whether it builds with the CLI or Analog, shows every
change below as a diff, writes them once you say yes, and prints the install
command (`--install` runs it). Then `npx kirana doctor` checks the result.

## With the Angular CLI

### 1. Install

```bash
npm install @kirana-style/core @kirana-style/angular
```

### 2. Use Kirana's builders

In `angular.json`, swap the `build` and `serve` builders. Every option stays as
it is:

```json file="angular.json"
{
  "projects": {
    "app": {
      "architect": {
        "build": {
          "builder": "@kirana-style/angular:application",
          "options": { "browser": "src/main.ts" }
        },
        "serve": {
          "builder": "@kirana-style/angular:dev-server"
        }
      }
    }
  }
}
```

Angular compiles TypeScript from disk and has no hook to change a file first. So
the builders keep a compiled copy of `src/` in `.kirana/`, hand Angular that copy
through `fileReplacements`, and add the stylesheet, `.kirana-style/kirana.css`, to
`styles`. `ng serve` and `ng build --watch` update the copy as you edit. Ignore
the folder:

```bash file=".gitignore"
.kirana/
```

There is no stylesheet import to add: the builders add it.

## With Analog

### 1. Install

```bash
npm install @kirana-style/core @kirana-style/angular
npm install -D @kirana-style/vite
```

### 2. Add the plugin

Kirana goes after Analog. Angular compiles each file from disk, and Kirana
compiles the JavaScript it emitted:

```ts file="vite.config.ts"
import analog from "@analogjs/platform"
import { kiranaAngular } from "@kirana-style/angular/vite"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [analog(), kiranaAngular()],
})
```

### 3. Import the stylesheet

```ts file="src/main.ts"
import "@kirana-style/core/stylesheet.css"
```

## Write a component

Import `SxDirective`, and expose the handles as a member with the same name, so
the template can reach them:

```ts file="src/app/card.ts"
import { Component, input } from "@angular/core"
import { SxDirective } from "@kirana-style/angular"
import { css } from "@kirana-style/core"

const styles = {
  card: css({ padding: "1rem", borderRadius: "0.5rem" }),
  wide: css({ width: "100%" }),
}

@Component({
  selector: "app-card",
  imports: [SxDirective],
  template: `<div
    class="card"
    [sx]="[styles.card, wide() && styles.wide]"
  ></div>`,
})
export class Card {
  readonly wide = input(false)
  protected readonly styles = styles
}
```

`[sx]` takes what `sx` takes anywhere: one handle, or an array with falsy guards.
Angular type-checks it against `Sx`. The element's own `class` and `style` stay;
the directive adds and removes only what it set. Templates in a `templateUrl`
file work the same way.

A value known only at runtime, such as `css({ marginLeft: offset })`, is bridged
through a custom property, as in [dynamic styles](/docs/styling/dynamic).

### Another class-name prefix

If `kirana.config` sets [`names.prefix`](/docs/config/reference), tell the
directive:

```ts file="src/main.ts"
import { provideKirana } from "@kirana-style/angular"

bootstrapApplication(App, { providers: [provideKirana({ prefix: "app" })] })
```

## In the editor

The [editor extensions](/docs/tooling/editor) read `[sx]` in inline templates and
in `templateUrl` files: colour hints, the style card on hover, go to definition
and diagnostics, as in JSX.

## Next

- [Styles](/docs/styling/styles) and [merging](/docs/styling/merging).
- [The Vite plugin](/docs/integrations/vite), for Analog.
