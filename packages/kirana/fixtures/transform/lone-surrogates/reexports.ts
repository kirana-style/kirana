// oxc keeps a lone surrogate as written: a specifier holding one names no module.
export { a as fromReexport } from "\uD800"
export * as namespaced from "\uD800"
export * from "\uD800"
export const plain = "1px"
