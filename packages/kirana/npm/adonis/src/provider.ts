/** The AdonisJS provider: `kirana()` in every Edge template (see `index.ts`). */
import type { ApplicationService } from "@adonisjs/core/types"

import { registerKirana } from "./index.ts"

export default class KiranaProvider {
  readonly app: ApplicationService

  constructor(app: ApplicationService) {
    this.app = app
  }

  async boot(): Promise<void> {
    const { default: edge } = await import("edge.js")
    const file = this.app.config.get<string | undefined>("kirana.classes")
    registerKirana(edge, file ?? this.app.publicPath("kirana/classes.json"))
  }
}
