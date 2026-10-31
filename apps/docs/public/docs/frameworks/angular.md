# Angular
Source: https://site.kirana-style.workers.dev/docs/frameworks/angular

# Angular

Kirana works with both ways of building Angular: the **Angular CLI**, through two
builders that replace Angular's own for building and serving, and **Analog** on
Vite, through a Vite plugin. Templates style elements with an `[sx]` directive.
Tested on every change by `examples/angular-cli` and `examples/analog-angular`,
with npm and pnpm, in a production build and on the dev server.



## How Angular differs

Everywhere else, `sx` is compiled away: the build writes the class names into the
element. An Angular template reaches only its component's members, so there the
build compiles your `css({...})` calls into class strings, and the `[sx]`
directive merges them in the browser with Kirana's runtime, which is under 1.1 kB gzipped.
The stylesheet is still built ahead of time, and the classes are the same ones a
JSX app would get. What moves to the browser is only the merge: which entry wins
when two handles set the same property.

## The fast way

In the project's root:

```bash
npx kirana-style@latest init
```

It detects Angular and whether it builds with the CLI or Analog, shows every
change below as a diff, writes them once you say yes, and prints the install
command (`--install` runs it). Then `npx kirana-style doctor` checks the result.

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
the builders keep a compiled copy of `src/` in `.kirana/`, and hand Angular:

- that copy, through `fileReplacements`;
- the stylesheet, `.kirana/kirana.css`, in `styles`.

The dev server and watch builds update the copy as you edit. Ignore the folder:

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
Angular type-checks it against `Sx`. The element's own class and style attributes stay;
the directive adds and removes only what it set. Templates in a `templateUrl`
file work the same way.

A value known only at runtime, such as `css({ marginLeft: offset })`, is bridged
through a custom property, as in [dynamic styles](/docs/styling/dynamic).

## A part that takes `sx`

A design system's parts are attribute directives, such as a button directive on
a `<button>`, and a part merges its own styles with its caller's, the caller's
last, as a component does everywhere else. Three exports make that work:

- `partSx(own, sx)` does the merge `[sx]` does, and returns the host's `class`
  and `style`;
- `SxInput` types the part's input: an Angular CLI build type-checks the
  compiled copy, where handles are class strings;
- `provideSxPart()`, in the part's `providers`, keeps `SxDirective` off its
  element.

```ts file="src/app/button.ts"
import { Directive, computed, input } from "@angular/core"
import { partSx, provideSxPart } from "@kirana-style/angular"
import type { SxInput } from "@kirana-style/angular"
import { css } from "@kirana-style/core"

const button = css({ paddingInline: "1rem", borderRadius: "0.5rem" })

@Directive({
  selector: "button[uiButton]",
  providers: [provideSxPart()],
  host: { "[class]": "part().class", "[style]": "part().style" },
})
export class Button {
  readonly sx = input<SxInput>()
  protected readonly part = computed(() => partSx(button, this.sx()))
}
```

A template that imports `SxDirective` for its plain elements can then hold the
part too: `<button uiButton [sx]="styles.wide">`. Both read the one `[sx]`
binding, and only the part applies it.

Without `provideSxPart()`, the directive would add the caller's classes as well,
and they would be lost the next time the part's class binding changed. With
another class-name prefix, pass it as the merge's third argument.

### Another class-name prefix

If `kirana.config` sets [`names.prefix`](/docs/reference/config), tell the
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

- [Your first component](/docs/start/first-component): a button with a hover state
  and a variant, and the CSS it compiles to.
- [Styles](/docs/styling/styles) and [merging](/docs/styling/merging).
- [The Vite plugin](/docs/integrations/vite), for Analog.
