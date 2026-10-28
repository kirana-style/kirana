import { Component, Directive, computed, input } from "@angular/core"
import { SxDirective, partSx, provideSxPart } from "@kirana-style/angular"
import type { SxInput } from "@kirana-style/angular"
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
  tag: css({ paddingBottom: "11px", color: "rgb(9, 9, 9)" }),
  tagColor: css({ color: "rgb(1, 2, 3)" }),
}

/**
 * A part, as a design system writes one: it takes `sx` and merges it with its own styles, the
 * caller's last. This template imports `SxDirective` too, which stands down on the part's element
 * (`provideSxPart`, KF-049), so the runner reads the part's padding and the caller's colour.
 */
@Directive({
  selector: "[appTag]",
  providers: [provideSxPart()],
  host: { "[class]": "part().class", "[style]": "part().style" },
})
export class Tag {
  readonly sx = input<SxInput>()
  protected readonly part = computed(() => partSx(styles.tag, this.sx()))
}

@Component({
  selector: "app-root",
  imports: [SxDirective, Tag],
  template: `<p data-probe="" [sx]="[styles.probe, margin]">
      Styled by Kirana.
    </p>
    <span data-probe-part="" appTag [sx]="styles.tagColor">A part</span>`,
})
export class App {
  protected readonly styles = styles
  protected readonly margin = css({
    marginLeft: `${document.title.length % 3}px`,
  })
}
