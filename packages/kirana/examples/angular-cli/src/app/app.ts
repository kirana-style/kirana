import { Component } from "@angular/core"
import { SxDirective } from "@kirana-style/angular"
import { css } from "@kirana-style/core"

/**
 * The probe the example runner reads back from the browser. A template reaches only its
 * component's members, so the handles are a module constant exposed under the same name; `[sx]` is
 * the directive from @kirana-style/angular, which merges them at runtime. The margin is known only at
 * runtime, so it is bridged through a custom property. The builders in angular.json compile this
 * file into `.kirana/` and hand Angular the compiled copy.
 */
const styles = {
  probe: css({
    color: "rgb(1, 2, 3)",
    paddingTop: "7px",
    backgroundColor: { base: "rgb(250, 250, 250)", ":hover": "rgb(4, 5, 6)" },
  }),
}

@Component({
  selector: "app-root",
  imports: [SxDirective],
  template: `<p data-probe="" [sx]="[styles.probe, margin]">
    Styled by Kirana.
  </p>`,
})
export class App {
  protected readonly styles = styles
  protected readonly margin = css({
    marginLeft: `${document.title.length % 3}px`,
  })
}
