/**
 * `@kirana-style/preset-scales` as a preset (KRN-TOK-008): its utility grammar, for string `sx`.
 *
 *   // kirana.config.ts
 *   import scales from "@kirana-style/preset-scales/preset"
 *   export default defineConfig({ presets: [scales()] })
 *
 * A separate entry from the tokens, because a configuration file runs uncompiled: importing the
 * token modules there would call `defineTokens()` outside the compiler, which throws.
 */
import type { Preset } from "@kirana-style/core/config"

import { grammar } from "./grammar.ts"

export { grammar }

export default function scales(): Preset {
  return { name: "@kirana-style/preset-scales", utilities: grammar }
}
