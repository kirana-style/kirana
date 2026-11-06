import { Component } from "@angular/core"
import { SxDirective } from "@kirana-style/angular"

import { IconPlaceholder } from "@/registry/lib/kit/icon-placeholder"
import { button } from "@/registry/ui/button.styles"

/** The button as an Angular component: the icon a directive on its `<svg>`, drawn inline at install. */
@Component({
  selector: "kit-button",
  imports: [SxDirective, IconPlaceholder],
  template: `<button data-registry-probe="" [sx]="root">
    <svg
      iconPlaceholder
      lucide="CheckIcon"
      tabler="IconCheck"
      hugeicons="Tick02Icon"
      phosphor="CheckIcon"
      remixicon="RiCheckLine"
    ></svg>
    <ng-content />
  </button>`,
})
export class Button {
  protected readonly root = button.root
}
