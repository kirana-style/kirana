import { Component } from "@angular/core"
import { SxDirective } from "@kirana-style/angular"
import { css, relation } from "@kirana-style/core"

const folder = relation("angular-folder")
const label = css({
  color: { base: "black", [folder.within('[data-state="open"]')]: "red" },
})

@Component({
  selector: "app-tree",
  imports: [SxDirective],
  templateUrl: "./tree.component.html",
})
export class Tree {
  protected readonly folder = folder
  protected readonly label = label
}
