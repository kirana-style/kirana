/**
 * Kirana for Analog, Angular on Vite (D-068). Angular compiles each TypeScript file from its own
 * program on disk, so a plugin that ran first would change nothing it reads. This is Kirana's Vite
 * plugin run after Angular's instead: it compiles the JavaScript Angular emitted for each module,
 * where `css()` calls and their imports are as written. The stylesheet and its hot updates work as
 * they do in every Vite app.
 *
 *   plugins: [analog(), kiranaAngular()]
 */
import kirana from "@kirana-style/vite"
import type { KiranaViteOptions } from "@kirana-style/vite"
import type { Plugin } from "vite"

export type { KiranaViteOptions as KiranaAngularOptions }

export function kiranaAngular(options: KiranaViteOptions = {}): Plugin[] {
  const [main, late] = kirana(options)
  return [{ ...main, enforce: "post" }, late]
}

export default kiranaAngular
