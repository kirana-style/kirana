/**
 * `@kirana-style/eslint-plugin` (KRN-DX-009): Kirana's lint rules for ESLint (flat config) and Oxlint
 * (`jsPlugins`). Rules read the compiler's inspection API — its diagnostics, sites, tokens and
 * resolution — instead of re-implementing it, so lint and build never disagree.
 */
import diagnostics from "./rules/diagnostics.ts"
import finiteBridge from "./rules/finite-bridge.ts"
import noClassHelpers from "./rules/no-class-helpers.ts"
import noClassnameOnSx from "./rules/no-classname-on-sx.ts"
import noConflictingProps from "./rules/no-conflicting-props.ts"
import noDarkVariant from "./rules/no-dark-variant.ts"
import noUnused from "./rules/no-unused.ts"
import overrideKeepsConditions from "./rules/override-keeps-conditions.ts"
import preferToken from "./rules/prefer-token.ts"
import restrictedProperties from "./rules/restricted-properties.ts"
import sortProperties from "./rules/sort-properties.ts"
import sxLast from "./rules/sx-last.ts"
import useLogicalProperties from "./rules/use-logical-properties.ts"

export { reset } from "./project.ts"
export type { Rule } from "./types.ts"

export const rules = {
  diagnostics,
  "sort-properties": sortProperties,
  "prefer-token": preferToken,
  "sx-last": sxLast,
  "finite-bridge": finiteBridge,
  "no-unused": noUnused,
  "no-conflicting-props": noConflictingProps,
  "override-keeps-conditions": overrideKeepsConditions,
  "no-classname-on-sx": noClassnameOnSx,
  "no-dark-variant": noDarkVariant,
  "no-class-helpers": noClassHelpers,
  "restricted-properties": restrictedProperties,
  "use-logical-properties": useLogicalProperties,
}

type Level = "error" | "warn"

/** Problems the build would report or that lose styles silently. */
const recommended: Record<string, Level> = {
  "kirana/diagnostics": "error",
  "kirana/sx-last": "error",
  "kirana/no-conflicting-props": "error",
  "kirana/override-keeps-conditions": "error",
  "kirana/no-classname-on-sx": "error",
  "kirana/no-dark-variant": "warn",
  "kirana/no-unused": "warn",
}

/**
 * Everything, the stylistic and advisory rules too. Two rules are a project's own policy and stay
 * off until it turns them on: `restricted-properties` (its list) and `use-logical-properties` (a page
 * that is only ever left-to-right loses nothing to physical sides).
 */
const strict: Record<string, Level> = {
  ...recommended,
  "kirana/sort-properties": "error",
  "kirana/prefer-token": "warn",
  "kirana/finite-bridge": "warn",
  "kirana/no-class-helpers": "error",
}

const plugin = {
  meta: { name: "@kirana-style/eslint-plugin", version: "0.1.0" },
  rules,
  configs: {} as Record<
    "recommended" | "strict",
    { plugins: Record<string, unknown>; rules: Record<string, Level> }
  >,
}
plugin.configs.recommended = { plugins: { kirana: plugin }, rules: recommended }
plugin.configs.strict = { plugins: { kirana: plugin }, rules: strict }

export default plugin
