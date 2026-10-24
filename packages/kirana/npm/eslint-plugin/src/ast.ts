/** What the rules need to know about Kirana source from the syntax tree alone. */
import type { Node } from "./types.ts"

/** Local names of `@kirana-style/core`'s imports, by imported name (`css` → `css`, `props` → `styleProps`). */
export function kiranaImports(program: Node): Map<string, string> {
  const names = new Map<string, string>()
  for (const statement of program.body as Node[]) {
    if (
      statement.type !== "ImportDeclaration" ||
      statement.source.value !== "@kirana-style/core"
    )
      continue
    for (const specifier of statement.specifiers as Node[]) {
      if (specifier.type === "ImportSpecifier")
        names.set(specifier.imported.name, specifier.local.name)
    }
  }
  return names
}

/** Whether `node` calls the local name `name`. */
export const calls = (node: Node, name: string | undefined): boolean =>
  node.type === "CallExpression" &&
  node.callee.type === "Identifier" &&
  node.callee.name === name

/** A property's key as written: an identifier, a string or a number; `undefined` when computed. */
export function keyName(property: Node): string | undefined {
  const key = property.key
  if (!property.computed && key.type === "Identifier") return key.name
  if (
    key.type === "Literal" &&
    (typeof key.value === "string" || typeof key.value === "number")
  )
    return String(key.value)
  if (key.type === "TemplateLiteral" && key.expressions.length === 0)
    return key.quasis[0].value.cooked
  return undefined
}

/** `paddingTop` → `padding-top`; custom properties stay as written. */
export const kebab = (name: string): string =>
  name.startsWith("--")
    ? name
    : name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)

/** Whether a key names a condition rather than a property (a pseudo-element names a block). */
export const isConditionKey = (key: string): boolean =>
  key === "base" || key === "*" || /^(:(?!:)|@|\[)/.test(key)

/**
 * Every style object of the file: each object-literal argument of `css()`, each `base` and variant
 * option of a `recipe()`, and the objects nested in them (conditional values, pseudo-elements,
 * `select` blocks). The callback receives each object with whether it is a property's conditional
 * value.
 */
export function eachStyleObject(
  program: Node,
  visit: (object: Node, conditional: boolean) => void
): void {
  const imports = kiranaImports(program)
  const walkStyle = (object: Node, conditional: boolean) => {
    visit(object, conditional)
    for (const property of object.properties as Node[]) {
      if (
        property.type !== "Property" ||
        property.value.type !== "ObjectExpression"
      )
        continue
      const key = keyName(property)
      // A pseudo-element or `select` block is a style; any other object is a conditional value.
      const style =
        key === undefined
          ? !conditional && !isRelationRead(property.key)
          : key.startsWith("::")
      walkStyle(property.value, !style)
    }
  }
  const recipeStyles = (config: Node) => {
    for (const property of config.properties as Node[]) {
      if (
        property.type !== "Property" ||
        property.value.type !== "ObjectExpression"
      )
        continue
      const key = keyName(property)
      if (key === "base") walkStyle(property.value, false)
      if (key !== "variants") continue
      for (const variant of property.value.properties as Node[]) {
        if (
          variant.type !== "Property" ||
          variant.value.type !== "ObjectExpression"
        )
          continue
        for (const option of variant.value.properties as Node[])
          if (
            option.type === "Property" &&
            option.value.type === "ObjectExpression"
          )
            walkStyle(option.value, false)
      }
    }
  }
  walk(program, (node) => {
    if (calls(node, imports.get("css")))
      for (const argument of node.arguments as Node[])
        if (argument.type === "ObjectExpression") walkStyle(argument, false)
    if (
      calls(node, imports.get("recipe")) &&
      node.arguments[0]?.type === "ObjectExpression"
    )
      recipeStyles(node.arguments[0])
  })
}

/** A computed key that reads a relation (`card.within(":hover")`): a condition, not a block. */
const isRelationRead = (key: Node): boolean =>
  key.type === "CallExpression" &&
  key.callee.type === "MemberExpression" &&
  ["within", "parent", "after", "before"].includes(key.callee.property.name)

/** Visits every node below `node`, parents first. */
export function walk(node: Node, visit: (node: Node) => void): void {
  visit(node)
  for (const field in node) {
    if (field === "parent") continue
    const value = node[field]
    if (Array.isArray(value)) {
      for (const child of value)
        if (child && typeof child.type === "string") walk(child, visit)
    } else if (value && typeof value.type === "string") walk(value, visit)
  }
}
