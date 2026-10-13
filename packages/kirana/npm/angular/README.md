# @kirana-style/angular

Kirana for Angular: the `[sx]` directive for templates, a Vite plugin for Analog, and builders for
the Angular CLI ([11-integrations](../../../../spec/11-integrations.md), D-068).

```ts
// a component
import { Component } from "@angular/core"
import { SxDirective } from "@kirana-style/angular"
import { css } from "@kirana-style/core"

const styles = { card: css({ padding: "1rem" }) }

@Component({
  selector: "app-card",
  imports: [SxDirective],
  template: `<div [sx]="styles.card"></div>`,
})
export class Card {
  protected readonly styles = styles
}
```

- **`SxDirective`** merges the handles with Kirana's runtime and adds and removes only the classes
  and custom properties it set. `provideKirana({ prefix })` matches a `names.prefix` other than `k`.
- **Analog.** `kiranaAngular()` from `@kirana-style/angular/vite`, after `analog()`, compiles the JavaScript
  Angular emits. Import `@kirana-style/core/stylesheet.css` from `src/main.ts`.
- **Angular CLI.** In `angular.json`, `@kirana-style/angular:application` and `@kirana-style/angular:dev-server`
  replace `@angular/build:application` and `:dev-server`, with the same options. They compile the
  source root into `.kirana/` (ignore it), hand Angular the copy through `fileReplacements`, and add
  `.kirana/kirana.css` to `styles`.

`kirana init` sets up either. How it works and what it costs: `design-notes/angular.md`.
