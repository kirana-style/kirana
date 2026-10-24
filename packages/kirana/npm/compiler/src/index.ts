export { Driver, type DriverOptions, type TransformResult } from "./driver.ts"
export {
  formatDiagnostic,
  parseDiagnostics,
  position,
  type Diagnostic,
} from "./diagnostics.ts"
export {
  detectJsx,
  loadConfigFile,
  resolveConfig,
  resolveConfigSync,
  mergeGrammars,
} from "./config.ts"
export {
  loadNative,
  engineOf,
  type Engine,
  platformTriple,
  isMusl,
  type NativeBinding,
} from "./native.ts"
export { main } from "./cli.ts"
export {
  utf16Offset,
  type ConditionInfo,
  type Definition,
  type DefinitionEntry,
  type DesignSystemExport,
  type RecipePart,
  type RelationInfo,
  type Site,
  type SiteAtom,
  type Span,
  type TailwindLowering,
  type TokenInfo,
  type TraceAnswer,
  type TraceEntry,
  type TraceQuery,
} from "./inspect.ts"
export { COMPONENT, frameworkOf, type Framework } from "./sfc.ts"
